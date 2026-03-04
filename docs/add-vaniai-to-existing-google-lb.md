# Add vaniai.theaicompany.co to Existing Google Load Balancer

You already have a global HTTPS load balancer with theaicompany.co, vani, spark, orm, onlynereputation. This adds **vaniai.theaicompany.co** (SSL cert + frontend host + backend route to chroma-vm:3100).

---

## Quick script (optional)

From the repo root, after setting your existing URL map and HTTPS proxy names:

```bash
export URL_MAP_NAME=your-url-map-name    # from step 1 below
export HTTPS_PROXY_NAME=your-https-proxy-name
./scripts/add-vaniai-to-existing-lb.sh
```

Then set DNS (step 6) and wait for the SSL cert to become ACTIVE.

---

## 1. Get your existing resource names

From **Console → Network services → Load balancing**, open your HTTPS load balancer and note:

- **URL map name** (e.g. `web-map-https` or similar) → set as `URL_MAP_NAME`
- **Target HTTPS proxy name** (e.g. `https-lb-proxy`) → set as `HTTPS_PROXY_NAME`

Or with gcloud:

```bash
# List forwarding rules to find the proxy
gcloud compute forwarding-rules list --global --project=onlynereputation-agentic

# Describe the rule to get target-https-proxy
gcloud compute forwarding-rules describe YOUR_RULE_NAME --global --project=onlynereputation-agentic --format="get(target)"

# List URL maps
gcloud compute url-maps list --project=onlynereputation-agentic
```

---

## 2. Create Google-managed SSL certificate for vaniai.theaicompany.co

```bash
gcloud compute ssl-certificates create vaniai-theaicompany-ssl \
  --description="Vani AI - vaniai.theaicompany.co" \
  --domains=vaniai.theaicompany.co \
  --global \
  --project=onlynereputation-agentic
```

Certificate will stay **PROVISIONING** until DNS for `vaniai.theaicompany.co` points to your load balancer’s IP. Then it becomes **ACTIVE** (often 15–60 min).

---

## 3. Backend: instance group + health check + backend service (port 3100)

Use the same pattern as your other backends (same project/zone/network). Replace zone/VM if yours differ.

```bash
PROJECT=onlynereputation-agentic
ZONE=asia-south1-a
VM_NAME=chroma-vm
APP_PORT=3100

# Firewall: allow health checks to port 3100 (if not already covered)
gcloud compute firewall-rules create vaniai-fw-health-check \
  --network=default \
  --action=allow \
  --direction=ingress \
  --source-ranges=130.211.0.0/22,35.191.0.0/16 \
  --target-tags=allow-health-check \
  --rules=tcp:3100 \
  --project=$PROJECT 2>/dev/null || true

gcloud compute instances add-tags $VM_NAME --zone=$ZONE --tags=allow-health-check --project=$PROJECT 2>/dev/null || true

# Unmanaged instance group + add chroma-vm + named port
gcloud compute instance-groups unmanaged create vaniai-ig \
  --zone=$ZONE --project=$PROJECT 2>/dev/null || true
gcloud compute instance-groups unmanaged add-instances vaniai-ig \
  --instances=$VM_NAME --zone=$ZONE --project=$PROJECT 2>/dev/null || true
gcloud compute instance-groups unmanaged set-named-ports vaniai-ig \
  --named-ports=http:$APP_PORT --zone=$ZONE --project=$PROJECT

# Health check
gcloud compute health-checks create http vaniai-http-health \
  --port=$APP_PORT --request-path=/ --project=$PROJECT 2>/dev/null || true

# Backend service
gcloud compute backend-services create vaniai-backend \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --protocol=HTTP \
  --port-name=http \
  --health-checks=vaniai-http-health \
  --global \
  --project=$PROJECT 2>/dev/null || true
gcloud compute backend-services add-backend vaniai-backend \
  --instance-group=vaniai-ig \
  --instance-group-zone=$ZONE \
  --global \
  --project=$PROJECT 2>/dev/null || true
```

If your LB uses **beta** (EXTERNAL_MANAGED), use `gcloud beta compute backend-services create` and `add-backend` instead of `gcloud compute`.

---

## 4. Add frontend + route: host vaniai.theaicompany.co → vaniai backend

