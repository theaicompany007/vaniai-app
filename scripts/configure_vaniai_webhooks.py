#!/usr/bin/env python3
"""
Vani AI Sales Intelligence — Webhook Configurator

Registers / updates webhook endpoints in:
  1. Razorpay  — /api/billing/webhook  (subscription events)
  2. Resend    — /api/webhooks/resend  (email delivery events, optional)

Mirrors vani's scripts/configure_webhooks.py pattern.

Usage:
    python scripts/configure_vaniai_webhooks.py --app-url https://vaniai.ngrok.app
    python scripts/configure_vaniai_webhooks.py  # reads NEXT_PUBLIC_APP_URL from .env.local

Requires in .env.local:
    RAZORPAY_KEY_ID=rzp_test_...
    RAZORPAY_KEY_SECRET=...
    RAZORPAY_WEBHOOK_SECRET=...
    RESEND_API_KEY=re_...              (optional — Resend webhooks)
    NEXT_PUBLIC_APP_URL=https://vaniai.ngrok.app
"""

import os
import sys
import json
import base64
import argparse
import urllib.request
import urllib.error
from pathlib import Path


# ──────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────

APP_DIR  = Path(__file__).resolve().parent.parent
APP_NAME = "Vani AI Sales Intelligence"

RAZORPAY_EVENTS = [
    "subscription.activated",
    "subscription.charged",
    "subscription.cancelled",
    "subscription.halted",
    "payment.captured",
    "payment.failed",
    "refund.created",
]

RESEND_EVENTS = [
    "email.sent",
    "email.delivered",
    "email.bounced",
    "email.complained",
]


# ──────────────────────────────────────────────────────────────────
# Colours
# ──────────────────────────────────────────────────────────────────

class C:
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"

def ok(msg):   print(f"{C.GREEN}  [OK] {msg}{C.RESET}")
def warn(msg): print(f"{C.YELLOW}  [!]  {msg}{C.RESET}")
def err(msg):  print(f"{C.RED}  [X]  {msg}{C.RESET}")
def info(msg): print(f"       {msg}")
def section(title): print(f"\n{C.CYAN}{C.BOLD}  -- {title} {'-'*(50-len(title))}{C.RESET}")


# ──────────────────────────────────────────────────────────────────
# Env loading
# ──────────────────────────────────────────────────────────────────

def load_env_file(filepath: Path) -> dict:
    env = {}
    if not filepath.is_file():
        return env
    for line in filepath.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def load_env() -> dict:
    env = {}
    for fname in (".env", ".env.local"):
        env.update(load_env_file(APP_DIR / fname))
    env.update(os.environ)
    return env


# ──────────────────────────────────────────────────────────────────
# HTTP helpers
# ──────────────────────────────────────────────────────────────────

def http(method: str, url: str, headers: dict, data: dict | None = None) -> tuple[int, dict]:
    payload = json.dumps(data).encode() if data else None
    base_headers = {"User-Agent": "vaniai-app/1.0", "Accept": "application/json"}
    base_headers.update(headers)
    req = urllib.request.Request(url, data=payload, headers=base_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, (json.loads(body) if body.strip() else {})
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"message": body}
    except Exception as e:
        return 0, {"message": str(e)}


# ──────────────────────────────────────────────────────────────────
# Razorpay webhook
# ──────────────────────────────────────────────────────────────────

def razorpay_basic_auth(key_id: str, key_secret: str) -> str:
    token = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
    return f"Basic {token}"


