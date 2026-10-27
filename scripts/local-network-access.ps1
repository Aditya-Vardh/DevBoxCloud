# DevBox Cloud — Local Network Access Setup
# Enables other devices on the same Wi-Fi to reach the dashboard
# Run as Administrator: pwsh -File scripts/local-network-access.ps1

param(
    [switch]$Remove  # Remove the firewall rule instead of adding it
)

$RuleName = "DevBox Cloud - Local Demo"
$Port = 3000

if ($Remove) {
    Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    Write-Host "Firewall rule '$RuleName' removed." -ForegroundColor Yellow
    exit 0
}

# Get the machine's local IP on Wi-Fi or Ethernet
$localIPs = Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
    Select-Object -ExpandProperty IPAddress

Write-Host "DevBox Cloud — Local Network Access Setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Machine IP addresses:" -ForegroundColor Gray
foreach ($ip in $localIPs) {
    Write-Host "  $ip" -ForegroundColor Green
}
Write-Host ""

# Add Windows Firewall rule for port 3000 (Domain and Private profiles only)
$existingRule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($existingRule) {
    Write-Host "Firewall rule already exists." -ForegroundColor Yellow
} else {
    New-NetFirewallRule `
        -DisplayName $RuleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $Port `
        -Action Allow `
        -Profile Domain,Private `
        -Description "DevBox Cloud development server - local demo access" | Out-Null
    Write-Host "Firewall rule added: TCP $Port (Domain + Private profiles)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Access DevBox Cloud from other devices on this network:" -ForegroundColor Cyan
foreach ($ip in $localIPs) {
    Write-Host "  http://$($ip):$Port" -ForegroundColor White
}
Write-Host ""
Write-Host "Notes:" -ForegroundColor Gray
Write-Host "  - This machine must remain on with 'pnpm dev' running" -ForegroundColor Gray  
Write-Host "  - Other devices must be on the same Wi-Fi network" -ForegroundColor Gray
Write-Host "  - The firewall rule only applies to Domain and Private networks" -ForegroundColor Gray
Write-Host "  - Public Wi-Fi (hotspots) will NOT expose the server" -ForegroundColor Gray
Write-Host ""
Write-Host "To remove access when done:" -ForegroundColor Gray
Write-Host "  pwsh -File scripts/local-network-access.ps1 -Remove" -ForegroundColor Gray
