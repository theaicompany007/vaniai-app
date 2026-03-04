#!/bin/bash
# Supabase Post-Deploy Script for Vani AI App
# Called in both dev and prod by manage-vaniai-app.sh full-deploy.
# Environment comes from .deploy-environment (set by deploy-vaniai-app-complete.ps1)
#   or VANIAI_ENV (prod | dev), default prod.
#
# Production URL: https://vaniai.theaicompany.co
# In prod: reminds to set Supabase Auth Site URL + Redirect URLs.
# In dev: reminds to set dev/local redirect URLs if needed.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PRODUCTION_URL="https://vaniai.theaicompany.co"
# env: prod or dev (set by manage-vaniai-app.sh from .deploy-environment or VANIAI_ENV)
ENV="${VANIAI_ENV:-prod}"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Supabase Post-Deploy: Vani AI App (environment: $ENV)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ! -f .env.local ] && [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env.local / .env not found. Auth config unchanged.${NC}"
    echo ""
    echo -e "${GREEN}✅ Supabase post-deploy completed ($ENV)${NC}"
    echo ""
    exit 0
fi

if [ "$ENV" = "prod" ]; then
    echo -e "${CYAN}ℹ️  Production: $PRODUCTION_URL${NC}"
    echo -e "${CYAN}   Ensure Supabase Dashboard → Authentication → URL Configuration:${NC}"
    echo -e "${CYAN}   - Site URL: $PRODUCTION_URL${NC}"
    echo -e "${CYAN}   - Redirect URLs: $PRODUCTION_URL/**${NC}"
else
    echo -e "${CYAN}ℹ️  Dev: ensure Supabase Auth has your dev redirect URLs (e.g. localhost:3100/**) if needed.${NC}"
fi
echo ""

echo -e "${GREEN}✅ Supabase post-deploy completed ($ENV)${NC}"
echo ""
