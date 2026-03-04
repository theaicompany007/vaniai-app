#!/usr/bin/env python3
"""
Vani AI Sales Intelligence — Supabase Auth Configuration Updater

Updates Supabase Auth (Site URL + Redirect URLs) for vaniai-app via the
Supabase Management API. Mirrors vani's update-vani-supabase-auth.py.

Usage:
    # With ngrok tunnel active (dev)
    python update-vaniai-supabase-auth.py --app-url https://vaniai.ngrok.app

    # Production (Docker / GCP)
    python update-vaniai-supabase-auth.py --app-url https://your-production-domain.com

    # Auto-detect from .env.local NEXT_PUBLIC_APP_URL
    python update-vaniai-supabase-auth.py

Requires in .env.local:
    NEXT_PUBLIC_SUPABASE_URL=https://ooqrhtrnnsoxmvcnywua.supabase.co
    SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    NEXT_PUBLIC_APP_URL=https://vaniai.ngrok.app   (or pass --app-url)

Get your personal access token from:
    https://supabase.com/dashboard/account/tokens
"""

import os
import sys
import json
import re
import argparse
import urllib.request
import urllib.error
from pathlib import Path


# ──────────────────────────────────────────────────────────────────
# App Constants
# ──────────────────────────────────────────────────────────────────

APP_NAME    = "Vani AI Sales Intelligence"
APP_PORT    = 3100
APP_DIR     = Path(__file__).resolve().parent

# Redirect URLs always included regardless of app URL
STATIC_REDIRECT_URLS = [
    f"http://localhost:{APP_PORT}",
    f"http://localhost:{APP_PORT}/auth/callback",
]


# ──────────────────────────────────────────────────────────────────
# Color helpers
# ──────────────────────────────────────────────────────────────────

class C:
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    RESET  = "\033[0m"

def ok(msg):   print(f"{C.GREEN}  [OK] {msg}{C.RESET}")
def warn(msg): print(f"{C.YELLOW}  [!]  {msg}{C.RESET}")
def err(msg):  print(f"{C.RED}  [X]  {msg}{C.RESET}")
def info(msg): print(f"{C.CYAN}  {msg}{C.RESET}")


# ──────────────────────────────────────────────────────────────────
# Env loading
# ──────────────────────────────────────────────────────────────────

def load_env_file(filepath: Path) -> dict:
    """Load key=value pairs from an env file, ignoring comments."""
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
    """Load .env then .env.local (override), merge with os.environ."""
    env = {}
    for fname in (".env", ".env.local"):
        fpath = APP_DIR / fname
        env.update(load_env_file(fpath))
    # os.environ wins (export VAR=... in shell overrides file)
    env.update({k: v for k, v in os.environ.items() if k in env or k.startswith("SUPABASE") or k.startswith("NEXT_PUBLIC")})
    return env


# ──────────────────────────────────────────────────────────────────
# Supabase Management API
# ──────────────────────────────────────────────────────────────────

def get_project_ref(supabase_url: str) -> str | None:
    match = re.match(r"https://([^.]+)\.supabase\.co", supabase_url)
    return match.group(1) if match else None


def build_redirect_urls(app_url: str) -> list[str]:
    """Build the full redirect URL allow-list for vaniai-app."""
    app_url = app_url.rstrip("/")
    urls = list(STATIC_REDIRECT_URLS)  # always include localhost
    # Add the live app URLs (ngrok or production)
    if app_url not in urls:
        urls.append(app_url)
    callback = f"{app_url}/auth/callback"
    if callback not in urls:
        urls.append(callback)
    return list(dict.fromkeys(urls))  # dedupe, preserve order


