#!/usr/bin/env bash
# Setup Google Cloud Load Balancer for https://vaniai.theaicompany.co
# - Reserve static IP, Google-managed SSL cert, backend (chroma-vm:3100), frontend (HTTPS 443)
# Run from any machine with gcloud installed and authenticated.
# Prereq: Domain vaniai.theaicompany.co must point to the reserved LB IP after this script (Step 7 in docs).

set -e
PROJECT="${GCP_PROJECT:-onlynereputation-agentic}"
ZONE="${GCP_ZONE:-asia-south1-a}"
VM_NAME="${VM_NAME:-chroma-vm}"
APP_PORT=3100
DOMAIN="vaniai.theaicompany.co"

echo "=== Vani AI LB setup: project=$PROJECT zone=$ZONE vm=$VM_NAME port=$APP_PORT domain=$DOMAIN ==="

# 1. Reserve static IP
echo "[1/9] Reserving global static IP (vaniai-lb-ip)..."
gcloud compute addresses create vaniai-lb-ip \
  --ip-version=IPV4 \
  --network-tier=PREMIUM \
  --global \
  --project="$PROJECT" 2>/dev/null || true
LB_IP=$(gcloud compute addresses describe vaniai-lb-ip --format="get(address)" --global --project="$PROJECT")
echo "     LB IP: $LB_IP  <- Point $DOMAIN A record to this IP"

# 2. Google-managed SSL certificate
echo "[2/9] Creating Google-managed SSL certificate (vaniai-ssl-cert)..."
gcloud compute ssl-certificates create vaniai-ssl-cert \
  --description="Vani AI - $DOMAIN" \
  --domains="$DOMAIN" \
  --global \
  --project="$PROJECT" 2>/dev/null || echo "     (cert may already exist)"

# 3. Firewall: health checks to port 3100
echo "[3/9] Firewall: allow health checks to port $APP_PORT..."
gcloud compute firewall-rules create vaniai-fw-allow-health-check \
  --network=default \
  --action=allow \
  --direction=ingress \
  --source-ranges=130.211.0.0/22,35.191.0.0/16 \
  --target-tags=allow-health-check \
  --rules=tcp:$APP_PORT \
  --project="$PROJECT" 2>/dev/null || echo "     (rule may already exist)"
gcloud compute instances add-tags "$VM_NAME" --zone="$ZONE" --tags=allow-health-check --project="$PROJECT" 2>/dev/null || true

# 4. Unmanaged instance group + add VM + named port
echo "[4/9] Instance group vaniai-ig + add $VM_NAME + named port http:$APP_PORT..."
gcloud compute instance-groups unmanaged create vaniai-ig \
  --zone="$ZONE" \
  --project="$PROJECT" 2>/dev/null || true
gcloud compute instance-groups unmanaged add-instances vaniai-ig \
  --instances="$VM_NAME" \
  --zone="$ZONE" \
  --project="$PROJECT" 2>/dev/null || true
gcloud compute instance-groups unmanaged set-named-ports vaniai-ig \
  --named-ports=http:$APP_PORT \
  --zone="$ZONE" \
  --project="$PROJECT"

# 5. Health check + backend service
echo "[5/9] Health check + backend service..."
gcloud compute health-checks create http vaniai-http-health-check \
  --port=$APP_PORT \
  --request-path=/ \
  --project="$PROJECT" 2>/dev/null || true
gcloud beta compute backend-services create vaniai-backend-service \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --protocol=HTTP \
  --port-name=http \
  --health-checks=vaniai-http-health-check \
  --global \
  --project="$PROJECT" 2>/dev/null || true
gcloud compute backend-services add-backend vaniai-backend-service \
  --instance-group=vaniai-ig \
  --instance-group-zone="$ZONE" \
  --global \
  --project="$PROJECT" 2>/dev/null || true

# 6. URL map + HTTPS proxy + forwarding rule (frontend) — use beta for EXTERNAL_MANAGED
echo "[6/9] URL map + target HTTPS proxy + forwarding rule..."
gcloud beta compute url-maps create vaniai-url-map \
  --default-service=vaniai-backend-service \
  --project="$PROJECT" 2>/dev/null || true
gcloud beta compute target-https-proxies create vaniai-https-proxy \
  --url-map=vaniai-url-map \
  --ssl-certificates=vaniai-ssl-cert \
  --project="$PROJECT" 2>/dev/null || true
gcloud beta compute forwarding-rules create vaniai-https-rule \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --network-tier=PREMIUM \
  --address=vaniai-lb-ip \
  --global \
  --target-https-proxy=vaniai-https-proxy \
  --ports=443 \
  --project="$PROJECT" 2>/dev/null || true

echo ""
echo "=== Done ==="
echo "1. Set DNS: $DOMAIN  A  $LB_IP"
echo "2. Wait for SSL cert to become ACTIVE (often 15-60 min):"
echo "   gcloud compute ssl-certificates describe vaniai-ssl-cert --global --project=$PROJECT"
echo "3. Then open https://$DOMAIN"
echo ""
