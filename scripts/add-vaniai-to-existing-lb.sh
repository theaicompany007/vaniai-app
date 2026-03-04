#!/usr/bin/env bash
# Add vaniai.theaicompany.co to your EXISTING Google Cloud HTTPS Load Balancer.
# Prereq: Set URL_MAP_NAME and HTTPS_PROXY_NAME to your existing URL map and target HTTPS proxy names.
#
# Usage:
#   export URL_MAP_NAME=your-url-map-name
#   export HTTPS_PROXY_NAME=your-https-proxy-name
#   ./scripts/add-vaniai-to-existing-lb.sh
#
# Optional: PROJECT, ZONE, VM_NAME (defaults: onlynereputation-agentic, asia-south1-a, chroma-vm)

set -e
PROJECT="${GCP_PROJECT:-onlynereputation-agentic}"
ZONE="${GCP_ZONE:-asia-south1-a}"
VM_NAME="${VM_NAME:-chroma-vm}"
APP_PORT=3100
DOMAIN="vaniai.theaicompany.co"

if [ -z "$URL_MAP_NAME" ] || [ -z "$HTTPS_PROXY_NAME" ]; then
  echo "Set URL_MAP_NAME and HTTPS_PROXY_NAME to your existing LB resources."
  echo "Example: export URL_MAP_NAME=web-map-https; export HTTPS_PROXY_NAME=https-lb-proxy"
  echo "Find them: gcloud compute url-maps list --project=$PROJECT"
  echo "           gcloud compute target-https-proxies list --project=$PROJECT"
  exit 1
fi

echo "=== Adding $DOMAIN to existing LB (url-map=$URL_MAP_NAME, proxy=$HTTPS_PROXY_NAME) ==="

# 1. SSL certificate for vaniai.theaicompany.co
echo "[1/5] Creating Google-managed SSL cert for $DOMAIN..."
gcloud compute ssl-certificates create vaniai-theaicompany-ssl \
  --description="Vani AI - $DOMAIN" \
  --domains="$DOMAIN" \
  --global \
  --project="$PROJECT" 2>/dev/null || echo "     (cert may already exist)"

# 2. Firewall + instance group + health check + backend service
echo "[2/5] Backend: firewall, instance group, health check, backend service..."
gcloud compute firewall-rules create vaniai-fw-health-check \
  --network=default --action=allow --direction=ingress \
  --source-ranges=130.211.0.0/22,35.191.0.0/16 \
  --target-tags=allow-health-check --rules=tcp:$APP_PORT \
  --project="$PROJECT" 2>/dev/null || true
gcloud compute instances add-tags "$VM_NAME" --zone="$ZONE" --tags=allow-health-check --project="$PROJECT" 2>/dev/null || true

gcloud compute instance-groups unmanaged create vaniai-ig --zone="$ZONE" --project="$PROJECT" 2>/dev/null || true
gcloud compute instance-groups unmanaged add-instances vaniai-ig --instances="$VM_NAME" --zone="$ZONE" --project="$PROJECT" 2>/dev/null || true
gcloud compute instance-groups unmanaged set-named-ports vaniai-ig --named-ports=http:$APP_PORT --zone="$ZONE" --project="$PROJECT"

gcloud compute health-checks create http vaniai-http-health \
  --port=$APP_PORT --request-path=/ --project="$PROJECT" 2>/dev/null || true
gcloud compute backend-services create vaniai-backend \
  --load-balancing-scheme=EXTERNAL_MANAGED --protocol=HTTP --port-name=http \
  --health-checks=vaniai-http-health --global --project="$PROJECT" 2>/dev/null || true
gcloud compute backend-services add-backend vaniai-backend \
  --instance-group=vaniai-ig --instance-group-zone="$ZONE" --global --project="$PROJECT" 2>/dev/null || true

# 3. Add host + path matcher to existing URL map
echo "[3/5] Adding host rule $DOMAIN -> vaniai-backend to $URL_MAP_NAME..."
gcloud compute url-maps add-path-matcher "$URL_MAP_NAME" \
  --path-matcher-name=vaniai-pm \
  --default-service=vaniai-backend \
  --new-hosts="$DOMAIN" \
  --global \
  --project="$PROJECT"

# 4. Get current SSL certs on the proxy and add the new one
echo "[4/5] Attaching new SSL cert to $HTTPS_PROXY_NAME..."
# value(sslCertificates) may return one full URL per line; extract short name (last path segment)
CUR_CERTS=$(gcloud compute target-https-proxies describe "$HTTPS_PROXY_NAME" \
  --global --project="$PROJECT" --format="value(sslCertificates)" 2>/dev/null | sed 's|.*/||' | tr '\n' ',')
# Build list: existing + vaniai (no duplicates)
CERT_LIST=$(echo "${CUR_CERTS}vaniai-theaicompany-ssl" | tr ',' '\n' | sort -u | paste -sd, -)
gcloud compute target-https-proxies update "$HTTPS_PROXY_NAME" \
  --ssl-certificates="$CERT_LIST" \
  --global \
  --project="$PROJECT"

echo "[5/5] Done."
echo ""
echo "1. Set DNS: $DOMAIN  A  <your existing LB IP>"
echo "2. Wait for cert ACTIVE: gcloud compute ssl-certificates describe vaniai-theaicompany-ssl --global --project=$PROJECT"
echo "3. Open https://$DOMAIN"
echo ""
