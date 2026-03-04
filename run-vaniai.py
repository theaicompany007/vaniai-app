#!/usr/bin/env python3
"""
Vani AI Sales Intelligence — Startup Script.
Starts Next.js dev server on port 3100.
Optionally starts the ngrok tunnel (vaniai.ngrok.app) for Supabase
auth callbacks, Razorpay webhooks, and Resend email links.

Usage:
    python run-vaniai.py              # dev only (localhost:3100)
    python run-vaniai.py --tunnel     # dev + ngrok tunnel
    python run-vaniai.py --no-check-env --tunnel
    vaniai.bat --tunnel               # Windows shorthand
"""
import os
import sys
import argparse
import subprocess
import signal
import socket
import time
import json
from pathlib import Path
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

PROJECT_ROOT = Path(__file__).resolve().parent
DEV_PORT     = 3100
APP_NAME     = "Vani AI Sales Intelligence"
NGROK_DOMAIN = "https://vaniai.ngrok.app"
NGROK_CONFIG_NAMES = ("ngrok.yml", "ngrok.yaml")


# ──────────────────────────────────────────────────────────────────
# ENV
# ──────────────────────────────────────────────────────────────────

def load_env():
    if load_dotenv is None:
        return
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(PROJECT_ROOT / ".env.local", override=True)


# ──────────────────────────────────────────────────────────────────
# PROCESS CLEANUP
# ──────────────────────────────────────────────────────────────────

def kill_existing_processes():
    """Kill only the process on DEV_PORT. Leave ngrok running so other apps keep their tunnels."""
    print(f"[0/N] Cleaning up port {DEV_PORT}...")
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ["netstat", "-ano"], capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.split("\n"):
                if f":{DEV_PORT}" in line and "LISTENING" in line:
                    parts = line.split()
                    if parts:
                        pid = parts[-1]
                        try:
                            subprocess.run(
                                ["taskkill", "/F", "/PID", pid],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL,
                                timeout=3,
                            )
                            print(f"  [OK] Killed PID {pid} on port {DEV_PORT}")
                        except Exception:
                            pass
        else:
            result = subprocess.run(
                ["lsof", "-ti", f":{DEV_PORT}"], capture_output=True, text=True, timeout=5
            )
            for pid in result.stdout.strip().split("\n"):
                if pid:
                    subprocess.run(
                        ["kill", "-9", pid],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3,
                    )
                    print(f"  [OK] Killed PID {pid}")
    except Exception as e:
        print(f"  [!] Could not clean port {DEV_PORT}: {e}")
    time.sleep(1)


def cleanup_and_exit():
    print("\n[Ctrl+C] Shutting down...")
    kill_existing_processes()
    print("Done.")
    sys.exit(0)


# ──────────────────────────────────────────────────────────────────
# ENV CHECK
# ──────────────────────────────────────────────────────────────────

def check_environment():
    print("[1/N] Checking environment variables...")
    required = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
    ]
    optional = [
        "LLM_PROVIDER",
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "GOOGLE_GENERATIVE_AI_API_KEY",
        "PERPLEXITY_API_KEY",
        "RESEND_API_KEY",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
    ]
    missing = []
    for var in required:
        if not os.getenv(var):
            missing.append(var)
            print(f"  [X] {var}  <-- MISSING")
        else:
            print(f"  [OK] {var}")
    for var in optional:
        val = os.getenv(var)
        if val:
            print(f"  [OK] {var}")
        else:
            print(f"  [--] {var}  (optional)")
    if missing:
        print(f"\n[X] Missing required vars: {', '.join(missing)}")
        print("    Set them in kcube-app/.env.local (or vaniai-app/.env.local after rename)")
        return False
    print("[OK] Environment looks good\n")
    return True


# ──────────────────────────────────────────────────────────────────
# NGROK
# ──────────────────────────────────────────────────────────────────

def find_ngrok_config():
    for name in NGROK_CONFIG_NAMES:
        p = PROJECT_ROOT / name
        if p.is_file():
            return p
    return None


