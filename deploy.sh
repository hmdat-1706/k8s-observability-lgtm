#!/bin/bash
echo "Starting..."

# 1. Tạo namespace
kubectl create namespace bookinfo --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace lgtm --dry-run=client -o yaml | kubectl apply -f -

echo "Deploy Bookinfo & HPA service..."
kubectl apply -f bookinfo.yaml -n bookinfo
kubectl apply -f bookinfo-hpa.yaml

echo "Deploy LGTM stack..."
# Cài Loki, Tempo, Mimir (dùng cấu hình mặc định hoặc file values nếu bạn có)
helm upgrade --install loki grafana/loki -n lgtm -f loki-values.yaml
helm upgrade --install tempo grafana/tempo -n lgtm
helm upgrade --install mimir grafana/mimir-distributed -n lgtm

# Cài OTel, Prometheus và Grafana (dùng các file values tụi mình đã config)
helm upgrade --install otel-collector open-telemetry/opentelemetry-collector -n lgtm -f otel-values.yaml
helm upgrade --install prometheus prometheus-community/prometheus -n lgtm -f prometheus-values.yaml
helm upgrade --install grafana grafana/grafana -n lgtm --set service.type=NodePort --set service.nodePort=32000 -f grafana-values.yaml

echo "Done!"
