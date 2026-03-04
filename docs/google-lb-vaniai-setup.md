# Google Cloud Load Balancer – https://vaniai.theaicompany.co

This guide sets up a **global external Application Load Balancer** with:

- **Frontend:** `https://vaniai.theaicompany.co` with a **Google-managed SSL certificate**
- **Backend:** Your existing VM `chroma-vm` (app on port **3100**)
- **Route:** All traffic to that backend

---

## Prerequisites

- **Project:** `onlynereputation-agentic`
- **Zone:** `asia-south1-a`
- **VM:** `chroma-vm` (Vani AI app in Docker on port 3100)
- **Domain:** `vaniai.theaicompany.co` – you must be able to set DNS (A/CNAME) to point to the LB IP (done in Step 7).

---

## 1. Reserve a static IP (for the LB frontend)

```bash
gcloud compute addresses create vaniai-lb-ip \
  --ip-version=IPV4 \
  --network-tier=PREMIUM \
  --global \
  --project=onlynereputation-agentic
```

Get the IP (you’ll use it for DNS in Step 7):

```bash
gcloud compute addresses describe vaniai-lb-ip \
  --format="get(address)" \
  --global \
  --project=onlynereputation-agentic
```

---

## 2. Create Google-managed SSL certificate

```bash
gcloud compute ssl-certificates create vaniai-ssl-cert \
  --description="Vani AI - vaniai.theaicompany.co" \
  --domains=vaniai.theaicompany.co \
  --global \
  --project=onlynereputation-agentic
```

Certificate will stay **PROVISIONING** until the domain points to the LB IP and Google can validate it (often 15–60 minutes).

---

## 3. Allow health checks and HTTPS from the LB to your VM

Use **one** of the following.

**Option A – by network tag (recommended)**  
Tag the VM and allow health checks only for that tag:

```bash
# Add tag to chroma-vm (if not already present)
gcloud compute instances add-tags chroma-vm \
  --zone=asia-south1-a \
  --tags=allow-health-check \
  --project=onlynereputation-agentic

# Firewall: health checks (IPv4) – port 3100
gcloud compute firewall-rules create vaniai-fw-allow-health-check \
  --network=default \
  --action=allow \
  --direction=ingress \
  --source-ranges=130.211.0.0/22,35.191.0.0/16 \
  --target-tags=allow-health-check \
  --rules=tcp:3100 \
  --project=onlynereputation-agentic
```

**Option B – allow health-check ranges to all VMs in the network**

```bash
gcloud compute firewall-rules create vaniai-fw-allow-health-check \
  --network=default \
  --action=allow \
  --direction=ingress \
  --source-ranges=130.211.0.0/22,35.191.0.0/16 \
  --rules=tcp:3100 \
  --project=onlynereputation-agentic
```

---

## 4. Unmanaged instance group + add chroma-vm

```bash
# Create unmanaged instance group in the same zone as chroma-vm
gcloud compute instance-groups unmanaged create vaniai-ig \
  --zone=asia-south1-a \
  --project=onlynereputation-agentic

# Add chroma-vm to the group
gcloud compute instance-groups unmanaged add-instances vaniai-ig \
  --instances=chroma-vm \
  --zone=asia-south1-a \
  --project=onlynereputation-agentic

# Named port for app (port 3100)
gcloud compute instance-groups unmanaged set-named-ports vaniai-ig \
  --named-ports=http:3100 \
  --zone=asia-south1-a \
  --project=onlynereputation-agentic
```

---

## 5. Health check and backend service

```bash
# HTTP health check on port 3100 (use / or /api/health if you have one)
gcloud compute health-checks create http vaniai-http-health-check \
  --port=3100 \
  --request-path=/ \
  --project=onlynereputation-agentic

# Backend service (global external Application LB; beta for EXTERNAL_MANAGED)
gcloud beta compute backend-services create vaniai-backend-service \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --protocol=HTTP \
  --port-name=http \
  --health-checks=vaniai-http-health-check \
  --global \
  --project=onlynereputation-agentic

# Attach instance group to backend
gcloud compute backend-services add-backend vaniai-backend-service \
  --instance-group=vaniai-ig \
  --instance-group-zone=asia-south1-a \
  --global \
  --project=onlynereputation-agentic
```

---

## 6. URL map, HTTPS proxy, forwarding rule (frontend + route)

```bash
# URL map: all traffic → vaniai backend (beta for EXTERNAL_MANAGED)
gcloud beta compute url-maps create vaniai-url-map \
  --default-service=vaniai-backend-service \
  --project=onlynereputation-agentic

# Target HTTPS proxy (binds URL map + SSL cert)
gcloud beta compute target-https-proxies create vaniai-https-proxy \
  --url-map=vaniai-url-map \
  --ssl-certificates=vaniai-ssl-cert \
  --project=onlynereputation-agentic

# Frontend: global forwarding rule (HTTPS 443) using reserved IP
gcloud beta compute forwarding-rules create vaniai-https-rule \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --network-tier=PREMIUM \
  --address=vaniai-lb-ip \
  --global \
  --target-https-proxy=vaniai-https-proxy \
  --ports=443 \
  --project=onlynereputation-agentic
```

Optional: redirect HTTP → HTTPS (same IP, port 80):

```bash
gcloud compute url-maps import vaniai-url-map \
  --source=/dev/stdin \
  --global \
  --project=onlynereputation-agentic <<'EOF'
name: vaniai-url-map
defaultService: projects/onlynereputation-agentic/global/backendServices/vaniai-backend-service
defaultRouteAction:
  urlRedirect:
    redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
    httpsRedirect: true
EOF
```

(If you prefer not to touch the URL map, you can skip the redirect and only use HTTPS.)

---

## 7. DNS for vaniai.theaicompany.co

Point the domain to the LB IP from Step 1:

- **A record:** `vaniai.theaicompany.co` → `<vaniai-lb-ip>`

After DNS propagates, the Google-managed certificate will move from PROVISIONING to **ACTIVE** (can take up to ~60 minutes).

---

## 8. Verify

- **Certificate:**  
  `gcloud compute ssl-certificates describe vaniai-ssl-cert --global --project=onlynereputation-agentic`
- **Backend health:**  
  In Console: **Network services → Load balancing → vaniai-url-map (or backend)** and check backend health.
- **Browser:**  
  Open `https://vaniai.theaicompany.co` and confirm it serves your app.

---

## Summary

| Component        | Name                     | Purpose                          |
|-----------------|--------------------------|----------------------------------|
| Static IP       | `vaniai-lb-ip`           | Frontend IP for DNS              |
| SSL certificate | `vaniai-ssl-cert`        | HTTPS for vaniai.theaicompany.co |
| Firewall        | `vaniai-fw-allow-health-check` | Health checks to port 3100 |
| Instance group  | `vaniai-ig`             | Contains chroma-vm               |
| Health check    | `vaniai-http-health-check` | HTTP on 3100, path /           |
| Backend service | `vaniai-backend-service`| Sends traffic to vaniai-ig       |
| URL map         | `vaniai-url-map`        | Route → backend                  |
| HTTPS proxy     | `vaniai-https-proxy`    | URL map + SSL cert               |
| Forwarding rule | `vaniai-https-rule`     | 443 → HTTPS proxy                |

To re-run everything in one go (after editing project/zone/VM if needed), use the script `scripts/setup-google-lb-vaniai.sh` from the repo root or `docs/` as described in the script header.