def start_ngrok_tunnel():
    """Start the 'vaniai' named tunnel from ngrok.yml. Returns subprocess or None."""
    config_path = find_ngrok_config()
    if not config_path:
        print("[!] ngrok.yml not found in project root. Skipping tunnel.")
        return None
    ngrok_cmd = "ngrok.exe" if sys.platform == "win32" else "ngrok"
    try:
        proc = subprocess.Popen(
            [ngrok_cmd, "start", "--config", str(config_path), "vaniai"],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )
        print(f"[OK] ngrok tunnel started → {NGROK_DOMAIN}")
        return proc
    except FileNotFoundError:
        print("[!] ngrok not found in PATH. Install from https://ngrok.com/download")
        return None
    except Exception as e:
        print(f"[!] Failed to start ngrok: {e}")
        return None


# ──────────────────────────────────────────────────────────────────
# WEBHOOK URLS BANNER
# ──────────────────────────────────────────────────────────────────

def print_webhook_urls(base_url: str):
    """Print the URLs that need to be configured in external dashboards."""
    print()
    print("  ┌─ Configure these URLs in external dashboards ──────────────────────┐")
    print(f"  │  Supabase → Auth → URL Configuration                               │")
    print(f"  │    Site URL:          {base_url:<46} │")
    print(f"  │    Redirect URLs:     {base_url}/auth/callback{'':<22} │")
    print(f"  │                       http://localhost:{DEV_PORT}/auth/callback{'':<14} │")
    print(f"  │  Razorpay → Webhooks                                               │")
    print(f"  │    Webhook URL:       {base_url}/api/billing/webhook{'':<19} │")
    print(f"  │  Resend → Email links use NEXT_PUBLIC_APP_URL (auto-set below)      │")
    print(f"  └────────────────────────────────────────────────────────────────────┘")
    print()


# ──────────────────────────────────────────────────────────────────
# HELP
# ──────────────────────────────────────────────────────────────────

def print_help():
    print(f"""
{APP_NAME} — Startup Script

USAGE:
    python run-vaniai.py [OPTIONS]
    vaniai.bat [OPTIONS]              (Windows shorthand)

OPTIONS:
    --help, -h          Show this help and exit
    --tunnel, -t        Start the ngrok tunnel (vaniai.ngrok.app → localhost:{DEV_PORT})
    --configure, -c     Run post-deploy configuration (Supabase + Razorpay + Resend) then exit
    --no-check-env      Skip environment variable check

WHAT IT DOES:
    1. Kills any existing process on port {DEV_PORT}
    2. Checks required env vars in .env.local
    3. Optionally starts ngrok tunnel (vaniai.ngrok.app)
    4. Sets NEXT_PUBLIC_APP_URL dynamically:
         with tunnel  →  https://vaniai.ngrok.app
         without      →  http://localhost:{DEV_PORT}
    5. Starts Next.js dev server on port {DEV_PORT}
    6. Prints Supabase / Razorpay / Resend webhook URLs to configure

POST-DEPLOY CONFIGURATION:
    After starting the tunnel, run once to register the ngrok URL in dashboards:
        vaniai.bat --configure                     # uses NEXT_PUBLIC_APP_URL from .env.local
        vaniai.bat --configure https://vaniai.ngrok.app

    This calls update-vaniai-supabase-auth.py + scripts/configure_vaniai_webhooks.py.
    Requires SUPABASE_ACCESS_TOKEN (sbp_...) in .env.local.

REQUIRED ENV VARS (.env.local):
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY

OPTIONAL:
    LLM_PROVIDER          anthropic | openai | gemini  (default: anthropic)
    ANTHROPIC_API_KEY
    OPENAI_API_KEY
    GOOGLE_GENERATIVE_AI_API_KEY
    PERPLEXITY_API_KEY    (for Vigil + Vivek agents — web search)
    RESEND_API_KEY
    RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET  (set RAZORPAY_DUMMY=true for dev)
    SUPABASE_ACCESS_TOKEN (sbp_... — needed for --configure only)

NGROK:
    Domain: vaniai.ngrok.app  (ID: rd_3AKkkxzXWEHF8xT1gql0l45Ikc3)
    Config: ngrok.yml in project root
    The script starts only the 'vaniai' tunnel; vani Flask (vani.ngrok.app) is untouched.

EXAMPLES:
    vaniai.bat                                  # localhost only
    vaniai.bat --tunnel                         # dev + ngrok tunnel
    vaniai.bat --tunnel --no-check-env
    vaniai.bat --configure                      # register ngrok URL in all dashboards
    vaniai.bat --configure https://vaniai.ngrok.app
""")
    sys.exit(0)