def configure_razorpay_webhook(
    key_id: str,
    key_secret: str,
    webhook_secret: str,
    webhook_url: str,
) -> bool:
    section("Razorpay Webhook")
    info(f"Webhook URL : {webhook_url}")
    info(f"Events      : {', '.join(RAZORPAY_EVENTS)}")

    auth = razorpay_basic_auth(key_id, key_secret)
    headers = {"Authorization": auth, "Content-Type": "application/json"}

    # List existing webhooks
    status, resp = http("GET", "https://api.razorpay.com/v1/webhooks", headers)
    if status not in (200, 201):
        warn(f"Could not list webhooks (HTTP {status}): {resp.get('error', {}).get('description', resp)}")
        warn("You may need to add the webhook manually in Razorpay Dashboard.")
        _print_razorpay_manual(webhook_url, webhook_secret)
        return False

    items = resp.get("items", [])
    existing = next((w for w in items if webhook_url in w.get("url", "")), None)

    events_payload = {e: True for e in RAZORPAY_EVENTS}

    if existing:
        wh_id = existing["id"]
        # Razorpay API does not support PATCH for webhooks — treat existing as already configured
        ok(f"Razorpay webhook already configured (ID: {wh_id})")
        info(f"URL    : {existing.get('url', webhook_url)}")
        info(f"Active : {existing.get('active', '?')}")
        info("To update manually: https://dashboard.razorpay.com/app/webhooks")
        return True
    else:
        info("No existing webhook found — creating...")
        payload = {
            "url": webhook_url,
            "alert_email": "admin@kcube-consulting.com",
            "secret": webhook_secret,
            "active": True,
            "events": events_payload,
        }
        status, resp = http("POST", "https://api.razorpay.com/v1/webhooks", headers, payload)
        if status in (200, 201):
            wh_id = resp.get("id", "?")
            ok(f"Razorpay webhook created (ID: {wh_id})")
            return True
        else:
            err(f"Create failed (HTTP {status}): {resp.get('error', {}).get('description', resp)}")
            _print_razorpay_manual(webhook_url, webhook_secret)
            return False


def _print_razorpay_manual(webhook_url: str, webhook_secret: str):
    warn("Manual setup: https://dashboard.razorpay.com/app/webhooks")
    info(f"  URL    : {webhook_url}")
    info(f"  Secret : {webhook_secret}")
    info(f"  Events : {', '.join(RAZORPAY_EVENTS)}")


# ──────────────────────────────────────────────────────────────────
# Resend webhook
# ──────────────────────────────────────────────────────────────────

def configure_resend_webhook(api_key: str, webhook_url: str) -> bool:
    section("Resend Webhook (email delivery tracking — optional)")
    info(f"Webhook URL : {webhook_url}")
    info(f"Events      : {', '.join(RESEND_EVENTS)}")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # List existing webhooks
    status, resp = http("GET", "https://api.resend.com/webhooks", headers)
    if status not in (200, 201):
        warn(f"Could not list Resend webhooks (HTTP {status}): {resp.get('message', resp)}")
        _print_resend_manual(webhook_url)
        return False

    items = resp.get("data", [])
    existing = next((w for w in items if webhook_url in w.get("url", "")), None)

    if existing:
        wh_id = existing.get("id", "?")
        info(f"Webhook {wh_id} already exists for this URL.")
        ok("Resend webhook already configured")
        return True
    else:
        info("No existing webhook — creating...")
        # Resend API v1: POST /webhooks
        # Field is "endpoint" (not "url"), events is array of strings
        payload = {
            "endpoint": webhook_url,
            "events": RESEND_EVENTS,
        }
        status, resp = http("POST", "https://api.resend.com/webhooks", headers, payload)
        if status in (200, 201):
            wh_id = resp.get("id", "?")
            ok(f"Resend webhook created (ID: {wh_id})")
            return True
        else:
            err(f"Create failed (HTTP {status}): {resp.get('message', resp)}")
            _print_resend_manual(webhook_url)
            return False


def _print_resend_manual(webhook_url: str):
    warn("Manual setup: https://resend.com/webhooks")
    info(f"  URL    : {webhook_url}")
    info(f"  Events : {', '.join(RESEND_EVENTS)}")


