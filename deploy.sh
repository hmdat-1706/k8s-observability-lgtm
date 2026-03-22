#!/bin/bash

set -e
echo "Starting..."
echo "Create namespaces..."
kubectl create namespace bookinfo --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace lgtm --dry-run=client -o yaml | kubectl apply -f -

echo "Deploy Bookinfo & HPA service..."
kubectl apply -f app/bookinfo.yaml -n bookinfo
kubectl set resources deployment productpage-v1 -n bookinfo \
  --requests=cpu=100m,memory=128Mi \
  --limits=cpu=500m,memory=512Mi
kubectl apply -f app/bookinfo-hpa.yaml

echo "Update Helm repos..."
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

echo "Deploy LGTM stackk..."
echo "Loki..."
helm upgrade --install loki grafana/loki -n lgtm -f monitoring/loki-values.yaml

echo "Tempo..."
helm upgrade --install tempo grafana/tempo -n lgtm

echo "Mimir..."
helm upgrade --install mimir grafana/mimir-distributed -n lgtm

echo "OpenTelemetry Collector..."
helm upgrade --install otel-collector open-telemetry/opentelemetry-collector -n lgtm -f monitoring/otel-values.yaml

echo "Prometheus..."
helm upgrade --install prometheus prometheus-community/prometheus -n lgtm -f monitoring/prometheus-values.yaml

echo "Grafana..."
source .env
envsubst < monitoring/grafana-values.yaml > monitoring/grafana-values-applied.yaml
helm upgrade --install grafana grafana/grafana -n lgtm --set service.type=NodePort --set service.nodePort=32000 -f monitoring/grafana-values-applied.yaml
echo "Done!"
