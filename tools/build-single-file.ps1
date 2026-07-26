<#
  build-single-file.ps1 — TAM Intelligence OS (Release Automation, v2.6.4+)
  Windows/PowerShell equivalent of tools/build-single-file.js (no Node required).
  Inlines css/ and js/ into dist/tam-intelligence-os-v${APP_VERSION}.html. No minification.
  The version is DERIVED from js/core/constants.js (single source of truth) — never
  hardcoded here — so the output filename follows APP_VERSION automatically.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$LF   = "`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Read-Lf([string]$p){ [System.IO.File]::ReadAllText($p) }

# ---- Derive the release version from js/core/constants.js (same source the JS tooling uses) ----
function Get-AppMeta {
  $constants = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\js\core\constants.js'))
  $vm = [regex]::Match($constants, "const\s+APP_VERSION\s*=\s*'([^']+)'")
  $rm = [regex]::Match($constants, "const\s+APP_RELEASE_NAME\s*=\s*'([^']+)'")
  if(-not $vm.Success){ throw 'Could not parse APP_VERSION from js/core/constants.js — release tooling cannot derive the version.' }
  if(-not $rm.Success){ throw 'Could not parse APP_RELEASE_NAME from js/core/constants.js.' }
  $ver = $vm.Groups[1].Value
  if($ver -notmatch '^\d+\.\d+\.\d+[a-z]?$'){ throw "APP_VERSION '$ver' is not a recognized version format (expected x.y.z with an optional hotfix letter)." }
  return [pscustomobject]@{ Version = $ver; ReleaseName = $rm.Groups[1].Value; DistName = "tam-intelligence-os-v$ver.html" }
}
$meta = Get-AppMeta

$cssFiles = @('tokens.css','base.css','shell.css','components.css','charts.css')
# JS load order comes from the shared manifest tools/module-order.js (single source of truth).
$jsFiles  = (Select-String -Path (Join-Path $PSScriptRoot 'module-order.js') -Pattern "'([^']+\.js)'" -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value })

$html = Read-Lf (Join-Path $root 'index.html')

$cssLinkBlock = ($cssFiles | ForEach-Object { '<link rel="stylesheet" href="css/' + $_ + '">' }) -join $LF
$jsTagBlock   = ($jsFiles  | ForEach-Object { '<script src="js/' + $_ + '"></script>' }) -join $LF
if(-not $html.Contains($cssLinkBlock)){ throw 'CSS <link> block not found in index.html.' }
if(-not $html.Contains($jsTagBlock)){   throw 'JS <script src> block not found in index.html.' }

$cssInline = '<style>' + $LF + (($cssFiles | ForEach-Object { Read-Lf (Join-Path $root ('css/' + $_)) }) -join $LF) + $LF + '</style>'
$jsInline  = '<script>' + $LF + (($jsFiles  | ForEach-Object { Read-Lf (Join-Path $root ('js/'  + $_)) }) -join $LF) + $LF + '</script>'

$html = $html.Replace($cssLinkBlock,$cssInline).Replace($jsTagBlock,$jsInline)

$outDir = Join-Path $root 'dist'
if(!(Test-Path $outDir)){ New-Item -ItemType Directory -Path $outDir | Out-Null }
$outPath = Join-Path $outDir $meta.DistName
# Guard: the assembled HTML must actually carry this version (requirement 8).
$titleTag = '<title>TAM Intelligence OS v' + $meta.Version + '</title>'
if(-not $html.Contains("const APP_VERSION = '" + $meta.Version + "';")){ throw ("Assembled HTML does not contain APP_VERSION " + $meta.Version + " -- is constants.js in sync?") }
if(-not $html.Contains($titleTag)){ throw ("Assembled HTML title does not match version " + $meta.Version + " -- update index.html.") }
[System.IO.File]::WriteAllText($outPath, $html, $utf8NoBom)
$bytes = ([System.Text.Encoding]::UTF8.GetByteCount($html))
Write-Host ("Built dist/{0} ({1} bytes) -- v{2} {3}" -f $meta.DistName,$bytes,$meta.Version,$meta.ReleaseName) -ForegroundColor Green
