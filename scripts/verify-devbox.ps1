#!/usr/bin/env pwsh
<#
.SYNOPSIS
    End-to-end verification script for the DevBox Spring Boot + Kubernetes stack.

.DESCRIPTION
    Runs a full lifecycle check against a running DevBox backend:

      1.  Backend health check
      2.  Dependency health (Docker, kubectl, Minikube)
      3.  Templates API — verify all 6 templates with quickStartCommands
      4.  Workspace CRUD
      5.  Application CRUD
      6.  Build + Deploy + Poll + Scale + Logs (requires Kubernetes)
      7.  Environment lifecycle — Create → Status → Start → Poll → Stop → Delete
      8.  Nginx gateway route verification (/healthz, /terminal/, /desktop/)
      9.  Cleanup

.PARAMETER BaseUrl
    URL of the DevBox backend. Default: http://localhost:8080

.PARAMETER SkipK8s
    Skip all Kubernetes-dependent steps (build/deploy/environment lifecycle).

.EXAMPLE
    .\verify-devbox.ps1
    .\verify-devbox.ps1 -SkipK8s
    .\verify-devbox.ps1 -BaseUrl http://192.168.49.2:30080
#>
param(
    [string]$BaseUrl = "http://localhost:8080",
    [switch]$SkipK8s
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────────────────────

$pass = 0; $fail = 0; $skip = 0

function OK   { param($msg) Write-Host "  [PASS] $msg" -ForegroundColor Green;  $script:pass++ }
function FAIL { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:fail++ }
function SKIP { param($msg) Write-Host "  [SKIP] $msg" -ForegroundColor DarkGray; $script:skip++ }
function INFO { param($msg) Write-Host "  [INFO] $msg" -ForegroundColor Cyan }
function STEP { param($msg) Write-Host "`n==> $msg" -ForegroundColor Yellow }

function Invoke-API {
    param([string]$Method, [string]$Path, [hashtable]$Body = $null)
    $uri    = "$BaseUrl/api$Path"
    $params = @{ Method = $Method; Uri = $uri; ContentType = "application/json" }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
    try {
        return Invoke-RestMethod @params
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $detail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        $msg    = if ($detail.message) { $detail.message } else { $_.Exception.Message }
        throw "HTTP $status -- $msg"
    }
}

function Test-HttpOk {
    param([string]$Url, [string]$Label)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { OK "$Label returned HTTP 200" }
        else { FAIL "$Label returned HTTP $($r.StatusCode)" }
    } catch {
        FAIL "$Label unreachable: $_"
    }
}

# ── Step 1: Backend health ────────────────────────────────────────────────────

STEP "1. Backend health check"
try {
    $h = Invoke-API GET "/health"
    if ($h.status -eq "UP") { OK "Backend is UP" }
    else { FAIL "Backend status: $($h.status)" }
} catch {
    FAIL "Cannot reach backend at $BaseUrl — $_"
    Write-Host "`n  Start the backend: cd backend && .\mvnw.cmd spring-boot:run" -ForegroundColor Yellow
    exit 1
}

# ── Step 2: Dependency health ─────────────────────────────────────────────────

STEP "2. Dependency health"
$k8sOk = $false
try {
    $deps = Invoke-API GET "/health/dependencies"
    foreach ($key in $deps.dependencies.PSObject.Properties.Name) {
        $val = $deps.dependencies.$key
        if ($val -like "ok:*") { OK "$key`: $val" }
        else                   { INFO "$key`: $val" }
    }
    $k8sOk = $deps.dependencies.kubernetes -like "ok:*"
} catch {
    INFO "Could not fetch dependency health: $_"
}

# ── Step 3: Templates API ─────────────────────────────────────────────────────

