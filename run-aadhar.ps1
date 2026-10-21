# ============================================================
# run-aadhar.ps1 - Emergency local Aadhaar Streamlit fallback.
#
# Aadhaar normally runs on its own Render account. The dash-site
# Worker routes /aadhar-dashboard/* to AADHAR_ORIGIN, which points
# at that Render service. This script starts the app from the
# sibling aadhar-dashboard repo, opens a quick tunnel, and
# temporarily repoints that Worker secret at the tunnel.
#
# Usage:
#   .\run-aadhar.ps1                  # normal run (reuses a healthy run)
#   .\run-aadhar.ps1 -SkipWrangler    # start locally, leave the secret alone
#   .\run-aadhar.ps1 -Stop            # stop app + tunnel; restore Render origin
#   .\run-aadhar.ps1 -Port 8502       # non-default local port
#
# The quick-tunnel hostname changes every time it starts, so the Worker
# secret must be updated on every run. The fallback is manual; it is not
# started by the Startup folder unless run-backend.ps1 -WithAadhar is used.
# ============================================================

param(
  [switch]$SkipWrangler,
  [switch]$Stop,
  [int]$Port = 8501
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$aadharDir = Join-Path (Split-Path -Parent $repo) 'aadhar-dashboard'
$python = Join-Path $aadharDir '.venv\Scripts\python.exe'
$wranglerCfg = Join-Path $repo 'src\worker\wrangler.toml'
$renderOrigin = 'https://aadhar-dashboard-9ljo.onrender.com'
$healthPath = '/aadhar-dashboard/_stcore/health'
$localHealth = "http://localhost:$Port$healthPath"
$publicHealth = "https://dashboardharyana.site$healthPath"

$pidApp = Join-Path $env:TEMP 'aadhar-app.pid'
$pidTunnel = Join-Path $env:TEMP 'aadhar-tunnel.pid'
$logApp = Join-Path $env:TEMP 'aadhar-app.log'
$logTunnel = Join-Path $env:TEMP 'aadhar-tunnel.log'
$urlFile = Join-Path $env:TEMP 'aadhar-tunnel.url'
$pidWatchdog = Join-Path $env:TEMP 'tunnel-watchdog.pid'
$watchModeFile = Join-Path $env:TEMP 'tunnel-watchdog.mode'
$envFile = Join-Path $aadharDir '.env.local'
$envMarker = Join-Path $env:TEMP 'aadhar-app.envhash'

function Stop-Tree([int]$ProcessId) {
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Tree $_.ProcessId }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-FromPidFile([string]$File) {
  if (-not (Test-Path $File)) { return }
  $saved = Get-Content $File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($saved) { Stop-Tree ([int]$saved) }
  Remove-Item $File -Force -ErrorAction SilentlyContinue
}

function Test-Healthy([string]$Url) {
  try {
    $r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 5
    return ($r.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Find-Cloudflared {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $known = @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  return $known
}

function Import-AadharEnv([string]$File) {
  # Minimal .env parser; the file is local and ignored by git. Only AADHAR_*
  # names are accepted so this cannot silently override unrelated process state.
  Get-Content $File -ErrorAction Stop | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
      $eq = $line.IndexOf('=')
      if ($eq -gt 0) {
        $name = $line.Substring(0, $eq).Trim()
        if ($name -match '^AADHAR_[A-Z0-9_]+$') {
          $value = $line.Substring($eq + 1).Trim()
          if ($value.Length -ge 2 -and (
              ($value.StartsWith('"') -and $value.EndsWith('"')) -or
              ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
          }
          Set-Item -Path "Env:$name" -Value $value
        }
      }
    }
  }
}

# ---------- -Stop ----------
if ($Stop) {
  # Stop a full watchdog so it cannot restart this tunnel while stopping. A
  # main-only watchdog belongs to dash-site and must keep running.
  if (Test-Path $pidWatchdog) {
    $savedWatchdog = Get-Content $pidWatchdog -ErrorAction SilentlyContinue | Select-Object -First 1
    $watchMode = Get-Content $watchModeFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($savedWatchdog -and $watchMode -eq 'main') {
      Write-Host 'Leaving the main-only dash-site watchdog running.'
    } else {
      Stop-FromPidFile $pidWatchdog
    }
  }
  Stop-FromPidFile $pidApp
  Stop-FromPidFile $pidTunnel
  Remove-Item $urlFile -Force -ErrorAction SilentlyContinue
  Remove-Item $envMarker -Force -ErrorAction SilentlyContinue
  Write-Host 'Stopped the Aadhaar app and tunnel (if they were running).'
  if ($SkipWrangler) {
    Write-Host 'AADHAR_ORIGIN left unchanged (-SkipWrangler).'
  } else {
    try {
      $renderOrigin | wrangler secret put AADHAR_ORIGIN --config $wranglerCfg 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "AADHAR_ORIGIN restored to $renderOrigin"
      } else {
        Write-Warning "Could not restore AADHAR_ORIGIN; set it manually to $renderOrigin."
      }
    } catch {
      Write-Warning "Could not restore AADHAR_ORIGIN; set it manually to $renderOrigin."
    }
  }
  return
}

if (-not (Test-Path $aadharDir)) {
  throw "Aadhaar dashboard repo not found at $aadharDir"
}
if (-not (Test-Path $python)) {
  throw "Python virtualenv not found at $python. Set up the aadhar-dashboard .venv first."
}

# Local bridge credentials: AADHAR_SYNC_URL / AADHAR_SYNC_TOKEN.
# .env.local is gitignored; never print its values.
$envHash = ''
if (Test-Path $envFile) {
  Import-AadharEnv $envFile
  $envHash = (Get-FileHash $envFile -Algorithm SHA256).Hash
  Write-Host "[env] Loaded Aadhaar bridge settings from $envFile"
}

# ---------- 1. Streamlit app ----------
$runningHash = ''
if (Test-Path $envMarker) {
  $runningHash = (Get-Content $envMarker -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (-not $runningHash) { $runningHash = '' }
}
$appHealthy = Test-Healthy $localHealth
$envChanged = $appHealthy -and ($runningHash -ne $envHash)

if ($appHealthy -and -not $envChanged) {
  Write-Host "[1/4] Aadhaar app already healthy on $localHealth - reusing it."
} else {
  if ($appHealthy -and $envChanged) {
    Write-Host '[1/4] Aadhaar app environment changed - restarting it with the new settings.'
  }
  Stop-FromPidFile $pidApp
  Remove-Item $logApp -Force -ErrorAction SilentlyContinue
  Write-Host "[1/4] Starting Streamlit on port $Port ..."
  $child = "`$PID | Out-File '$pidApp' -Force; Set-Location '$aadharDir'; `$env:PORT='$Port'; & '$python' boot.py *> '$logApp'"
  Start-Process powershell -WindowStyle Minimized -ArgumentList @('-NoProfile', '-Command', $child)

  $appOk = $false
  for ($i = 0; $i -lt 45 -and -not $appOk; $i++) {
    Start-Sleep -Seconds 1
    $appOk = Test-Healthy $localHealth
  }
  if (-not $appOk) {
    Write-Host 'Aadhaar app did not become healthy. Last log lines:'
    if (Test-Path $logApp) { Get-Content $logApp -Tail 40 }
    throw 'Streamlit failed to start - see log above.'
  }
  Set-Content -Path $envMarker -Value $envHash -NoNewline
  Write-Host "Aadhaar app healthy on $localHealth"
}

# ---------- 2. cloudflared tunnel ----------
$tunnelUrl = $null
if (Test-Path $urlFile) {
  $candidate = ((Get-Content $urlFile -ErrorAction SilentlyContinue | Select-Object -First 1) + '').Trim()
  if ($candidate -and (Test-Healthy "$candidate$healthPath")) {
    $tunnelUrl = $candidate
    Write-Host "[2/4] Existing tunnel still healthy - reusing $tunnelUrl"
  }
}

if (-not $tunnelUrl) {
  Stop-FromPidFile $pidTunnel
  Remove-Item $logTunnel -Force -ErrorAction SilentlyContinue

  $cf = Find-Cloudflared
  if (-not $cf) {
    throw 'cloudflared not found. Run .\run-backend.ps1 first or install cloudflared.'
  }

  Write-Host '[2/4] Starting quick tunnel for the Aadhaar app ...'
  $child = "`$PID | Out-File '$pidTunnel' -Force; & '$cf' tunnel --url http://localhost:$Port *> '$logTunnel'"
  Start-Process powershell -WindowStyle Minimized -ArgumentList @('-NoProfile', '-Command', $child)

  for ($i = 0; $i -lt 30 -and -not $tunnelUrl; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $logTunnel) {
      $m = Select-String -Path $logTunnel -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
           Select-Object -First 1
      if ($m) { $tunnelUrl = $m.Matches[0].Value }
    }
  }
  if (-not $tunnelUrl) {
    Write-Host 'Could not find a trycloudflare.com URL. Last log lines:'
    if (Test-Path $logTunnel) { Get-Content $logTunnel -Tail 40 }
    throw 'Tunnel URL not found - see log above.'
  }
  Set-Content -Path $urlFile -Value $tunnelUrl -NoNewline

  $tunnelOk = $false
  # A fresh quick tunnel can answer 530 for around a minute while Cloudflare
  # finishes wiring the hostname. Wait up to 90 s so the watchdog usually
  # recovers in one pass instead of creating another tunnel on the next tick.
  for ($i = 0; $i -lt 30 -and -not $tunnelOk; $i++) {
    $tunnelOk = Test-Healthy "$tunnelUrl$healthPath"
    if (-not $tunnelOk) { Start-Sleep -Seconds 3 }
  }
  if (-not $tunnelOk) {
    throw "Tunnel is up at $tunnelUrl but the health check did not pass yet."
  }
}

# ---------- 3. Worker secret ----------
if ($SkipWrangler) {
  Write-Host '[3/4] Skipping AADHAR_ORIGIN update (-SkipWrangler).'
} else {
  Write-Host '[3/4] Updating Worker secret AADHAR_ORIGIN ...'
  Push-Location (Join-Path $repo 'src\worker')
  try {
    $tunnelUrl | wrangler secret put AADHAR_ORIGIN --config $wranglerCfg 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw "wrangler secret put failed ($LASTEXITCODE)" }
    Write-Host 'AADHAR_ORIGIN updated.'
  } finally {
    Pop-Location
  }
}

# ---------- 4. End-to-end check ----------
Write-Host '[4/4] Verifying the public route ...'
$publicOk = $false
for ($i = 0; $i -lt 12 -and -not $publicOk; $i++) {
  $publicOk = Test-Healthy $publicHealth
  if (-not $publicOk) { Start-Sleep -Seconds 2 }
}
if (-not $publicOk) {
  Write-Warning "Public health check failed. The Worker may still be propagating: $publicHealth"
} else {
  Write-Host "Public route healthy: $publicHealth"
}

Write-Host ''
Write-Host '====================================================='
Write-Host " Aadhaar dashboard is LIVE via: $tunnelUrl"
Write-Host " Public URL: https://dashboardharyana.site/aadhar-dashboard/"
Write-Host ' Keep this machine on; the app and tunnel stop on shutdown.'
Write-Host " Stop later: .\run-aadhar.ps1 -Stop"
Write-Host ' Logs: %TEMP%\aadhar-app.log / %TEMP%\aadhar-tunnel.log'
Write-Host '====================================================='
