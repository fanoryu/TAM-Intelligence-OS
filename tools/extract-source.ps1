<#
  extract-source.ps1  —  TAM Intelligence OS v2.6.0, PHASE 0 scaffolder
  ---------------------------------------------------------------------
  ONE-TIME, deterministic physical split of the stable single-file app
  (tam-intelligence-os-v2.5.2.html) into ordered CSS + JS source files.

  Rules (Phase 0):
    * No business logic, function names, calculations, storage keys,
      schema version, migration flags, backup format or UI behavior change.
    * Files are pure contiguous slices of the original, in original order,
      so concatenation reproduces the original byte-for-byte (except the
      three intentional version edits below).
    * Only edits: APP_VERSION, APP_RELEASE_NAME, and an additive 2.6.0
      Release Notes entry. The <title> is set when index.html is assembled.

  Line endings: original is LF-only, no BOM. We preserve that exactly by
  slicing on LF and writing UTF-8 without BOM via .NET IO.
#>
$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot          # project root
$src    = Join-Path $root 'tam-intelligence-os-v2.5.2.html'
$cssDir = Join-Path $root 'css'
$jsDir  = Join-Path $root 'js'

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
function WriteLf([string]$path,[string]$text){
  [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

# Read raw and split into per-line parts WITHOUT the LF terminator.
# parts joined by LF == raw (lossless).
$raw   = [System.IO.File]::ReadAllText($src)
if($raw.Contains("`r`n")){ throw 'Unexpected CRLF in source; aborting to avoid byte drift.' }
$parts = $raw.Split("`n")
Write-Host ("Read {0} bytes, {1} line-parts." -f $raw.Length, $parts.Length)

# Absolute 1-based inclusive line ranges (verified against the file).
$jsFiles = @(
  @('00-constants.js',                 327,  462),
  @('01-utils.js',                     463,  525),
  @('02-storage-adapter.js',           526,  634),
  @('03-chart-engine.js',              635,  998),
  @('04-state.js',                     999, 1090),
  @('05-state-load-migrations.js',    1091, 1205),
  @('06-domain-services.js',          1206, 1336),
  @('07-import-parser.js',            1337, 1766),
  @('08-ui-shell-render.js',          1767, 1932),
  @('09-finance-pages.js',            1933, 2918),
  @('10-hr-persistence-portability.js',2919,3147),
  @('11-import-ui-analytics.js',      3148, 4727),
  @('12-people-pages.js',             4728, 6224),
  @('13-stabilization.js',            6225, 6627),
  @('14-overtime.js',                 6628, 7019),
  @('15-onboarding-reset.js',         7020, 7216),
  @('16-smart-import.js',             7217, 7349),
  @('17-employee-dedup.js',           7350, 7935),
  @('18-payroll-ops.js',              7936, 8518),
  @('19-app-bootstrap.js',            8519, 8528)
)
$cssFiles = @(
  @('tokens.css',      13,  68),
  @('base.css',        69,  88),
  @('shell.css',       89, 155),
  @('components.css', 156, 287),
  @('charts.css',     288, 303)
)

function SliceLines([int]$startLine,[int]$endLine){
  # inclusive, 1-based -> parts indices (start-1 .. end-1), joined by LF
  $a = $startLine - 1; $b = $endLine - 1
  return ($parts[$a..$b] -join "`n")
}

# ---- intentional version edits (applied to the JS body only) ----
$verOld = "const APP_VERSION = '2.5.2';"
$verNew = "const APP_VERSION = '2.6.0';"
$relOld = "const APP_RELEASE_NAME = 'Employee Deduplication & Master Data Consolidation';"
$relNew = "const APP_RELEASE_NAME = 'Modular Frontend Architecture';"
$noteAnchor = "    {v:'2.5.2 " + [char]0x2014 + " Employee Deduplication & Master Data Consolidation', items:["
$dash = [char]0x2014
$noteNew =
  "    {v:'2.6.0 $dash Modular Frontend Architecture', items:[" +
  "'Phase 0 of the Modular Frontend Architecture initiative: the single-file application was physically split into ordered CSS and JavaScript source files loaded as classic scripts in the original declaration order, preserving the exact shared global scope and runtime behavior'," +
  "'No business logic, calculation, storage key, schema version (still 6), migration flag, backup format or UI behavior was changed $dash this is a controlled extraction only, verified against the v2.5.2 golden master'," +
  "'A portable single-file build (dist/tam-intelligence-os-v2.6.0.html) is generated from the modular source and remains behaviorally identical to previous releases, opening directly in any browser with the same external XLSX and font behavior'," +
  "'Smart Import, Employee Deduplication, Payroll Planning, Overtime, Monthly Plan Generator, Execution Center, reports, diagnostics, themes, charts, backup/restore and sidebar behavior are all preserved unchanged']}," + "`n" + $noteAnchor

function AssertOnce([string]$hay,[string]$needle,[string]$label){
  $n = ($hay.Length - $hay.Replace($needle,'').Length) / [Math]::Max(1,$needle.Length)
  # exact occurrence count via split
  $count = $hay.Split(@($needle), [System.StringSplitOptions]::None).Length - 1
  if($count -ne 1){ throw "Expected exactly 1 occurrence of [$label], found $count." }
}

# ---- reconstruct the full JS body (lines 327..8528) + edits, for self-check ----
$jsBody = SliceLines 327 8528
AssertOnce $jsBody $verOld 'APP_VERSION'
AssertOnce $jsBody $relOld 'APP_RELEASE_NAME'
AssertOnce $jsBody $noteAnchor 'ReleaseNotes anchor'
$jsExpected = $jsBody.Replace($verOld,$verNew).Replace($relOld,$relNew).Replace($noteAnchor,$noteNew)

$cssBody = SliceLines 13 303

# ---- write JS files (apply edits within the owning slice) ----
if(!(Test-Path $jsDir)){ New-Item -ItemType Directory -Path $jsDir | Out-Null }
$jsConcatParts = @()
foreach($f in $jsFiles){
  $name=$f[0]; $s=[int]$f[1]; $e=[int]$f[2]
  $text = SliceLines $s $e
  $text = $text.Replace($verOld,$verNew).Replace($relOld,$relNew).Replace($noteAnchor,$noteNew)
  WriteLf (Join-Path $jsDir $name) $text
  $jsConcatParts += $text
  Write-Host ("  js/{0}  (lines {1}-{2})" -f $name,$s,$e)
}
# ---- write CSS files ----
if(!(Test-Path $cssDir)){ New-Item -ItemType Directory -Path $cssDir | Out-Null }
$cssConcatParts = @()
foreach($f in $cssFiles){
  $name=$f[0]; $s=[int]$f[1]; $e=[int]$f[2]
  $text = SliceLines $s $e
  WriteLf (Join-Path $cssDir $name) $text
  $cssConcatParts += $text
  Write-Host ("  css/{0}  (lines {1}-{2})" -f $name,$s,$e)
}

# ---- self-check: concatenation must reproduce expected bodies ----
$jsConcat  = $jsConcatParts  -join "`n"
$cssConcat = $cssConcatParts -join "`n"
if($jsConcat -ne $jsExpected){ throw 'SELF-CHECK FAILED: JS concatenation != edited original JS body.' }
if($cssConcat -ne $cssBody){   throw 'SELF-CHECK FAILED: CSS concatenation != original CSS body.' }
Write-Host 'SELF-CHECK OK: source files losslessly reproduce the (edited) original.' -ForegroundColor Green

# ---- assemble index.html from original outer template (reuse original bytes) ----
$headTop = ($parts[0..10]  -join "`n")   # lines 1-11 (doctype..xlsx)
$headTop = $headTop.Replace('<title>TAM Intelligence OS v2.5.2</title>','<title>TAM Intelligence OS v2.6.0</title>')
$preBody = ($parts[304..324] -join "`n") # lines 305-325 (</head><body> prepaint mounts seed)
$tail    = ($parts[8529..($parts.Length-1)] -join "`n") # </body></html> (+ any trailing)

$cssLinks = ($cssFiles | ForEach-Object { '<link rel="stylesheet" href="css/' + $_[0] + '">' }) -join "`n"
$jsTags   = ($jsFiles  | ForEach-Object { '<script src="js/' + $_[0] + '"></script>' }) -join "`n"

$index = $headTop + "`n" + $cssLinks + "`n" + $preBody + "`n" + $jsTags + "`n" + $tail
WriteLf (Join-Path $root 'index.html') $index
Write-Host 'Wrote index.html' -ForegroundColor Green
Write-Host 'DONE.' -ForegroundColor Green
