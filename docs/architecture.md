# 📐 Architecture Diagrams — LGTM Observability Stack

> All diagrams below are rendered as Mermaid and viewable directly on GitHub.

---

## 1. System Architecture Overview

High-level view of the entire system: K3s cluster with two namespaces, external load testing, and S3 storage.

```mermaid
graph TB
    subgraph External
        k6["🧪 k6 Load Tester"]
        User["👤 User / Grafana Viewer"]
        S3["☁️ AWS S3<br/>(lgtm-netperform-somt-2026)"]
    end

    subgraph K3s Cluster
        subgraph ns_bookinfo["📦 Namespace: bookinfo"]
            Ingress["Traefik Ingress<br/>+ Rate Limit Middleware<br/>(75 in-flight max)"]
            PP["productpage-v1<br/>(Python)"]
            R1["reviews-v1<br/>(Java)"]
            R2["reviews-v2<br/>(Java)"]
            R3["reviews-v3<br/>(Java)"]
            DT["details-v1<br/>(Ruby)"]
            RT["ratings-v1<br/>(Node.js)"]
            HPA["HPA<br/>(CPU 60%)"]
        end

        subgraph ns_lgtm["🔭 Namespace: lgtm"]
            OTel["OpenTelemetry<br/>Collector<br/>(DaemonSet)"]
            Prom["Prometheus"]
            Loki["Grafana Loki<br/>(SingleBinary)"]
            Tempo["Grafana Tempo"]
            Mimir["Grafana Mimir<br/>(Distributed)"]
            Grafana["Grafana<br/>(NodePort 30000)"]
        end
    end

    k6 -->|"HTTP traffic"| Ingress
    Ingress --> PP
    PP --> R1 & R2 & R3
    PP --> DT
    R2 & R3 --> RT
    HPA -.->|"autoscale"| PP & R1 & R2 & R3 & DT & RT

    OTel -->|"logs (OTLP/HTTP)"| Loki
    OTel -->|"traces (OTLP/gRPC)"| Tempo
    Prom -->|"remote_write"| Mimir

    Grafana -->|"query"| Loki & Tempo & Mimir

    Loki -->|"chunks"| S3
    Tempo -->|"traces"| S3
    Mimir -->|"blocks"| S3

    User -->|"dashboards"| Grafana

    style ns_bookinfo fill:#1a3a5c,stroke:#4a9eff,stroke-width:2px,color:#fff
    style ns_lgtm fill:#3a1a1a,stroke:#ff6b35,stroke-width:2px,color:#fff
    style External fill:#1a1a2e,stroke:#e94560,stroke-width:1px,color:#fff
```

---

## 2. Observability Data Flow Pipeline

Detailed view of how each telemetry signal flows through the system.

```mermaid
flowchart LR
    subgraph Sources["📡 Telemetry Sources"]
        AppLogs["Container Logs<br/>(stdout/stderr)"]
        AppTraces["App Traces<br/>(auto-instrumented)"]
        K8sMetrics["K8s Metrics<br/>(kube-state-metrics<br/>+ node-exporter)"]
        AppMetrics["App Metrics<br/>(/metrics endpoint)"]
    end

    subgraph Collectors["🔄 Collection Layer"]
        OTel["OTel Collector<br/>(DaemonSet)"]
        Prom["Prometheus Server"]
    end

    subgraph Backends["💾 Storage Backends"]
        Loki["Loki<br/>(Log Store)"]
        Tempo["Tempo<br/>(Trace Store)"]
        Mimir["Mimir<br/>(Metrics Store)"]
    end

    subgraph Storage["☁️ Long-term Storage"]
        S3_Loki["S3 — Loki Chunks"]
        S3_Tempo["S3 — Tempo Traces"]
        S3_Mimir["S3 — Mimir Blocks"]
    end

    subgraph Viz["📊 Visualization"]
        Grafana["Grafana Dashboards"]
        Telegram["Telegram Alerts"]
    end

    AppLogs -->|"filelog receiver"| OTel
    AppTraces -->|"OTLP gRPC :4317"| OTel
    K8sMetrics -->|"scrape"| Prom
    AppMetrics -->|"scrape :9080/metrics"| Prom

    OTel -->|"otlphttp exporter"| Loki
    OTel -->|"otlp exporter"| Tempo
    Prom -->|"remote_write API"| Mimir

    Loki --> S3_Loki
    Tempo --> S3_Tempo
    Mimir --> S3_Mimir

    Loki -->|"LogQL"| Grafana
    Tempo -->|"TraceQL"| Grafana
    Mimir -->|"PromQL"| Grafana
    Grafana -->|"alerting"| Telegram

    style Sources fill:#0d2137,stroke:#4fc3f7,color:#fff
    style Collectors fill:#1a2744,stroke:#7c4dff,color:#fff
    style Backends fill:#2e1a0e,stroke:#ff9800,color:#fff
    style Storage fill:#0d3321,stroke:#66bb6a,color:#fff
    style Viz fill:#3e1a3e,stroke:#e040fb,color:#fff
```

