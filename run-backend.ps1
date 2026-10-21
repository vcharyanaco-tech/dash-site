# ============================================================
# run-backend.ps1 — Run the dashboard backend locally and expose
# it through a Cloudflare quick tunnel, replacing the suspended
# Render service.
#
# What it does, in order:
#   1. npm install in src/server (skipped if node_modules exists)
#   2. Start the Node backend (port 8787) in a hidden window
#   3. Start `cloudflared tunnel --url http://localhost:8787`
#      (installs cloudflared via winget if missing)
#   4. Parse the https://xxxx.trycloudflare.com URL from tunnel output
#   5. Update the Cloudflare Worker secret SERVER_ORIGIN to that URL
#      (wrangler secret put SERVER_ORIGIN, config: src/worker/wrangler.toml)
#   6. Verify GET /api/health through the tunnel returns 200
#
# Usage:
#   .\run-backend.ps1                 # normal run
#   .\run-backend.ps1 -SkipWrangler   # skip step 5 (e.g. wrangler not logged in)
#   .\run-backend.ps1 -Stop           # stop backend + tunnel from a prior run
#
# Stopping: close the two PowerShell windows the script opens, or run
#   .\run-backend.ps1 -Stop
# ============================================================

param(
  [switch]$SkipWrangler,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $repo 'src\server'
$wranglerCfg = Join-Path $repo 'src\worker\wrangler.toml'
$port = 8787
$pidBackend = Join-Path $env:TEMP 'dash-backend.pid'
$pidTunnel  = Join-Path $env:TEMP 'dash-tunnel.pid'
$logBackend = Join-Path $env:TEMP 'dash-backend.log'
$logTunnel  = Join-Path $env:TEMP 'dash-tunnel.log'

# ---------- -Stop ----------
if ($Stop) {
  foreach ($f in @($pidBackend, $pidTunnel)) {
    if (Test-Path $f) {
      $p = Get-Content $f -ErrorAction SilentlyContinue
      if ($p) {
        try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } catch {}
        # kill child processes too (cloudflared / node children)
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$p" -ErrorAction SilentlyContinue |
          ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
      }
      Remove-Item $f -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Host 'Stopped backend and tunnel (if they were running).'
  return
}

# ---------- 1. deps ----------
if (-not (Test-Path (Join-Path $serverDir 'node_modules'))) {
  Write-Host '[1/6] Installing backend dependencies (first run only)...'
  Push-Location $serverDir
  npm install
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install failed' }
  Pop-Location
} else {
  Write-Host '[1/6] Dependencies already installed — skipping npm install.'
}

# ---------- 2. backend ----------
Write-Host "[2/6] Starting backend on port $port ..."
$nodeCmd = "node `"$serverDir\start.js`""
Start-Process powershell -WindowStyle Minimized -ArgumentList @(
  '-NoProfile','-Command',
  "`$PID | Out-File '$pidBackend' -Force; Set-Location '$serverDir'; `$env:PORT='$port'; `$env:DASH_DATA_DIR='$serverDir\data'; $nodeCmd *> '$logBackend'"
)
# wait for the port to open
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest "http://localhost:$port/api/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
}
if (-not $ok) {
  Write-Host "Backend did not become healthy in 30s. Last log lines:"
  if (Test-Path $logBackend) { Get-Content $logBackend -Tail 30 }
  throw 'Backend failed to start — see log above.'
}
Write-Host "Backend healthy on http://localhost:$port/api/health"

# ---------- 3. cloudflared ----------
Write-Host '[3/6] Checking cloudflared...'
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host 'cloudflared not found — installing via winget...'
  winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { throw 'winget install of cloudflared failed — install manually from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/' }
  # refresh PATH for this session
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}
# kill any previous tunnel still bound (uses same logfile name)
if (Test-Path $logTunnel) { Remove-Item $logTunnel -Force -ErrorAction SilentlyContinue }

Write-Host '[4/6] Starting quick tunnel...'
Start-Process powershell -WindowStyle Minimized -ArgumentList @(
  '-NoProfile','-Command',
  "`$PID | Out-File '$pidTunnel' -Force; cloudflared tunnel --url http://localhost:$port *> '$logTunnel'"
)
Start-Sleep -Seconds 6

# ---------- 4. parse tunnel URL ----------
$tunnelUrl = $null
for ($i = 0; $i -lt 20 -and -not $tunnelUrl; $i++) {
  if (Test-Path $logTunnel) {
    $m = Select-String -Path $logTunnel -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
         Select-Object -First 1
    if ($m) { $tunnelUrl = $m.Matches[0].Value }
  }
  if (-not $tunnelUrl) { Start-Sleep -Seconds 2 }
}
if (-not $tunnelUrl) {
  Write-Host 'Could not find a trycloudflare.com URL in tunnel log. Last lines:'
  if (Test-Path $logTunnel) { Get-Content $logTunnel -Tail 30 }
  throw 'Tunnel URL not found — see log above.'
}
Write-Host "Tunnel live at: $tunnelUrl"

# ---------- 5. update SERVER_ORIGIN ----------
if ($SkipWrangler) {
  Write-Host '[5/6] Skipping SERVER_ORIGIN update (-SkipWrangler).'
} else {
  Write-Host '[5/6] Updating Worker secret SERVER_ORIGIN ...'
  Push-Location (Join-Path $repo 'src\worker')
  $tunnelUrl | wrangler secret put SERVER_ORIGIN --config $wranglerCfg 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Warning 'wrangler secret put failed. Run manually:'
    Write-Host "  wrangler login"
    Write-Host "  echo $tunnelUrl | wrangler secret put SERVER_ORIGIN --config src\worker\wrangler.toml"
  } else {
    Write-Host 'SERVER_ORIGIN updated.'
  }
  Pop-Location
}

# ---------- 6. end-to-end health ----------
Write-Host '[6/6] Verifying health through the tunnel...'
try {
  $h = Invoke-WebRequest "$tunnelUrl/api/health" -UseBasicParsing -TimeoutSec 20
  Write-Host "Tunnel health check: HTTP $($h.StatusCode) OK"
} catch {
  Write-Warning "Health check through tunnel failed ($($_.Exception.Message)) — the tunnel may need a few more seconds; retry $tunnelUrl/api/health in a browser."
}

Write-Host ''
Write-Host '====================================================='
Write-Host " Dashboard backend is LIVE via: $tunnelUrl"
Write-Host ' Keep this machine on and this window open.'
Write-Host " Stop later:  .\run-backend.ps1 -Stop"
Write-Host ' Logs:        %TEMP%\dash-backend.log / %TEMP%\dash-tunnel.log'
Write-Host '====================================================='
