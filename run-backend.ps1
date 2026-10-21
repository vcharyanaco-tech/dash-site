# ============================================================
# run-backend.ps1 - Run the dashboard backend locally and expose
# it through a Cloudflare quick tunnel, replacing the suspended
# Render service.
#
# What it does, in order:
#   0. Load .env.local if present (DATA_SYNC_URL, WORKER_API_TOKEN, MAIL_*)
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
#   .\run-backend.ps1                 # normal run (also starts the Aadhaar fallback)
#   .\run-backend.ps1 -SkipWrangler   # skip step 5 (e.g. wrangler not logged in)
#   .\run-backend.ps1 -SkipAadhar     # main dashboard only
#   .\run-backend.ps1 -Stop           # stop backend + tunnel from a prior run
#
# Stopping: close the two PowerShell windows the script opens, or run
#   .\run-backend.ps1 -Stop
# ============================================================

param(
  [switch]$SkipWrangler,
  [switch]$SkipAadhar,
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
  $aadharScript = Join-Path $repo 'run-aadhar.ps1'
  if (Test-Path $aadharScript) { & $aadharScript -Stop }
  return
}

# ---------- 0. env ----------
# Load .env.local if present (DATA_SYNC_URL, WORKER_API_TOKEN, MAIL_*),
# mirroring start-server.sh. Vars already in the process env win.
$envFile = Join-Path $repo '.env.local'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    if ($line.StartsWith('export ')) { $line = $line.Substring(7).TrimStart() }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $name = $line.Substring(0, $i).Trim()
    $value = $line.Substring($i + 1).Trim()
    # `source` strips one layer of matching quotes; mirror that so a value
    # like MAIL_HTTP_URL="https://..." loads without the quotes.
    if ($value.Length -ge 2 -and
        (($value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') -or
         ($value[0] -eq "'" -and $value[$value.Length - 1] -eq "'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($name -and -not (Test-Path "Env:$name")) {
      Set-Item -Path "Env:$name" -Value $value
    }
  }
  Write-Host '[env] Loaded .env.local'
}

# ---------- 1. deps ----------
if (-not (Test-Path (Join-Path $serverDir 'node_modules'))) {
  Write-Host '[1/6] Installing backend dependencies (first run only)...'
  Push-Location $serverDir
  npm install
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install failed' }
  Pop-Location
} else {
  Write-Host '[1/6] Dependencies already installed - skipping npm install.'
}

# ---------- 2. backend ----------
Write-Host "[2/6] Starting backend on port $port ..."
$nodeCmd = "node `"$serverDir\start.js`""
# The child inherits the env loaded above, so only default DASH_DATA_DIR when
# .env.local did not set one.
Start-Process powershell -WindowStyle Minimized -ArgumentList @(
  '-NoProfile','-Command',
  "`$PID | Out-File '$pidBackend' -Force; Set-Location '$serverDir'; `$env:PORT='$port'; if (-not `$env:DASH_DATA_DIR) { `$env:DASH_DATA_DIR='$serverDir\data' }; $nodeCmd *> '$logBackend'"
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
  throw 'Backend failed to start - see log above.'
}
Write-Host "Backend healthy on http://localhost:$port/api/health"

# ---------- 3. cloudflared ----------
Write-Host '[3/6] Checking cloudflared...'
# Refresh PATH from the registry: this script may be launched from a shell
# (Startup folder / explorer) whose environment predates installing
# cloudflared or wrangler, so Get-Command would miss them.
function Refresh-Path {
  # Append registry entries that the current process is missing instead of
  # replacing PATH outright: a caller may have session-only entries (nvm, pip,
  # tool shims) that must keep working.
  $current = @($env:Path -split ';' | Where-Object { $_ })
  $fresh = @(
    [Environment]::GetEnvironmentVariable('Path', 'Machine')
    [Environment]::GetEnvironmentVariable('Path', 'User')
  ) -split ';' | Where-Object { $_ }
  $missing = @($fresh | Where-Object { $current -notcontains $_ })
  if ($missing.Count) { $env:Path = (@($current) + $missing) -join ';' }
}
Refresh-Path
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host 'cloudflared not found - installing via winget...'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
  } else {
    Write-Warning 'winget is not available - skipping automatic install.'
  }
  Refresh-Path
  $cf = Get-Command cloudflared -ErrorAction SilentlyContinue
}
if (-not $cf) {
  # winget exits non-zero when the package is already installed but this
  # shell's PATH predates it (Startup-folder launches) - fall back to the
  # known MSI install locations before giving up.
  $known = @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($known) {
    Write-Host "Using cloudflared at: $known"
    $env:Path = (Split-Path $known) + ';' + $env:Path
    $cf = Get-Command cloudflared -ErrorAction SilentlyContinue
  }
}
if (-not $cf) { throw 'cloudflared not available - install manually from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/' }
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
  throw 'Tunnel URL not found - see log above.'
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
# A freshly registered quick tunnel can answer 530 for the first ~10-20s while
# Cloudflare finishes wiring the hostname. Retry instead of warning on the
# first attempt, which is what made a healthy run look broken.
$tunnelOk = $false
$lastErr = ''
for ($i = 0; $i -lt 12 -and -not $tunnelOk; $i++) {
  try {
    $h = Invoke-WebRequest "$tunnelUrl/api/health" -UseBasicParsing -TimeoutSec 20
    if ($h.StatusCode -eq 200) {
      Write-Host 'Tunnel health check: HTTP 200 OK'
      $tunnelOk = $true
      break
    }
  } catch {
    $lastErr = $_.Exception.Message
  }
  if (-not $tunnelOk) { Start-Sleep -Seconds 5 }
}
if (-not $tunnelOk) {
  Write-Warning "Health check through tunnel failed ($lastErr) - the tunnel may need a few more seconds; retry $tunnelUrl/api/health in a browser."
}

Write-Host ''
Write-Host '====================================================='
Write-Host " Dashboard backend is LIVE via: $tunnelUrl"
Write-Host ' Keep this machine on and this window open.'
Write-Host " Stop later:  .\run-backend.ps1 -Stop"
Write-Host ' Logs:        %TEMP%\dash-backend.log / %TEMP%\dash-tunnel.log'
Write-Host '====================================================='

# The Aadhaar Streamlit dashboard is a separate service and a separate tunnel.
# Start it after the main backend is healthy so a failure there does not stop
# the main dashboard from coming up.
if ($SkipAadhar) {
  Write-Host 'Aadhaar fallback skipped (-SkipAadhar).'
} else {
  $aadharScript = Join-Path $repo 'run-aadhar.ps1'
  if (Test-Path $aadharScript) {
    Write-Host ''
    Write-Host 'Starting the Aadhaar dashboard fallback...'
    try {
      & $aadharScript
    } catch {
      Write-Warning "Aadhaar fallback failed: $($_.Exception.Message)"
      Write-Warning "Run .\run-aadhar.ps1 directly after fixing it."
    }
  } else {
    Write-Warning 'run-aadhar.ps1 not found; Aadhaar dashboard was not started.'
  }
}