---

## 3. Resource Contention Problem — AS-IS vs TO-BE

This diagram illustrates the core issue that affects benchmark reliability.

### AS-IS: Current Deployment (No Isolation)

```mermaid
graph TB
    subgraph Node1["🖥️ Worker Node (shared)"]
        direction TB
        subgraph Workload["Bookinfo Pods"]
            P1["productpage"]
            P2["reviews-v1"]
            P3["reviews-v2"]
        end
        subgraph Tools["LGTM Pods"]
            T1["Loki"]
            T2["Mimir Ingester"]
            T3["OTel Collector"]
            T4["Prometheus"]
        end
    end

    k6["🧪 k6<br/>800 VUs"] -->|"stress"| P1

    P1 -.->|"⚠️ CPU contention"| T1
    P2 -.->|"⚠️ Memory contention"| T2
    P3 -.->|"⚠️ I/O contention"| T3

    style Node1 fill:#4a0000,stroke:#ff1744,stroke-width:3px,color:#fff
    style Workload fill:#1a237e,stroke:#536dfe,color:#fff
    style Tools fill:#4e342e,stroke:#ff6e40,color:#fff
```

**Problem:** All pods land on the same node. Under heavy load, workload pods steal CPU/memory from observability tools → metrics become unreliable.

### TO-BE: Proposed Deployment (With Isolation)

```mermaid
graph TB
    subgraph WorkerNode["🖥️ Worker Node<br/>(label: role=workload)"]
        P1["productpage ×3"]
        P2["reviews-v1 ×2"]
        P3["reviews-v2 ×2"]
        P4["reviews-v3 ×2"]
        P5["details-v1"]
        P6["ratings-v1"]
    end

    subgraph MonitorNode["🖥️ Monitoring Node<br/>(label: role=monitoring)<br/>(taint: dedicated=monitoring:NoSchedule)"]
        T1["Loki"]
        T2["Tempo"]
        T3["Mimir (all components)"]
        T4["OTel Collector"]
        T5["Prometheus"]
        T6["Grafana"]
    end

    k6["🧪 k6"] -->|"stress"| WorkerNode
    MonitorNode -.->|"✅ unaffected"| MonitorNode

    style WorkerNode fill:#0d3b66,stroke:#4fc3f7,stroke-width:2px,color:#fff
    style MonitorNode fill:#1b5e20,stroke:#69f0ae,stroke-width:2px,color:#fff
```

**Solution:** Separate nodes using `nodeSelector` + `taints/tolerations`. Monitoring tools run on a dedicated node that workload pods cannot be scheduled on.

---

## 4. Load Test Scenarios — VU Traffic Patterns

Visual representation of the four k6 test scenarios and their virtual user (VU) ramp patterns.

```mermaid
gantt
    title k6 Load Test Scenarios — VU Ramp Patterns
    dateFormat X
    axisFormat %s sec

    section KB1 Baseline
    10 VUs steady          :b1, 0, 120

    section KB2 RED Method
    Ramp 0→10              :r1, 0, 10
    Hold 10                :r2, 10, 40
    Ramp 10→50             :r3, 40, 70
    Hold 50                :r4, 70, 100
    Ramp 50→100            :r5, 100, 145
    Hold 100               :r6, 145, 325
    Ramp 100→20            :r7, 325, 335
    Hold 20                :r8, 335, 395
    Cool-down              :r9, 395, 405

    section KB3 Stress
    Ramp to 100            :s1, 0, 60
    Ramp to 200            :s2, 60, 120
    Ramp to 300            :s3, 120, 180
    Ramp to 400            :s4, 180, 240
    Ramp to 500            :crit, s5, 240, 300
    Ramp to 600            :crit, s6, 300, 360
    Ramp to 800            :crit, s7, 360, 420
    Cool-down              :s8, 420, 450

    section KB4 Spike
    Warm-up 0→50           :sp1, 0, 30
    Baseline 100           :sp2, 30, 90
    SPIKE 1 → 400          :crit, sp3, 90, 100
    Hold spike             :crit, sp4, 100, 130
    Recovery → 100         :sp5, 130, 150
    Stable 100             :sp6, 150, 210
    SPIKE 2 → 400          :crit, sp7, 210, 220
    Hold spike             :crit, sp8, 220, 250
    Cool-down              :sp9, 250, 300
```

### Test Scenario Summary