def update_supabase_auth(
    supabase_url: str,
    access_token: str,
    app_url: str,
) -> tuple[bool, str, list[str]]:
    """PATCH /v1/projects/{ref}/config/auth via Supabase Management API."""
    project_ref = get_project_ref(supabase_url)
    if not project_ref:
        return False, "Invalid NEXT_PUBLIC_SUPABASE_URL format (expected https://xxx.supabase.co)", []

    redirect_urls = build_redirect_urls(app_url)
    payload = json.dumps({
        "site_url": app_url,
        "uri_allow_list": ",".join(redirect_urls),
        # Disable email confirmation for dev (users get a session immediately on signup)
        # Set to false in production when you want email verification
        "mailer_autoconfirm": True,
    }).encode("utf-8")

    api_url = f"https://api.supabase.com/v1/projects/{project_ref}/config/auth"
    req = urllib.request.Request(
        api_url,
        data=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "User-Agent": "vaniai-app/1.0",
            "Accept": "application/json",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
            return True, "Updated successfully", redirect_urls
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            msg = json.loads(body).get("message", body)
        except Exception:
            msg = body
        return False, f"HTTP {e.code}: {msg}", []
    except Exception as e:
        return False, str(e), []


# ──────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=f"{APP_NAME} — Supabase Auth Configuration Updater",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--app-url",
        help=f"Public app URL (default: NEXT_PUBLIC_APP_URL from .env.local, e.g. https://vaniai.ngrok.app)",
    )
    parser.add_argument(
        "--env-file",
        default=".env.local",
        help="Path to env file (default: .env.local in project root)",
    )
    args = parser.parse_args()

    print()
    print(f"{C.BLUE}{C.BOLD}{'='*68}{C.RESET}")
    print(f"{C.BLUE}{C.BOLD}  {APP_NAME}{C.RESET}")
    print(f"{C.BLUE}{C.BOLD}  Supabase Auth Configuration Updater{C.RESET}")
    print(f"{C.BLUE}{C.BOLD}{'='*68}{C.RESET}")
    print()

    # Load env
    env_file = Path(args.env_file)
    if not env_file.is_absolute():
        env_file = APP_DIR / env_file
    env = load_env_file(env_file)
    env.update({k: v for k, v in os.environ.items()})

    # Resolve required vars
    supabase_url  = env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL", "")
    access_token  = env.get("SUPABASE_ACCESS_TOKEN", "")
    app_url       = args.app_url or env.get("NEXT_PUBLIC_APP_URL", "")

    # Validate
    missing = []
    if not supabase_url:
        missing.append("NEXT_PUBLIC_SUPABASE_URL")
    if not access_token:
        missing.append("SUPABASE_ACCESS_TOKEN  (get from https://supabase.com/dashboard/account/tokens)")
    if not app_url:
        missing.append("NEXT_PUBLIC_APP_URL (or pass --app-url https://vaniai.ngrok.app)")
    if missing:
        err("Missing required variables:")
        for m in missing:
            print(f"       {m}")
        print()
        warn(f"Add them to {env_file} and re-run.")
        sys.exit(1)

    # Ensure https for non-localhost URLs
    if not app_url.startswith("http"):
        app_url = f"https://{app_url}"
    app_url = app_url.rstrip("/")

    project_ref = get_project_ref(supabase_url)
    redirect_urls = build_redirect_urls(app_url)

    info(f"Supabase project : {project_ref}")
    info(f"Site URL         : {C.BOLD}{app_url}{C.RESET}")
    info(f"Redirect URLs    : ({len(redirect_urls)} total)")
    for i, u in enumerate(redirect_urls, 1):
        print(f"     {i:>2}. {u}")
    print()

    print(f"{C.CYAN}  Calling Supabase Management API...{C.RESET}")
    success, message, updated = update_supabase_auth(supabase_url, access_token, app_url)
    print()

    if success:
        ok(f"Site URL set to: {app_url}")
        ok(f"Redirect URLs updated ({len(updated)} entries)")
        print()
        print(f"{C.GREEN}{C.BOLD}  Supabase Auth configuration updated successfully!{C.RESET}")
        print()
        info(f"Verify at: https://supabase.com/dashboard/project/{project_ref}/auth/url-configuration")
    else:
        err(f"Update failed: {message}")
        print()
        warn("You can also update manually in the Supabase dashboard:")
        print(f"       https://supabase.com/dashboard/project/{project_ref}/auth/url-configuration")
        print()
        warn("Manual values:")
        print(f"       Site URL:  {app_url}")
        print(f"       Redirect URLs:")
        for u in redirect_urls:
            print(f"         - {u}")
        print()
        sys.exit(1)

    print()


if __name__ == "__main__":
    main()
