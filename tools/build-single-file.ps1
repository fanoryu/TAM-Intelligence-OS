<#
  build-single-file.ps1 — TAM Intelligence OS v2.6.0 (Phase 0)
  Windows/PowerShell equivalent of tools/build-single-file.js (no Node required).
  Inlines css/ and js/ into dist/tam-intelligence-os-v2.6.0.html. No minification.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$LF   = "`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function Read-Lf([string]$p){ [System.IO.File]::ReadAllText($p) }

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
$outPath = Join-Path $outDir 'tam-intelligence-os-v2.6.3.html'
[System.IO.File]::WriteAllText($outPath, $html, $utf8NoBom)
$bytes = ([System.Text.Encoding]::UTF8.GetByteCount($html))
Write-Host ("Built dist/tam-intelligence-os-v2.6.3.html ({0} bytes)" -f $bytes) -ForegroundColor Green
