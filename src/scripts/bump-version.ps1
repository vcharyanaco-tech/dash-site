# bump-version.ps1
# Keeps the dashboard's user-visible/runtime version in sync.
# Usage: .\bump-version.ps1 [major|minor|patch|<explicit-version>]
param(
    [Parameter(Position=0)]
    [string]$Mode = "patch"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$appJs = Join-Path $root "app.js"
if (-not (Test-Path $appJs)) { throw "app.js not found at $appJs" }
$text = Get-Content $appJs -Raw
$m = [regex]::Match($text, "const APP_VERSION = '([0-9]+)\.([0-9]+)\.([0-9]+)';")
if (-not $m.Success) { throw "Could not find APP_VERSION in app.js" }

$major = [int]$m.Groups[1].Value
$minor = [int]$m.Groups[2].Value
$patch = [int]$m.Groups[3].Value

if ($Mode -match '^\d+\.\d+\.\d+$') {
    $newVersion = $Mode
} else {
    switch ($Mode.ToLowerInvariant()) {
        "major" { $major++; $minor = 0; $patch = 0 }
        "minor" { $minor++; $patch = 0 }
        "patch" { $patch++ }
        default { throw "Mode must be major, minor, patch, or an explicit x.y.z version." }
    }
    $newVersion = "$major.$minor.$patch"
}

$files = @(
    "app.js",
    "src/app/core.js",
    "src/server/config.js",
    "app.html",
    "index.html",
    "src/app/entry.js"
)

foreach ($rel in $files) {
    $path = Join-Path $root $rel
    $s = Get-Content $path -Raw
    # Replace only the current semantic version, preserving surrounding text.
    $s = $s.Replace($m.Value, $m.Value) # no-op; keeps PowerShell string handling predictable
    $s = [regex]::Replace($s, [regex]::Escape($m.Groups[1].Value + "." + $m.Groups[2].Value + "." + $m.Groups[3].Value), $newVersion)
    Set-Content -Path $path -Value $s -NoNewline
}

# Force a service-worker cache rollover for the new release.
$sw = Join-Path $root "sw.js"
$swText = Get-Content $sw -Raw
$stamp = Get-Date -Format "yyyy.MM.dd-HHmmss"
$swText = [regex]::Replace($swText, "const SW_VERSION = '[^']+';", "const SW_VERSION = '$stamp-v$newVersion';")
Set-Content -Path $sw -Value $swText -NoNewline

Write-Host "Dashboard version: $($m.Groups[1].Value).$($m.Groups[2].Value).$($m.Groups[3].Value) -> $newVersion" -ForegroundColor Green
Write-Output $newVersion
