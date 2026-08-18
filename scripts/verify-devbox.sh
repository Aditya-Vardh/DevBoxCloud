#!/usr/bin/env bash
# verify-devbox.sh — End-to-end verification for the DevBox Spring Boot + Kubernetes stack
# Usage:
#   ./scripts/verify-devbox.sh
#   BASE_URL=http://192.168.49.2:30080 ./scripts/verify-devbox.sh
#   SKIP_K8S=true ./scripts/verify-devbox.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
SKIP_K8S="${SKIP_K8S:-false}"
PASS=0; FAIL=0

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}[PASS]${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; ((FAIL++)); }
info() { echo -e "  ${CYAN}[INFO]${NC} $1"; }
step() { echo -e "\n${YELLOW}==> $1${NC}"; }

# ── HTTP helpers ──────────────────────────────────────────────────────────────
api_get()  { curl -sf "$BASE_URL/api$1"; }
api_post() { curl -sf -X POST  -H "Content-Type: application/json" -d "$2" "$BASE_URL/api$1"; }
api_put()  { curl -sf -X PUT   -H "Content-Type: application/json" -d "$2" "$BASE_URL/api$1"; }
api_del()  { curl -sf -X DELETE "$BASE_URL/api$1" || true; }

# ── Step 1: Backend health ────────────────────────────────────────────────────
step "1. Backend health check"
if status=$(api_get "/health" 2>/dev/null) && echo "$status" | grep -q '"UP"'; then
    ok "Backend is UP"
else
    fail "Cannot reach backend at $BASE_URL"
    echo -e "${YELLOW}Start the backend: cd backend && ./mvnw spring-boot:run${NC}"
    exit 1
fi

