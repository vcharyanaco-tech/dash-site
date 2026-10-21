# ============================================================
# watch-tunnels.ps1 - Keep the local fallback tunnel(s) alive.
#
# Cloudflare quick tunnels have no uptime guarantee. After a network
# interruption cloudflared cannot re-register the old hostname (the edge
# answers "Unauthorized: Tunnel not found"), so the only recovery is a new
# quick tunnel and a new Worker secret.
#
# By default only the main dash-site tunnel is monitored. Aadhaar now runs on
# Render; pass -SkipAadhar explicitly for the main-only mode (run-backend.ps1
# does this by default). Without -SkipAadhar, the old two-tunnel fallback mode
# is preserved.
#
# Started automatically by run-backend.ps1. Stop it with:
#   .\run-backend.ps1 -Stop
# ============================================================

param(
  [switch]$SkipAadhar
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $env:TEMP 'tunnel-watchdog.pid'
$modeFile = Join-Path $env:TEMP 'tunnel-watchdog.mode'
$logFile = Join-Path $env:TEMP 'tunnel-watchdog.log'
$mainProbe = 'https://dashboardharyana.site/api'
$aadharProbe = 'https://dashboardharyana.site/aadhar-dashboard/_stcore/health'

# Avoid a second copy if the pid file still points at a live process.
if (Test-Path $pidFile) {
  $existing = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing -and (Get-Process -Id ([int]$existing) -ErrorAction SilentlyContinue)) {
    return
  }
}
$PID | Out-File $pidFile -Force
$mode = if ($SkipAadhar) { 'main' } else { 'full' }
Set-Content -Path $modeFile -Value $mode -NoNewline

if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 2MB)) {
  Move-Item $logFile "$logFile.old" -Force -ErrorAction SilentlyContinue
}

function Log([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz') $Message"
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

function Test-MainOrigin {
  # /api/health is answered by the Worker itself, so it cannot prove the
  # tunnel is up. POST /api goes to the Node backend; even its "Unknown
  # function" response proves the origin is reachable.
  try {
    $r = Invoke-WebRequest -Uri $mainProbe -Method POST -UseBasicParsing `
      -ContentType 'application/json' -Body '{"function":"__watchdog_probe__"}' -TimeoutSec 25
    return ($r.StatusCode -lt 500)
  } catch {
    $resp = $_.Exception.Response
    if ($resp) { return ([int]$resp.StatusCode -lt 500) }
    return $false
  }
}

function Test-AadharOrigin {
  try {
    $r = Invoke-WebRequest -Uri $aadharProbe -UseBasicParsing -TimeoutSec 25
    return ($r.StatusCode -eq 200)
  } catch {
    return $false
  }
}

Log "watchdog started (pid $PID, mode $mode)"

while ($true) {
  if (-not (Test-MainOrigin)) {
    Log 'main backend tunnel is down; restarting it'
    try {
      & (Join-Path $repo 'run-backend.ps1') -SkipAadhar -NoWatchdog
      Log 'main backend tunnel restart finished'
    } catch {
      Log "main backend tunnel restart failed: $($_.Exception.Message)"
    }
  }

  if (-not $SkipAadhar -and -not (Test-AadharOrigin)) {
    Log 'Aadhaar tunnel is down; restarting it'
    try {
      & (Join-Path $repo 'run-aadhar.ps1')
      Log 'Aadhaar tunnel restart finished'
    } catch {
      Log "Aadhaar tunnel restart failed: $($_.Exception.Message)"
    }
  }

  Start-Sleep -Seconds 60
}