# ──────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=f"{APP_NAME} — Webhook Configurator (Razorpay + Resend)"
    )
    parser.add_argument("--app-url", help="Public app base URL (e.g. https://vaniai.ngrok.app)")
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--skip-resend", action="store_true", help="Skip Resend webhook setup")
    args = parser.parse_args()

    print()
    print(f"{C.CYAN}{C.BOLD}{'='*68}{C.RESET}".replace("─", "-"))
    print(f"{C.CYAN}{C.BOLD}  {APP_NAME} — Webhook Configurator{C.RESET}")
    print(f"{C.CYAN}{C.BOLD}{'='*68}{C.RESET}".replace("─", "-"))

    env_file = Path(args.env_file)
    if not env_file.is_absolute():
        env_file = APP_DIR / env_file
    env = load_env_file(env_file)
    env.update(os.environ)

    app_url = (args.app_url or env.get("NEXT_PUBLIC_APP_URL", "")).rstrip("/")
    if not app_url:
        err("NEXT_PUBLIC_APP_URL not set. Pass --app-url https://vaniai.ngrok.app")
        sys.exit(1)
    if not app_url.startswith("http"):
        app_url = f"https://{app_url}"

    razorpay_key_id     = env.get("RAZORPAY_KEY_ID", "")
    razorpay_key_secret = env.get("RAZORPAY_KEY_SECRET", "")
    razorpay_wh_secret  = env.get("RAZORPAY_WEBHOOK_SECRET", "")
    resend_api_key      = env.get("RESEND_API_KEY", "")

    razorpay_webhook_url = f"{app_url}/api/billing/webhook"
    resend_webhook_url   = f"{app_url}/api/webhooks/resend"

    print()
    info(f"App URL : {app_url}")
    print()

    results = {}

    # ── Razorpay
    if razorpay_key_id and razorpay_key_secret:
        results["razorpay"] = configure_razorpay_webhook(
            razorpay_key_id, razorpay_key_secret, razorpay_wh_secret, razorpay_webhook_url
        )
    else:
        section("Razorpay Webhook")
        warn("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — skipping")
        warn(f"Add webhook manually: https://dashboard.razorpay.com/app/webhooks")
        info(f"  URL    : {razorpay_webhook_url}")
        info(f"  Secret : {razorpay_wh_secret or '<RAZORPAY_WEBHOOK_SECRET>'}")
        results["razorpay"] = False

    # ── Resend
    if not args.skip_resend and resend_api_key:
        results["resend"] = configure_resend_webhook(resend_api_key, resend_webhook_url)
    else:
        section("Resend Webhook (email delivery tracking — optional)")
        if args.skip_resend:
            warn("Skipped (--skip-resend)")
        else:
            warn("RESEND_API_KEY not set — skipping")
        warn(f"Add webhook manually: https://resend.com/webhooks")
        info(f"  URL    : {resend_webhook_url}")
        info(f"  Events : {', '.join(RESEND_EVENTS)}")
        results["resend"] = None  # None = skipped (not failed)

    # ── Summary
    print()
    print(f"{C.CYAN}{C.BOLD}{'-'*68}{C.RESET}")
    print(f"{C.CYAN}{C.BOLD}  Summary{C.RESET}")
    print(f"{C.CYAN}{C.BOLD}{'-'*68}{C.RESET}")
    for svc, result in results.items():
        if result is True:
            ok(f"{svc:12} — configured")
        elif result is None:
            print(f"{C.YELLOW}  [--] {svc:12} — skipped{C.RESET}")
        else:
            err(f"{svc:12} — failed or needs manual setup")
    print()

    all_ok = all(v is not False for v in results.values())
    if all_ok:
        print(f"{C.GREEN}{C.BOLD}  Webhook configuration complete!{C.RESET}")
    else:
        print(f"{C.YELLOW}{C.BOLD}  Some webhooks need manual setup — see warnings above.{C.RESET}")
    print()

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
