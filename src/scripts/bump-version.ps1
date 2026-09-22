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

# Build date stamped into the client ("About" build line) and used as the
# SW cache-rollover base so app.js/APP_BUILD and SW_VERSION can never diverge.
$buildStamp = Get-Date -Format "yyyy.MM.dd"

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
    $s = [regex]::Replace($s, [regex]::Escape($m.Groups[1].Value + "." + $m.Groups[2].Value + "." + $m.Groups[3].Value), $newVersion)
    # Stamp the APP_BUILD date from the same clock as SW_VERSION below.
    # String.Replace (not regex) keeps endings where 2-digit day/date tokens
    # would otherwise be misread as backreferences (e.g. '$1' + '2026.09.22').
    $bd = [regex]::Match($s, "const APP_BUILD = '([0-9]{4}\.[0-9]{2}\.[0-9]{2})';")
    if ($bd.Success) {
        $oldBuild = "const APP_BUILD = '$($bd.Groups[1].Value)';"
        $newBuild = "const APP_BUILD = '$buildStamp';"
        $s = $s.Replace($oldBuild, $newBuild)
    }
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
