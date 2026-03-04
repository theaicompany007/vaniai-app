#!/bin/bash
# Set .env.local to DEV or PROD mode: comment inactive block, uncomment active block.
# Then generate .env for the container (Docker env_file).
#
# Usage: ./set-env-mode.sh [dev|prod]
# Convention in .env.local:
#   # --- DEV ---
#   NEXT_PUBLIC_APP_URL=http://localhost:3100
#   EMAIL_FROM=noreply@localhost
#   # --- PROD ---
#   #NEXT_PUBLIC_APP_URL=https://vaniai.theaicompany.co
#   #EMAIL_FROM=noreply@vaniai.theaicompany.co
#
# Run by deploy script after copying .env.local to VM.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-prod}"
if [ "$MODE" != "dev" ] && [ "$MODE" != "prod" ]; then
    echo "Usage: $0 [dev|prod]"
    exit 1
fi

if [ ! -f .env.local ]; then
    echo ".env.local not found"
    exit 1
fi

# Strip CRLF
sed -i 's/\r$//' .env.local 2>/dev/null || true

# Use awk to: in DEV section, comment if mode=prod else uncomment; in PROD section, uncomment if mode=prod else comment
awk -v mode="$MODE" '
BEGIN { section = "common" }
/^# --- DEV ---/   { section = "dev"; print; next }
/^# --- PROD ---/  { section = "prod"; print; next }
section == "common" { print; next }
section == "dev" {
    if (mode == "prod") {
        if ($0 ~ /^#/) print $0
        else if ($0 ~ /^[A-Za-z_][A-Za-z0-9_]*=/) print "#" $0
        else print $0
    } else {
        if ($0 ~ /^#([A-Za-z_][A-Za-z0-9_]*=)/) print substr($0, 2)
        else print $0
    }
    next
}
section == "prod" {
    if (mode == "prod") {
        if ($0 ~ /^#([A-Za-z_][A-Za-z0-9_]*=)/) print substr($0, 2)
        else print $0
    } else {
        if ($0 ~ /^#/) print $0
        else if ($0 ~ /^[A-Za-z_][A-Za-z0-9_]*=/) print "#" $0
        else print $0
    }
    next
}
{ print }
' .env.local > .env.local.tmp
mv .env.local.tmp .env.local

# Generate .env for container (copy; Docker env_file ignores # lines)
cp .env.local .env
sed -i 's/\r$//' .env 2>/dev/null || true

echo "Env mode set to: $MODE (.env.local updated, .env generated)"