| # | Scenario | Goal | Key Metrics | Pass Criteria |
|---|---|---|---|---|
| KB1 | **Baseline** | Establish normal operating metrics | RPS, latency P50 | All requests return 200 |
| KB2 | **RED Method** | Measure Rate, Errors, Duration under gradual load | R/E/D per service | Error rate < 1% |
| KB3 | **Stress** | Find system breaking point | RPS saturation, P95 latency | Error rate < 5%, P95 < 2s |
| KB4 | **Spike** | Test HPA reaction & system recovery | Scale-up time, recovery time | System recovers within 1 min |

---

## 5. Deployment Pipeline

The `deploy.sh` script executes the following steps in order:

```mermaid
flowchart TD
    Start(["🚀 deploy.sh"]) --> NS["Create Namespaces<br/>(bookinfo + lgtm)"]
    NS --> Helm["Add Helm Repos<br/>(grafana, prometheus-community,<br/>open-telemetry)"]
    Helm --> CM["Deploy cert-manager<br/>(v1.14.4)"]
    CM --> Wait1["⏳ Wait 45s<br/>(CRDs registration)"]
    Wait1 --> OTelOp["Deploy OTel Operator<br/>(Helm)"]
    OTelOp --> Wait2["⏳ Wait 30s<br/>(Instrumentation CRD ready)"]

    Wait2 --> App["Deploy Bookinfo App<br/>(bookinfo.yaml)"]
    App --> Ingress["Deploy Ingress<br/>+ Rate Limit Middleware"]
    Ingress --> Res["Set productpage Resources<br/>(100m/128Mi → 500m/512Mi)"]
    Res --> HPA["Deploy HPA<br/>(all 6 deployments)"]

    HPA --> LGTM["Deploy LGTM Stack"]

    subgraph LGTM_Deploy["LGTM Stack Deployment (sequential)"]
        L["Loki"] --> T["Tempo"]
        T --> M["Mimir"]
        M --> OC["OTel Collector"]
        OC --> P["Prometheus"]
        P --> G["Grafana<br/>(NodePort 30000)"]
    end

    LGTM --> LGTM_Deploy
    LGTM_Deploy --> Done(["✅ Done!"])

    style Start fill:#1b5e20,stroke:#69f0ae,color:#fff
    style Done fill:#1b5e20,stroke:#69f0ae,color:#fff
    style LGTM_Deploy fill:#1a2744,stroke:#7c4dff,stroke-width:2px,color:#fff
```

### Deployment Notes
- Each Helm install includes a `sleep 10` between components to ensure readiness
- cert-manager requires a longer wait (45s) for CRD registration
- OTel Operator requires 30s for the `Instrumentation` CRD to be fully available
- Grafana is exposed via **NodePort 30000** for direct access

---

## 6. Namespace & Resource Layout

Overview of resource allocation across namespaces.

```mermaid
graph LR
    subgraph bookinfo["📦 bookinfo namespace"]
        direction TB
        PP["productpage-v1<br/>req: 100m/128Mi<br/>lim: 500m/512Mi<br/>HPA: 3–10 pods"]
        DT["details-v1<br/>req: 10m/64Mi<br/>lim: 100m/128Mi<br/>HPA: 1–5 pods"]
        RT["ratings-v1<br/>req: 10m/64Mi<br/>lim: 100m/128Mi<br/>HPA: 1–5 pods"]
        RV1["reviews-v1<br/>req: 50m/128Mi<br/>lim: 300m/300Mi<br/>HPA: 2–5 pods"]
        RV2["reviews-v2<br/>req: 100m/128Mi<br/>lim: 500m/512Mi<br/>HPA: 2–5 pods"]
        RV3["reviews-v3<br/>req: 100m/128Mi<br/>lim: 500m/512Mi<br/>HPA: 2–5 pods"]
    end

    subgraph lgtm["🔭 lgtm namespace"]
        direction TB
        LOK["Loki (1 replica)<br/>SingleBinary"]
        TMP["Tempo (1 replica)<br/>req: 50m/128Mi"]
        MIM["Mimir (7 components)<br/>distributor, ingester,<br/>querier, query-frontend,<br/>query-scheduler, compactor,<br/>store-gateway"]
        OTEL["OTel Collector<br/>(DaemonSet)"]
        PROM["Prometheus<br/>retention: 2h"]
        GRAF["Grafana<br/>NodePort 30000"]
    end

    bookinfo -.->|"⚠️ same nodes<br/>(no isolation)"| lgtm

    style bookinfo fill:#0d2137,stroke:#4fc3f7,stroke-width:2px,color:#fff
    style lgtm fill:#2e1a0e,stroke:#ff9800,stroke-width:2px,color:#fff
```

> **⚠️ Note:** Both namespaces are currently scheduled on the same nodes. See [Section 3](#3-resource-contention-problem--as-is-vs-to-be) for the proposed isolation strategy.
