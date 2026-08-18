#!/usr/bin/env pwsh
<#
.SYNOPSIS
    End-to-end verification script for the DevBox Spring Boot + Kubernetes stack.

.DESCRIPTION
    Runs a full lifecycle check against a running DevBox backend:
      1. Backend health check
      2. Dependency health (Docker, kubectl, minikube)
      3. Workspace CRUD
      4. Application CRUD
      5. Build trigger (if Minikube is available)
      6. Deploy trigger (if Kubernetes is available)
      7. Status poll
      8. Scale
      9. Logs fetch
     10. Cleanup

.PARAMETER BaseUrl
    URL of the DevBox backend. Default: http://localhost:8080

.PARAMETER SkipK8s
    Skip Kubernetes-dependent steps (build/deploy/scale/logs).

.EXAMPLE
    .\verify-devbox.ps1
    .\verify-devbox.ps1 -BaseUrl http://192.168.49.2:30080
    .\verify-devbox.ps1 -SkipK8s
#>
param(
    [string]$BaseUrl  = "http://localhost:8080",
    [switch]$SkipK8s
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# - Helpers -

$pass = 0; $fail = 0

function OK   { param($msg) Write-Host "  [PASS] $msg" -ForegroundColor Green;  $script:pass++ }
function FAIL { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:fail++ }
function INFO { param($msg) Write-Host "  [INFO] $msg" -ForegroundColor Cyan }
function STEP { param($msg) Write-Host "`n==> $msg" -ForegroundColor Yellow }

function Invoke-API {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Body = $null
    )
    $uri = "$BaseUrl/api$Path"
    $params = @{ Method = $Method; Uri = $uri; ContentType = "application/json" }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
    try {
        $resp = Invoke-RestMethod @params
        return $resp
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $detail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        $msg = if ($detail.message) { $detail.message } else { $_.Exception.Message }
        throw "HTTP $status -- $msg"
    }
}

# - Step 1: Backend health -

STEP "1. Backend health check"
try {
    $h = Invoke-API GET "/health"
    if ($h.status -eq "UP") { OK "Backend is UP" } else { FAIL "Backend status: $($h.status)" }
} catch {
    FAIL "Cannot reach backend at $BaseUrl -- $_"
    Write-Host "`nMake sure the backend is running: cd backend && .\mvnw.cmd spring-boot:run" -ForegroundColor Yellow
    exit 1
}

# - Step 2: Dependency health -

STEP "2. Dependency health"
try {
    $deps = Invoke-API GET "/health/dependencies"
    foreach ($key in $deps.dependencies.PSObject.Properties.Name) {
        $val = $deps.dependencies.$key
        if ($val -like "ok:*") { OK "$key`: $val" }
        else                   { INFO "$key`: $val (not required to continue)" }
    }
    $k8sOk = $deps.dependencies.kubernetes -like "ok:*"
} catch {
    INFO "Could not fetch dependency health: $_"
    $k8sOk = $false
}

# - Step 3: Workspace CRUD -

STEP "3. Workspace CRUD"
$wsName = "e2e-workspace-$(Get-Random -Maximum 9999)"
$wsId   = $null

try {
    $ws = Invoke-API POST "/workspaces" @{ name = $wsName; description = "E2E test workspace" }
    $wsId = $ws.id
    OK "Created workspace '$wsName' ($wsId)"
} catch { FAIL "Create workspace: $_" }

if ($wsId) {
    try {
        $fetched = Invoke-API GET "/workspaces/$wsId"
        if ($fetched.name -eq $wsName) { OK "Get workspace by ID" }
        else { FAIL "Get workspace: name mismatch" }
    } catch { FAIL "Get workspace: $_" }

    try {
        $all = Invoke-API GET "/workspaces"
        $found = $all | Where-Object { $_.id -eq $wsId }
        if ($found) { OK "List workspaces: found our workspace" }
        else        { FAIL "List workspaces: workspace not in list" }
    } catch { FAIL "List workspaces: $_" }

    try {
        Invoke-API PUT "/workspaces/$wsId" @{ description = "Updated by e2e test" } | Out-Null
        OK "Update workspace"
    } catch { FAIL "Update workspace: $_" }
}

# - Step 4: Application CRUD -

STEP "4. Application CRUD"
$appName = "e2e-app-$(Get-Random -Maximum 9999)"
$appId   = $null
# Use the sample-app directory as source path
$samplePath = (Resolve-Path "$PSScriptRoot\..\sample-app").Path