STEP "3. Templates API"
$expectedIds = @("ubuntu","python","nodejs","java","react","fullstack")
try {
    $templates = Invoke-API GET "/templates"
    OK "Templates endpoint returned $($templates.Count) template(s)"

    if ($templates.Count -eq 6) { OK "All 6 templates present" }
    else { FAIL "Expected 6 templates, got $($templates.Count)" }

    foreach ($id in $expectedIds) {
        $t = $templates | Where-Object { $_.id -eq $id }
        if ($t) {
            $hasQuickStart = $t.quickStartCommands -and $t.quickStartCommands.Length -gt 0
            if ($hasQuickStart) { OK "Template '$id': quickStartCommands present ($($t.quickStartCommands.Split("`n").Count) commands)" }
            else { FAIL "Template '$id': quickStartCommands is missing or empty" }
            if ($t.containerPort -eq 8080) { OK "Template '$id': containerPort = 8080 (workspace gateway)" }
            else { FAIL "Template '$id': containerPort is $($t.containerPort), expected 8080" }
        } else {
            FAIL "Template '$id' not found in response"
        }
    }
} catch {
    FAIL "Templates API: $_"
}

# ── Step 4: Workspace CRUD ────────────────────────────────────────────────────

STEP "4. Workspace CRUD"
$wsName = "e2e-workspace-$(Get-Random -Maximum 9999)"
$wsId   = $null

try {
    $ws   = Invoke-API POST "/workspaces" @{ name = $wsName; description = "E2E test workspace" }
    $wsId = $ws.id
    OK "Created workspace '$wsName' ($wsId)"
} catch { FAIL "Create workspace: $_" }

if ($wsId) {
    try {
        $fetched = Invoke-API GET "/workspaces/$wsId"
        if ($fetched.name -eq $wsName) { OK "Get workspace by ID" } else { FAIL "Get workspace: name mismatch" }
    } catch { FAIL "Get workspace: $_" }

    try {
        $all   = Invoke-API GET "/workspaces"
        $found = $all | Where-Object { $_.id -eq $wsId }
        if ($found) { OK "List workspaces: workspace found" } else { FAIL "List workspaces: not found" }
    } catch { FAIL "List workspaces: $_" }

    try {
        Invoke-API PUT "/workspaces/$wsId" @{ description = "Updated by e2e" } | Out-Null
        OK "Update workspace"
    } catch { FAIL "Update workspace: $_" }
}

# ── Step 5: Application CRUD ──────────────────────────────────────────────────

STEP "5. Application CRUD"
$appName    = "e2e-app-$(Get-Random -Maximum 9999)"
$appId      = $null
$samplePath = (Resolve-Path "$PSScriptRoot\..\sample-app" -ErrorAction SilentlyContinue)?.Path
if (-not $samplePath) { $samplePath = "C:\placeholder\sample-app" }

if (-not $wsId) {
    SKIP "Application tests — workspace creation failed"
} else {
    try {
        $app   = Invoke-API POST "/workspaces/$wsId/applications" @{
            name          = $appName
            description   = "E2E test app"
            sourcePath    = $samplePath
            containerPort = 8080
            replicas      = 1
        }
        $appId = $app.id
        OK "Created application '$appName' ($appId)"
        if ($app.deploymentStatus -eq "NOT_DEPLOYED") { OK "Initial status: NOT_DEPLOYED" }
        else { FAIL "Expected NOT_DEPLOYED, got $($app.deploymentStatus)" }
    } catch { FAIL "Create application: $_" }

    if ($appId) {
        try {
            $s = Invoke-API GET "/applications/$appId/status"
            if ($s.status -eq "NOT_DEPLOYED") { OK "Status endpoint: NOT_DEPLOYED" }
            else { FAIL "Status endpoint: unexpected $($s.status)" }
        } catch { FAIL "Get app status: $_" }

        try {
            $apps  = Invoke-API GET "/workspaces/$wsId/applications"
            $found = $apps | Where-Object { $_.id -eq $appId }
            if ($found) { OK "List applications: found" } else { FAIL "List applications: not found" }
        } catch { FAIL "List applications: $_" }

        try {
            Invoke-API PUT "/applications/$appId" @{ description = "Updated by e2e" } | Out-Null
            OK "Update application"
        } catch { FAIL "Update application: $_" }
    }
}

# ── Step 6: Kubernetes build/deploy (optional) ────────────────────────────────

if ($SkipK8s -or -not $k8sOk) {
    SKIP "K8s build/deploy steps (SkipK8s=$SkipK8s, k8sAvailable=$k8sOk)"
} elseif ($appId) {
    STEP "6. Docker build + Deploy + Poll + Scale + Logs"

    try {
        $build = Invoke-API POST "/applications/$appId/build"
        if ($build.success) { OK "Build succeeded: image=$($build.imageName)" }
        else { FAIL "Build failed: $($build.error)" }
    } catch { FAIL "Build: $_" }

    try {
        $deploy = Invoke-API POST "/applications/$appId/deploy"
        OK "Deploy triggered: status=$($deploy.status)"
    } catch { FAIL "Deploy: $_" }

    STEP "  Poll for RUNNING (up to 90s)"
    $deadline    = (Get-Date).AddSeconds(90)
    $finalStatus = $null
    while ((Get-Date) -lt $deadline) {
        try {
            $s           = Invoke-API GET "/applications/$appId/status"
            $finalStatus = $s.status
            INFO "  status=$finalStatus  ready=$($s.readyReplicas)/$($s.desiredReplicas)"
            if ($finalStatus -in @("RUNNING","FAILED","BUILD_FAILED")) { break }
        } catch { INFO "  poll error: $_" }
        Start-Sleep 5
    }
    if ($finalStatus -eq "RUNNING") { OK "Application reached RUNNING" }
    else { FAIL "Application status after 90s: $finalStatus" }

    try {
        Invoke-API POST "/applications/$appId/scale" @{ replicas = 2 } | Out-Null
        OK "Scale to 2 replicas triggered"
    } catch { FAIL "Scale: $_" }

    try {
        $logs = Invoke-API GET "/applications/$appId/logs?lines=50"
        if ($logs -and $logs.Length -gt 0) { OK "Logs returned ($($logs.Length) chars)" }
        else { INFO "Logs empty (pods may still be starting)" }
    } catch { FAIL "Logs: $_" }

    try {
        $svc = Invoke-API GET "/applications/$appId/service"
        if ($svc.type) { OK "Service: type=$($svc.type) nodePort=$($svc.nodePort)" }
    } catch { FAIL "Service info: $_" }
}

# ── Step 7: Environment lifecycle ─────────────────────────────────────────────

STEP "7. Environment lifecycle (Create → Status → Start → Poll → Stop → Delete)"

if ($SkipK8s -or -not $k8sOk) {
    SKIP "Environment lifecycle — requires Kubernetes (SkipK8s=$SkipK8s, k8sAvailable=$k8sOk)"
} elseif (-not $wsId) {
    SKIP "Environment lifecycle — workspace creation failed"
} else {
    $envName = "e2e-env-$(Get-Random -Maximum 9999)"
    $envId   = $null

    # 7a. Create environment (Python template)
    try {
        $env   = Invoke-API POST "/workspaces/$wsId/environments" @{
            name        = $envName
            description = "E2E test environment"
            templateId  = "python"
        }
        $envId = $env.id
        OK "Created environment '$envName' ($envId) with template 'python'"
        if ($env.status -in @("PROVISIONING","PENDING")) { OK "Initial status: $($env.status)" }
        else { FAIL "Unexpected initial status: $($env.status)" }
    } catch { FAIL "Create environment: $_" }

    if ($envId) {
        # 7b. Get environment by ID
        try {
            $e = Invoke-API GET "/environments/$envId"
            OK "Get environment by ID: name=$($e.name) templateId=$($e.templateId)"
        } catch { FAIL "Get environment: $_" }

        # 7c. Get status
        try {
            $s = Invoke-API GET "/environments/$envId/status"
            OK "Status endpoint: status=$($s.status)"
        } catch { FAIL "Environment status: $_" }

        # 7d. List environments in workspace
        try {
            $envs  = Invoke-API GET "/workspaces/$wsId/environments"
            $found = $envs | Where-Object { $_.id -eq $envId }
            if ($found) { OK "List environments: found '$envName'" }
            else { FAIL "List environments: '$envName' not in list" }
        } catch { FAIL "List environments: $_" }

        # 7e. Poll for RUNNING (up to 120s — workspace stack takes 30-75s to start)
        INFO "Polling for environment RUNNING (up to 120s — VNC+XFCE+nginx startup)..."
        $deadline    = (Get-Date).AddSeconds(120)
        $finalStatus = $null
        $accessUrl   = $null
        while ((Get-Date) -lt $deadline) {
            try {
                $s           = Invoke-API GET "/environments/$envId/status"
                $finalStatus = $s.status
                $accessUrl   = $s.accessUrl
                $elapsed     = [int]((Get-Date) - ($deadline.AddSeconds(-120))).TotalSeconds
                INFO "  status=$finalStatus  accessUrl=$($accessUrl ?? '(pending)')  elapsed=${elapsed}s"
                if ($finalStatus -in @("RUNNING","FAILED")) { break }
            } catch { INFO "  poll error: $_" }
            Start-Sleep 5
        }

        if ($finalStatus -eq "RUNNING") {
            OK "Environment reached RUNNING"
        } elseif ($finalStatus -eq "FAILED") {
            FAIL "Environment FAILED — check kubectl logs for the pod"
        } else {
            FAIL "Environment still $finalStatus after 120s"
        }

        # 7f. Verify access URL fields are populated
        if ($accessUrl) {
            OK "accessUrl populated: $accessUrl"

            # Re-fetch for terminalUrl and desktopUrl
            $s = Invoke-API GET "/environments/$envId/status"
            if ($s.terminalUrl) { OK "terminalUrl populated: $($s.terminalUrl)" }
            else { FAIL "terminalUrl is null/empty" }
            if ($s.desktopUrl)  { OK "desktopUrl populated: $($s.desktopUrl)"  }
            else { FAIL "desktopUrl is null/empty" }

            # 7g. Verify nginx gateway routes
            STEP "  7g. Nginx route verification via port-forward tunnel"

            # /healthz — must return 200 "ready"
            Test-HttpOk -Url "$accessUrl/healthz" -Label "/healthz"

            # / — workspace landing page, must return 200
            Test-HttpOk -Url $accessUrl -Label "/ (workspace landing page)"

            # /terminal/ — ttyd proxy, must return 200
            Test-HttpOk -Url "$accessUrl/terminal/" -Label "/terminal/ (ttyd)"

            # /desktop/ — noVNC static, must return 200
            Test-HttpOk -Url "$accessUrl/desktop/" -Label "/desktop/ (noVNC)"

        } else {
            FAIL "accessUrl is null — workspace did not become ready within 120s"
            SKIP "Nginx route checks — no accessUrl available"
        }

        # 7h. Pod list
        try {
            $pods = Invoke-API GET "/environments/$envId/pods"
            OK "Pods endpoint: $($pods.Count) pod(s)"
            $readyPod = $pods | Where-Object { $_.ready -eq $true }
            if ($readyPod) { OK "At least one pod is Ready" }
            else           { INFO "No ready pods yet (workspace may still be starting)" }
        } catch { FAIL "Pods endpoint: $_" }

        # 7i. Stop
        try {
            $stopped = Invoke-API POST "/environments/$envId/stop"
            if ($stopped.status -eq "STOPPED") { OK "Environment stopped: status=STOPPED" }
            else { OK "Stop triggered: status=$($stopped.status)" }
        } catch { FAIL "Stop environment: $_" }

        # 7j. Verify URLs cleared after stop
        try {
            Start-Sleep 3
            $s = Invoke-API GET "/environments/$envId/status"
            if ($null -eq $s.accessUrl -or $s.accessUrl -eq "") { OK "accessUrl cleared after stop" }
            else { INFO "accessUrl still set after stop: $($s.accessUrl) (may clear on next poll)" }
        } catch { FAIL "Post-stop status check: $_" }

        # 7k. Delete environment
        try {
            Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/api/environments/$envId" | Out-Null
            OK "Deleted environment $envId"
        } catch { FAIL "Delete environment: $_" }
    }
}

# ── Step 8: Cleanup ───────────────────────────────────────────────────────────

STEP "8. Cleanup"
if ($appId) {
    try {
        Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/api/applications/$appId" | Out-Null
        OK "Deleted application $appId"
    } catch { FAIL "Delete application: $_" }
}
if ($wsId) {
    try {
        Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/api/workspaces/$wsId" | Out-Null
        OK "Deleted workspace $wsId"
    } catch { FAIL "Delete workspace: $_" }
}

# ── Summary ───────────────────────────────────────────────────────────────────

$total = $pass + $fail
Write-Host ""
Write-Host ("─" * 50) -ForegroundColor DarkGray
Write-Host " DevBox E2E Verification Complete" -ForegroundColor White
Write-Host " PASS: $pass   FAIL: $fail   SKIP: $skip   TOTAL: $total" `
    -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host ("─" * 50) -ForegroundColor DarkGray

if ($fail -gt 0) { exit 1 } else { exit 0 }