# ──────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────

def main():
    load_env()

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--help", "-h", action="store_true")
    parser.add_argument("--tunnel", "-t", action="store_true")
    parser.add_argument("--configure", "-c", action="store_true",
                        help="Run post-deploy config (Supabase + Razorpay + Resend) then exit")
    parser.add_argument("--no-check-env", action="store_true")
    # Positional-ish: optional app URL when using --configure
    parser.add_argument("app_url", nargs="?", default=None,
                        help="Public app URL for --configure (e.g. https://vaniai.ngrok.app)")
    args = parser.parse_args()

    if args.help:
        print_help()

    # ── configure mode: update Supabase + webhooks then exit ──────────────
    if args.configure:
        print()
        print("=" * 70)
        print(f"  {APP_NAME} — Post-Deploy Configuration")
        print("=" * 70)
        print()
        configure_url = args.app_url or os.getenv("NEXT_PUBLIC_APP_URL", "")
        if not configure_url:
            print("[X] No app URL. Pass it as argument or set NEXT_PUBLIC_APP_URL in .env.local")
            print(f"    Example: vaniai.bat --configure https://vaniai.ngrok.app")
            sys.exit(1)

        overall_ok = True

        # Step 1: Supabase Auth
        print("[1/2] Updating Supabase Auth (Site URL + Redirect URLs)...", flush=True)
        r1 = subprocess.run(
            [sys.executable, "update-vaniai-supabase-auth.py",
             "--app-url", configure_url, "--env-file", ".env.local"],
            cwd=str(PROJECT_ROOT),
        )
        if r1.returncode != 0:
            overall_ok = False

        print()

        # Step 2: Razorpay + Resend Webhooks
        print("[2/2] Configuring webhooks (Razorpay + Resend)...", flush=True)
        r2 = subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "scripts" / "configure_vaniai_webhooks.py"),
             "--app-url", configure_url, "--env-file", ".env.local"],
            cwd=str(PROJECT_ROOT),
        )
        if r2.returncode != 0:
            overall_ok = False

        print()
        print("=" * 70)
        if overall_ok:
            print(f"  [OK] All configurations applied for: {configure_url}")
        else:
            print(f"  [!]  Some steps failed — check output above")
        print("=" * 70)
        sys.exit(0 if overall_ok else 1)

    print()
    print("=" * 70)
    print(f"  {APP_NAME} — Startup")
    print("=" * 70)
    print()

    kill_existing_processes()

    if not args.no_check_env:
        if not check_environment():
            print("[X] Fix missing vars or run with --no-check-env")
            sys.exit(1)

    # Start tunnel
    if args.tunnel:
        start_ngrok_tunnel()
        time.sleep(1)

    # Set NEXT_PUBLIC_APP_URL dynamically so auth callbacks and email links are correct
    if args.tunnel:
        app_url = NGROK_DOMAIN
    else:
        app_url = f"http://localhost:{DEV_PORT}"

    os.environ["NEXT_PUBLIC_APP_URL"] = app_url
    print(f"  NEXT_PUBLIC_APP_URL → {app_url}")

    print_webhook_urls(app_url)

    print(f"Starting Next.js dev server on port {DEV_PORT}...")
    print(f"  Local:   http://localhost:{DEV_PORT}")
    if args.tunnel:
        print(f"  Public:  {NGROK_DOMAIN}")
    print()

    try:
        signal.signal(signal.SIGINT, lambda _s, _f: cleanup_and_exit())
    except (ValueError, OSError):
        pass

    try:
        subprocess.run(
            ["npm", "run", "dev"],
            cwd=str(PROJECT_ROOT),
            shell=(sys.platform == "win32"),
        )
    except KeyboardInterrupt:
        cleanup_and_exit()

    sys.exit(0)


if __name__ == "__main__":
    main()