Add a path matcher and host rule to your **existing URL map** so `vaniai.theaicompany.co` goes to the new backend. Replace `YOUR_URL_MAP_NAME` with the value from step 1.

```bash
gcloud compute url-maps add-path-matcher YOUR_URL_MAP_NAME \
  --path-matcher-name=vaniai-pm \
  --default-service=vaniai-backend \
  --new-hosts=vaniai.theaicompany.co \
  --global \
  --project=onlynereputation-agentic
```

---

## 5. Attach the new SSL cert to your existing HTTPS proxy

The target HTTPS proxy can have multiple SSL certificates. You must set the full list (existing certs **plus** the new one). Replace `YOUR_HTTPS_PROXY_NAME` with the value from step 1.

**Option A – Add new cert and keep existing certs (recommended)**

List current certs on the proxy:

```bash
gcloud compute target-https-proxies describe YOUR_HTTPS_PROXY_NAME \
  --global \
  --project=onlynereputation-agentic \
  --format="value(sslCertificates)"
```

Then update the proxy with **all** certs (existing comma-separated + new):

```bash
# Example if you currently have one cert: theaicompany-ssl
gcloud compute target-https-proxies update YOUR_HTTPS_PROXY_NAME \
  --ssl-certificates=theaicompany-ssl,vaniai-theaicompany-ssl \
  --global \
  --project=onlynereputation-agentic
```

If you use multiple existing certs, include every one plus `vaniai-theaicompany-ssl`.

**Option B – You use a single multi-domain cert**

If you prefer one cert for all `*.theaicompany.co`, create a new managed cert that includes vaniai and your other domains, then attach that single cert (or add vaniai to the existing cert and re-provision). Otherwise Option A is simpler.

---

## 6. DNS

Create an **A record** for `vaniai.theaicompany.co` pointing to your load balancer’s **existing frontend IP** (same IP as theaicompany.co / vani / spark / orm / onlynereputation).

No new IP is needed; the same LB frontend serves all hosts.

---

## 7. Verify

- **Cert status:**  
  `gcloud compute ssl-certificates describe vaniai-theaicompany-ssl --global --project=onlynereputation-agentic`  
  Wait until status is **ACTIVE**.
- **Backend health:** In Console, open your load balancer → backends and confirm `vaniai-backend` is healthy.
- **Browser:** Open `https://vaniai.theaicompany.co` and confirm it hits the app on chroma-vm:3100.

---

## Summary

| What | Name / value |
|------|-------------------|
| New SSL cert | `vaniai-theaicompany-ssl` (domain: vaniai.theaicompany.co) |
| New backend service | `vaniai-backend` (port 3100 via port-name `http-vaniai`) |
| Instance group | **Existing** `rag-ig` (named port `http-vaniai:3100` added; chroma-vm stays in one group) |
| New health check | `vaniai-http-health` (port 3100, path /) |
| URL map (rag-map) | Host `vaniai.theaicompany.co` → path matcher `vaniai-pm` → `vaniai-backend` |
| HTTPS proxy (rag-https-proxy) | Cert `vaniai-theaicompany-ssl` added to existing cert list |

**Note:** chroma-vm can belong to only one instance group. So vaniai uses the same instance group as your other apps (`rag-ig`) with an additional named port `http-vaniai:3100`. No separate instance group for vaniai.

---

## Troubleshooting "Server Error" / 502

If the site returns "The server encountered a temporary error" or 502:

1. **Firewall on the right VPC**  
   The VM is on **chroma-vpc**, not `default`. Health-check traffic must be allowed on that network:
   ```bash
   gcloud compute firewall-rules create vaniai-fw-health-check-vpc \
     --network=chroma-vpc --action=allow --direction=ingress \
     "--source-ranges=130.211.0.0/22,35.191.0.0/16" \
     --target-tags=allow-health-check --rules=tcp:3100 \
     --project=onlynereputation-agentic
   ```
   Ensure `chroma-vm` has tag `allow-health-check`.

2. **Health check path**  
   The backend health check uses **`/api/health`** (returns 200). The app exposes `GET /api/health` for this.

3. **Backend health in Console**  
   In **Network services → Load balancing → your LB → Backend configuration**, confirm `vaniai-backend` shows as **Healthy**. If it stays unhealthy, the LB will not send traffic and may return 502.
