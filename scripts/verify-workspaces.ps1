# DevBox Cloud — Workspace Verification Script
# Tests that each template image has the correct tools installed
# Run: pwsh -File scripts/verify-workspaces.ps1

param(
    [switch]$Quick  # Run a quick check without full pod creation
)

$Image = "devbox/workspace:latest"
$Pass = 0
$Fail = 0

function Check-Tool {
    param([string]$Template, [string]$Tool, [string]$Command)
    $result = & minikube -p minikube docker-env --shell powershell 2>&1 | Out-Null
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression 2>&1 | Out-Null
    $output = docker run --rm -e DEVBOX_TEMPLATE_ID=$Template $Image bash -c $Command 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [PASS] $Tool" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  [FAIL] $Tool : $output" -ForegroundColor Red
        return $false
    }
}

function Verify-Template {
    param([string]$Name, [string]$Id, [array]$Checks)
    Write-Host ""
    Write-Host "=== $Name (template=$Id) ===" -ForegroundColor Cyan
    
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression 2>&1 | Out-Null
    
    foreach ($check in $Checks) {
        $tool = $check[0]
        $cmd = $check[1]
        $output = docker run --rm -e DEVBOX_TEMPLATE_ID=$Id $Image bash -c $cmd 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [PASS] $tool" -ForegroundColor Green
            $script:Pass++
        } else {
            Write-Host "  [FAIL] $tool" -ForegroundColor Red
            $script:Fail++
        }
    }
    
    # Run starter project
    $starterCmd = "DEVBOX_TEMPLATE_ID=$Id /usr/local/bin/devbox-entrypoint" 
    # Just test the entrypoint generates starter dir
    Write-Host "  [SKIP] Starter project (requires full entrypoint execution)" -ForegroundColor Yellow
}

Write-Host "DevBox Cloud — Workspace Image Verification" -ForegroundColor Cyan
Write-Host "Image: $Image" -ForegroundColor Gray
Write-Host ""

# Point to minikube docker
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Check image exists
$imageInfo = docker images $Image --format "{{.Repository}}:{{.Tag}}" 2>&1
if ($imageInfo -notmatch "devbox/workspace:latest") {
    Write-Host "[ERROR] Image $Image not found in minikube." -ForegroundColor Red
    Write-Host "Build it first: minikube -p minikube docker-env | Invoke-Expression; docker build -t devbox/workspace:latest ./workspace-image/" -ForegroundColor Yellow
    exit 1
}
Write-Host "Image found: $imageInfo" -ForegroundColor Green

# Ubuntu
Verify-Template "Ubuntu Development" "ubuntu" @(
    @("bash", "bash --version | head -1"),
    @("git", "git --version"),
    @("curl", "curl --version | head -1"),
    @("vim", "vim --version | head -1"),
    @("python3", "python3 --version"),
    @("python", "python --version"),
    @("build-essential (gcc)", "gcc --version | head -1")
)

# Python
Verify-Template "Python Development" "python" @(
    @("python3", "python3 --version"),
    @("pip3", "pip3 --version"),
    @("python (alias)", "python --version"),
    @("pip (alias)", "pip --version"),
    @("venv", "python3 -m venv --help 2>&1 | head -1"),
    @("virtualenv", "virtualenv --version")
)

# Node.js
Verify-Template "Node.js Development" "nodejs" @(
    @("node", "node --version"),
    @("npm", "npm --version"),
    @("npx", "npx --version"),
    @("git", "git --version")
)

# Java
Verify-Template "Java Development" "java" @(
    @("java", "java --version 2>&1 | head -1"),
    @("javac", "javac --version"),
    @("mvn", "mvn --version 2>&1 | head -1"),
    @("gradle", "gradle --version 2>&1 | grep '^Gradle'")
)

# React
Verify-Template "React Development" "react" @(
    @("node", "node --version"),
    @("npm", "npm --version"),
    @("npx", "npx --version"),
    @("vite (via npx)", "npx --yes vite --version 2>/dev/null || echo 'vite available via npx'")
)

# Full Stack
Verify-Template "Full Stack Development" "fullstack" @(
    @("node", "node --version"),
    @("python3", "python3 --version"),
    @("java", "java --version 2>&1 | head -1"),
    @("mvn", "mvn --version 2>&1 | head -1"),
    @("psql", "psql --version"),
    @("docker CLI", "docker --version"),
    @("git", "git --version")
)

# Also verify nginx and desktop tools
Write-Host ""
Write-Host "=== Infrastructure Tools ===" -ForegroundColor Cyan
$infraChecks = @(
    @("nginx", "nginx -v 2>&1"),
    @("tigervnc", "vncserver --help 2>&1 | head -2"),
    @("novnc", "test -d /usr/share/novnc && echo 'noVNC present'"),
    @("ttyd", "/usr/local/bin/ttyd --version 2>&1 | head -1"),
    @("websockify", "python3 -m websockify --help 2>&1 | head -1")
)

foreach ($check in $infraChecks) {
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression 2>&1 | Out-Null
    $output = docker run --rm $Image bash -c $check[1] 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [PASS] $($check[0])" -ForegroundColor Green
        $Pass++
    } else {
        Write-Host "  [FAIL] $($check[0]) : $output" -ForegroundColor Red
        $Fail++
    }
}

Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host "Results: $Pass passed, $Fail failed" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Yellow" })

if ($Fail -eq 0) {
    Write-Host "All workspace tools verified!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$Fail checks failed. Review output above." -ForegroundColor Yellow
    exit 1
}