if (-not $wsId) {
    INFO "Skipping application tests -- workspace creation failed"
} else {
    try {
        $app = Invoke-API POST "/workspaces/$wsId/applications" @{
            name          = $appName
            description   = "E2E test application"
            sourcePath    = $samplePath
            containerPort = 8080
            replicas      = 1
        }
        $appId = $app.id
        OK "Created application '$appName' ($appId)"
        if ($app.deploymentStatus -ne "NOT_DEPLOYED") { FAIL "Initial status should be NOT_DEPLOYED, got $($app.deploymentStatus)" }
        else { OK "Initial deployment status is NOT_DEPLOYED" }
        if ($app.k8sDeploymentName -eq $appName) { OK "K8s deployment name is correct" }
        if ($app.k8sServiceName -eq "$appName-svc") { OK "K8s service name is correct" }
    } catch { FAIL "Create application: $_" }

    if ($appId) {
        try {
            $status = Invoke-API GET "/applications/$appId/status"
            if ($status.status -eq "NOT_DEPLOYED") { OK "Status endpoint returns NOT_DEPLOYED" }
            else { FAIL "Status endpoint: unexpected status $($status.status)" }
        } catch { FAIL "Get status: $_" }

        try {
            $apps = Invoke-API GET "/workspaces/$wsId/applications"
            $found = $apps | Where-Object { $_.id -eq $appId }
            if ($found) { OK "List applications: found our app" } else { FAIL "List applications: app not found" }
        } catch { FAIL "List applications: $_" }

        try {
            Invoke-API PUT "/applications/$appId" @{ description = "Updated by e2e" } | Out-Null
            OK "Update application"
        } catch { FAIL "Update application: $_" }
    }
}

# - Step 5-9: Kubernetes operations -

if ($SkipK8s -or -not $k8sOk) {
    INFO "Skipping Kubernetes steps (SkipK8s=$SkipK8s, k8sAvailable=$k8sOk)"
} elseif ($appId) {
    STEP "5. Docker build"
    try {
        $build = Invoke-API POST "/applications/$appId/build"
        if ($build.success) { OK "Build succeeded: image=$($build.imageName)" }
        else                { FAIL "Build failed: $($build.error)" }
    } catch { FAIL "Build: $_" }

    STEP "6. Deploy"
    try {
        $deploy = Invoke-API POST "/applications/$appId/deploy"
        OK "Deploy triggered: status=$($deploy.status)"
    } catch { FAIL "Deploy: $_" }

    STEP "7. Poll status (wait up to 90s for RUNNING)"
    $deadline = (Get-Date).AddSeconds(90)
    $finalStatus = $null
    while ((Get-Date) -lt $deadline) {
        try {
            $s = Invoke-API GET "/applications/$appId/status"
            $finalStatus = $s.status
            INFO "  status=$finalStatus ready=$($s.readyReplicas)/$($s.desiredReplicas)"
            if ($finalStatus -in @("RUNNING","FAILED","BUILD_FAILED")) { break }
        } catch { INFO "  status poll error: $_" }
        Start-Sleep 5
    }
    if ($finalStatus -eq "RUNNING") { OK "Application reached RUNNING state" }
    else { FAIL "Application status after 90s: $finalStatus" }

    STEP "8. Scale to 2 replicas"
    try {
        $scaled = Invoke-API POST "/applications/$appId/scale" @{ replicas = 2 }
        OK "Scale triggered: status=$($scaled.status)"
    } catch { FAIL "Scale: $_" }

    STEP "9. Fetch logs"
    try {
        $logs = Invoke-API GET "/applications/$appId/logs?lines=50"
        if ($logs -and $logs.Length -gt 0) { OK "Logs returned ($($logs.Length) chars)" }
        else { INFO "Logs empty (pods may still be starting)" }
    } catch { FAIL "Logs: $_" }

    STEP "9b. Service info"
    try {
        $svc = Invoke-API GET "/applications/$appId/service"
        if ($svc.type) { OK "Service info: type=$($svc.type) nodePort=$($svc.nodePort)" }
        if ($svc.accessUrl) { INFO "Access URL: $($svc.accessUrl)" }
    } catch { FAIL "Service info: $_" }
}

# - Step 10: Cleanup -

STEP "10. Cleanup"
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

# - Summary -

Write-Host ""
Write-Host "-" -ForegroundColor DarkGray
Write-Host " DevBox E2E Verification Complete" -ForegroundColor White
Write-Host " PASS: $pass   FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) {"Green"} else {"Red"})
Write-Host "-" -ForegroundColor DarkGray

if ($fail -gt 0) { exit 1 } else { exit 0 }

