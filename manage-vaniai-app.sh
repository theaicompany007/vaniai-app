#!/bin/bash
# Vani AI App - Management Script (gcc chroma-vm)
# Location: /home/postgres/vaniai-app/manage-vaniai-app.sh
#
# Usage:
#   ./manage-vaniai-app.sh [start|stop|restart|rebuild|rebuild-no-cache|purge|full-deploy|status|logs]
#
# Commands:
#   start           - Start Vani AI application
#   stop            - Stop application
#   restart         - Restart application
#   rebuild         - Rebuild and restart (--no-cache)
#   rebuild-no-cache - Same as rebuild (no cache)
#   purge           - Stop and remove containers/networks (keeps volumes)
#   full-deploy     - Full deployment: rebuild + Supabase post-deploy
#   status          - Show status
#   logs            - Show logs (e.g. logs --tail=200, logs -f to follow)
#
# Production URL: https://vaniai.theaicompany.co
# Resend domain:  vaniai.theaicompany.co

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="vaniai"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Vani AI - Sales Intelligence Platform${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}❌ Error: $COMPOSE_FILE not found in $(pwd)${NC}"
        exit 1
    fi
}

check_infrastructure() {
    if ! docker network ls | grep -q "shared-infra-network"; then
        echo -e "${RED}❌ Error: shared-infra-network not found${NC}"
        echo -e "${YELLOW}💡 Create it first: docker network create shared-infra-network${NC}"
        exit 1
    fi
}

remove_stale_container() {
    for name in vaniai; do
        if docker ps -a --format "{{.Names}}" | grep -q "^${name}$"; then
            echo -e "${YELLOW}Removing existing container '$name'...${NC}"
            docker rm -f "$name" 2>/dev/null || true
        fi
    done
}

cmd_start() {
    print_header
    echo -e "${YELLOW}🚀 Starting Vani AI application...${NC}"
    echo ""
    check_compose_file
    check_infrastructure
    remove_stale_container
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    echo ""
    echo -e "${GREEN}✅ Vani AI application started!${NC}"
    echo -e "${CYAN}  URL: http://localhost:3100${NC}"
    echo ""
}

cmd_stop() {
    print_header
    echo -e "${YELLOW}🛑 Stopping Vani AI application...${NC}"
    echo ""
    check_compose_file
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" stop
    echo ""
    echo -e "${GREEN}✅ Application stopped${NC}"
}

cmd_restart() {
    print_header
    echo -e "${YELLOW}🔄 Restarting Vani AI application...${NC}"
    echo ""
    check_compose_file
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" restart
    echo ""
    echo -e "${GREEN}✅ Application restarted${NC}"
}

cmd_rebuild() {
    print_header
    echo -e "${YELLOW}🔨 Rebuilding and restarting (--no-cache)...${NC}"
    echo ""
    check_compose_file
    check_infrastructure
    remove_stale_container
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --no-cache
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    echo ""
    echo -e "${GREEN}✅ Rebuilt and started${NC}"
}

cmd_rebuild_no_cache() {
    # Same as rebuild (both use --no-cache)
    cmd_rebuild
}

cmd_purge() {
    print_header
    echo -e "${RED}🗑️  Purging Vani AI application...${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  This will stop and remove containers/networks (volumes kept).${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Cancelled${NC}"
        exit 0
    fi
    check_compose_file
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    echo ""
    echo -e "${GREEN}✅ Purged${NC}"
}

cmd_full_deploy() {
    print_header
    echo -e "${YELLOW}🚀 Full deployment: Rebuild + Supabase post-deploy...${NC}"
    echo ""
    check_compose_file
    check_infrastructure
    cmd_rebuild
    echo ""
    echo -e "${YELLOW}⏳ Waiting for service...${NC}"
    sleep 10
    if [ -f "supabase_post_deploy.sh" ]; then
        echo ""
        echo -e "${YELLOW}📝 Running Supabase post-deploy (dev + prod)...${NC}"
        chmod +x supabase_post_deploy.sh
        # Pass environment: read .deploy-environment (set by deploy-vaniai-app-complete.ps1) or default prod
        VANIAI_ENV="${VANIAI_ENV:-}"
        if [ -f ".deploy-environment" ]; then
            VANIAI_ENV=$(cat .deploy-environment 2>/dev/null | tr -d '\r\n' || true)
        fi
        [ -z "$VANIAI_ENV" ] && VANIAI_ENV=prod
        VANIAI_ENV="$VANIAI_ENV" ./supabase_post_deploy.sh
    else
        echo -e "${YELLOW}⚠️  supabase_post_deploy.sh not found, skipping${NC}"
    fi
    echo ""
    echo -e "${GREEN}✅ Full deployment completed!${NC}"
}

cmd_status() {
    print_header
    echo -e "${CYAN}📊 Vani AI Application Status${NC}"
    echo ""
    check_compose_file
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    echo ""
    if docker network ls | grep -q "shared-infra-network"; then
        echo -e "${GREEN}✅ shared-infra-network present${NC}"
    else
        echo -e "${RED}❌ shared-infra-network not found${NC}"
    fi
}

cmd_logs() {
    print_header
    echo -e "${CYAN}📜 Vani AI Application Logs${NC}"
    echo -e "${YELLOW}Usage: $0 logs [--tail=N] [-f]${NC}"
    echo ""
    check_compose_file
    if [ $# -eq 0 ]; then
        set -- --tail=100
    fi
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs "$@"
}

case "${1:-}" in
    start)           cmd_start ;;
    stop)            cmd_stop ;;
    restart)         cmd_restart ;;
    rebuild)         cmd_rebuild ;;
    rebuild-no-cache) cmd_rebuild_no_cache ;;
    purge)           cmd_purge ;;
    full-deploy)     cmd_full_deploy ;;
    status)          cmd_status ;;
    logs)            shift; cmd_logs "$@" ;;
    *)
        echo "Usage: $0 {start|stop|restart|rebuild|rebuild-no-cache|purge|full-deploy|status|logs}"
        echo ""
        echo "  start           - Start application"
        echo "  stop            - Stop application"
        echo "  restart         - Restart application"
        echo "  rebuild         - Rebuild and restart (--no-cache)"
        echo "  rebuild-no-cache - Same as rebuild (no cache)"
        echo "  purge           - Stop and remove (keep volumes)"
        echo "  full-deploy     - Rebuild + Supabase post-deploy"
        echo "  status          - Show status"
        echo "  logs            - Show logs (e.g. logs -f)"
        exit 1
        ;;
esac
