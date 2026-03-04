#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Vani AI Sales Intelligence — Post-Deploy Configuration Script
#
# Updates external service configurations after deployment or tunnel start:
#   1. Supabase Auth  — Site URL + Redirect URLs  (auth callback)
#   2. Razorpay       — Webhook URL               (/api/billing/webhook)
#   3. Resend         — Webhook URL               (/api/webhooks/resend)
#
# Mirrors: vani/supabase_post_deploy.sh
#
# Usage:
#   ./vaniai_post_deploy.sh                         # reads NEXT_PUBLIC_APP_URL from .env.local
#   ./vaniai_post_deploy.sh https://vaniai.ngrok.app
#   ./vaniai_post_deploy.sh https://your-prod.com --skip-resend
#
# Called automatically by vaniai.bat --configure
# Run manually after: vaniai.bat --tunnel (to register ngrok URL in dashboards)
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}${BOLD}  Vani AI Sales Intelligence — Post-Deploy Configuration${NC}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Load .env.local ────────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
    echo -e "${RED}[X] .env.local not found in $(pwd)${NC}"
    exit 1
fi

echo -e "${YELLOW}  Loading .env.local...${NC}"
set -a
source .env.local
set +a

# ── Resolve APP_URL ────────────────────────────────────────────────────────
APP_URL="${1:-$NEXT_PUBLIC_APP_URL}"
if [ -z "$APP_URL" ]; then
    echo -e "${RED}[X] No app URL. Pass it as first argument or set NEXT_PUBLIC_APP_URL in .env.local${NC}"
    echo -e "${YELLOW}    Example: ./vaniai_post_deploy.sh https://vaniai.ngrok.app${NC}"
    exit 1
fi
# Strip trailing slash
APP_URL="${APP_URL%/}"

SKIP_RESEND="${2:-}"

echo ""
echo -e "  ${CYAN}App URL : ${BOLD}${APP_URL}${NC}"
echo ""

SUPABASE_OK=0
WEBHOOK_OK=0

# ── Step 1: Supabase Auth ──────────────────────────────────────────────────
echo -e "${YELLOW}  [1/2] Updating Supabase Auth configuration...${NC}"
if python update-vaniai-supabase-auth.py --app-url "$APP_URL" --env-file .env.local; then
    echo -e "${GREEN}  [OK] Supabase Auth updated${NC}"
    SUPABASE_OK=1
else
    echo -e "${RED}  [X]  Supabase Auth update failed (see output above)${NC}"
    echo -e "${YELLOW}        Ensure SUPABASE_ACCESS_TOKEN (sbp_...) is set in .env.local${NC}"
    echo -e "${YELLOW}        Get token: https://supabase.com/dashboard/account/tokens${NC}"
fi

echo ""

# ── Step 2: Razorpay + Resend Webhooks ────────────────────────────────────
echo -e "${YELLOW}  [2/2] Configuring webhooks (Razorpay + Resend)...${NC}"
WEBHOOK_ARGS="--app-url $APP_URL --env-file .env.local"
if [ "$SKIP_RESEND" = "--skip-resend" ]; then
    WEBHOOK_ARGS="$WEBHOOK_ARGS --skip-resend"
fi

if python scripts/configure_vaniai_webhooks.py $WEBHOOK_ARGS; then
    echo -e "${GREEN}  [OK] Webhooks configured${NC}"
    WEBHOOK_OK=1
else
    echo -e "${YELLOW}  [!]  Some webhooks may need manual setup (see output above)${NC}"
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Supabase Auth  : $([ $SUPABASE_OK -eq 1 ] && echo -e "${GREEN}[OK]${NC}" || echo -e "${RED}[FAILED]${NC}")"
echo -e "  Webhooks       : $([ $WEBHOOK_OK -eq 1 ] && echo -e "${GREEN}[OK]${NC}" || echo -e "${YELLOW}[CHECK ABOVE]${NC}")"
echo ""
echo -e "  App URL : ${BOLD}${APP_URL}${NC}"
echo -e "  Supabase callback : ${APP_URL}/auth/callback"
echo -e "  Razorpay webhook  : ${APP_URL}/api/billing/webhook"
echo -e "  Resend webhook    : ${APP_URL}/api/webhooks/resend"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $SUPABASE_OK -eq 0 ]; then
    exit 1
fi

exit 0