# ── Step 2: Dependency health ─────────────────────────────────────────────────
step "2. Dependency health"
deps=$(api_get "/health/dependencies" 2>/dev/null || echo '{}')
k8s_ok=false
for key in docker kubectl kubernetes minikube; do
    val=$(echo "$deps" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dependencies',{}).get('$key','n/a'))" 2>/dev/null || echo "n/a")
    if [[ "$val" == ok:* ]]; then
        ok "$key: $val"
        [[ "$key" == "kubernetes" ]] && k8s_ok=true
    else
        info "$key: $val"
    fi
done

# ── Step 3: Workspace CRUD ────────────────────────────────────────────────────
step "3. Workspace CRUD"
WS_NAME="e2e-workspace-$$"
WS_ID=""

ws=$(api_post "/workspaces" "{\"name\":\"$WS_NAME\",\"description\":\"E2E test\"}" 2>/dev/null || true)
if [[ -n "$ws" ]] && echo "$ws" | grep -q '"id"'; then
    WS_ID=$(echo "$ws" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    ok "Created workspace '$WS_NAME' ($WS_ID)"
else
    fail "Create workspace failed"
fi

if [[ -n "$WS_ID" ]]; then
    fetched=$(api_get "/workspaces/$WS_ID" 2>/dev/null || true)
    echo "$fetched" | grep -q "\"$WS_NAME\"" && ok "Get workspace by ID" || fail "Get workspace"
    all=$(api_get "/workspaces" 2>/dev/null || true)
    echo "$all" | grep -q "$WS_ID" && ok "List workspaces" || fail "List workspaces"
    api_put "/workspaces/$WS_ID" '{"description":"Updated"}' >/dev/null && ok "Update workspace" || fail "Update workspace"
fi

# ── Step 4: Application CRUD ──────────────────────────────────────────────────
step "4. Application CRUD"
APP_NAME="e2e-app-$$"
APP_ID=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLE_PATH="$(cd "$SCRIPT_DIR/../sample-app" && pwd)"

if [[ -z "$WS_ID" ]]; then
    info "Skipping app tests — workspace creation failed"
else
    app=$(api_post "/workspaces/$WS_ID/applications" \
        "{\"name\":\"$APP_NAME\",\"sourcePath\":\"$SAMPLE_PATH\",\"containerPort\":8080,\"replicas\":1}" \
        2>/dev/null || true)
    if [[ -n "$app" ]] && echo "$app" | grep -q '"id"'; then
        APP_ID=$(echo "$app" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
        ok "Created application '$APP_NAME' ($APP_ID)"
        echo "$app" | grep -q '"NOT_DEPLOYED"' && ok "Initial status is NOT_DEPLOYED" || fail "Unexpected initial status"
        echo "$app" | grep -q "\"$APP_NAME-svc\"" && ok "K8s service name correct" || fail "K8s service name wrong"
    else
        fail "Create application failed"
    fi

    if [[ -n "$APP_ID" ]]; then
        status_resp=$(api_get "/applications/$APP_ID/status" 2>/dev/null || true)
        echo "$status_resp" | grep -q '"NOT_DEPLOYED"' && ok "Status endpoint: NOT_DEPLOYED" || fail "Status endpoint unexpected"
        apps_list=$(api_get "/workspaces/$WS_ID/applications" 2>/dev/null || true)
        echo "$apps_list" | grep -q "$APP_ID" && ok "List applications" || fail "List applications"
        api_put "/applications/$APP_ID" '{"description":"Updated"}' >/dev/null && ok "Update application" || fail "Update application"
    fi
fi

# ── Steps 5-9: Kubernetes operations ──────────────────────────────────────────
if [[ "$SKIP_K8S" == "true" ]] || [[ "$k8s_ok" != "true" ]]; then
    info "Skipping Kubernetes steps (SKIP_K8S=$SKIP_K8S, k8s_available=$k8s_ok)"
elif [[ -n "$APP_ID" ]]; then
    step "5. Docker build"
    build=$(api_post "/applications/$APP_ID/build" '{}' 2>/dev/null || true)
    echo "$build" | grep -q '"success":true' && ok "Build succeeded" || fail "Build failed: $build"

    step "6. Deploy"
    deploy=$(api_post "/applications/$APP_ID/deploy" '{}' 2>/dev/null || true)
    [[ -n "$deploy" ]] && ok "Deploy triggered" || fail "Deploy failed"

    step "7. Poll for RUNNING (up to 90s)"
    DEADLINE=$((SECONDS + 90)); FINAL_STATUS=""
    while [[ $SECONDS -lt $DEADLINE ]]; do
        s=$(api_get "/applications/$APP_ID/status" 2>/dev/null || true)
        FINAL_STATUS=$(echo "$s" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || true)
        info "  status=$FINAL_STATUS"
        [[ "$FINAL_STATUS" =~ ^(RUNNING|FAILED|BUILD_FAILED)$ ]] && break
        sleep 5
    done
    [[ "$FINAL_STATUS" == "RUNNING" ]] && ok "Reached RUNNING" || fail "Status after 90s: $FINAL_STATUS"

    step "8. Scale to 2"
    scaled=$(api_post "/applications/$APP_ID/scale" '{"replicas":2}' 2>/dev/null || true)
    [[ -n "$scaled" ]] && ok "Scale triggered" || fail "Scale failed"

    step "9. Logs"
    logs=$(api_get "/applications/$APP_ID/logs?lines=50" 2>/dev/null || true)
    [[ -n "$logs" ]] && ok "Logs returned (${#logs} chars)" || info "Logs empty (pods may still be starting)"

    step "9b. Service info"
    svc=$(api_get "/applications/$APP_ID/service" 2>/dev/null || true)
    echo "$svc" | grep -q '"type"' && ok "Service info returned" || fail "Service info missing"
fi

# ── Step 10: Cleanup ──────────────────────────────────────────────────────────
step "10. Cleanup"
[[ -n "$APP_ID" ]] && { api_del "/applications/$APP_ID" && ok "Deleted application" || fail "Delete application"; }
[[ -n "$WS_ID" ]]  && { api_del "/workspaces/$WS_ID"   && ok "Deleted workspace"   || fail "Delete workspace"; }

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo " DevBox E2E Verification Complete"
if [[ $FAIL -eq 0 ]]; then
    echo -e " ${GREEN}PASS: $PASS   FAIL: $FAIL${NC}"
    echo "─────────────────────────────────────────"
    exit 0
else
    echo -e " ${RED}PASS: $PASS   FAIL: $FAIL${NC}"
    echo "─────────────────────────────────────────"
    exit 1
fi
