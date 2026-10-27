# DevBox Cloud — Workspace Direct Access
# Opens a workspace's terminal or desktop in the browser via kubectl port-forward
# Usage: pwsh -File scripts/workspace-access.ps1 -EnvironmentId 2 -Type terminal

param(
    [Parameter(Mandatory=$true)]
    [int]$EnvironmentId,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("terminal", "desktop", "web")]
    [string]$Type = "terminal",
    
    [Parameter(Mandatory=$false)]
    [int]$LocalPort = 0  # 0 = auto-assign
)

# Get namespace from environment ID via API
$h = @{ "Content-Type" = "application/json" }
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/trpc/auth.localLogin" -Method POST -Headers $h -Body '{"json":{}}' -SessionVariable ws -ErrorAction Stop
$envResp = Invoke-WebRequest -Uri "http://localhost:3000/api/trpc/environment.detail?input=$([uri]::EscapeDataString('{""json"":{""environmentId"":' + $EnvironmentId + '}}}'))" -Method GET -WebSession $ws -ErrorAction Stop
$env = ($envResp.Content | ConvertFrom-Json).result.data.json.environment

if (-not $env) {
    Write-Host "Environment $EnvironmentId not found." -ForegroundColor Red
    exit 1
}

$namespace = $env.namespace
$status = $env.status

Write-Host "Environment: $($env.name)" -ForegroundColor Cyan
Write-Host "Namespace:   $namespace" -ForegroundColor Gray
Write-Host "Status:      $status" -ForegroundColor $(if ($status -eq "running") { "Green" } else { "Yellow" })

if ($status -ne "running") {
    Write-Host "Warning: Environment is not running (status=$status)" -ForegroundColor Yellow
}

# Pick a free local port
if ($LocalPort -eq 0) {
    $LocalPort = Get-Random -Minimum 18000 -Maximum 19000
}

Write-Host ""
Write-Host "Starting port-forward on localhost:$LocalPort -> workspace:8080" -ForegroundColor Cyan

$path = switch ($Type) {
    "terminal" { "/terminal/" }
    "desktop"  { "/desktop/vnc.html?autoconnect=true&path=websockify" }
    "web"      { "/" }
}

$url = "http://localhost:$LocalPort$path"

Write-Host "Access URL: $url" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel." -ForegroundColor Gray
Write-Host ""

# Open browser
Start-Process $url

# Start port-forward (blocking)
kubectl port-forward -n $namespace service/workspace "${LocalPort}:8080"
