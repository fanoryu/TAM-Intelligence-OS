<#
  verify-build.ps1 — TAM Intelligence OS v2.6.1 (Search Focus & Incremental Rendering Fix)
  ---------------------------------------------------------------------------------------
  v2.6.1 intentionally changes the render PATH for search/filter controls, so the dist JS
  is no longer byte-identical to v2.5.2 (that was the v2.6.0 golden master). This verifier:
    * CSS is still untouched -> dist CSS must equal v2.5.2 CSS byte-for-byte.
    * Build fidelity: dist inlined payloads == concatenated modular source.
    * All data-safety invariants unchanged (keys, flags, schema 6, seed, mounts, init).
    * FOCUS FIX present: every search box routes to its apply*Filter (incremental) and no
      longer calls the full page renderer on 'input'.
  Exits non-zero on any failure.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
function Read-Lf([string]$p){ [System.IO.File]::ReadAllText($p) }

$orig = Read-Lf (Join-Path $root 'tam-intelligence-os-v2.5.2.html')
$dist = Read-Lf (Join-Path $root 'dist/tam-intelligence-os-v2.6.3.html')
$LF = "`n"
$fails = New-Object System.Collections.Generic.List[string]
$passes = 0
function Check([bool]$cond,[string]$msg){
  if($cond){ $script:passes++; Write-Host ("  [PASS] " + $msg) -ForegroundColor DarkGreen }
  else { $script:fails.Add($msg); Write-Host ("  [FAIL] " + $msg) -ForegroundColor Red }
}
function Extract-Style([string]$html){
  $a=$html.IndexOf('<style>'); $b=$html.IndexOf('</style>'); if($a -lt 0 -or $b -lt 0){ return $null }
  return $html.Substring($a+7, $b-($a+7)).Trim("`n")
}
function Extract-MainScript([string]$html){
  $i=$html.IndexOf('const APP_VERSION'); if($i -lt 0){ return $null }
  $o=$html.LastIndexOf('<script>', $i); $c=$html.IndexOf('</script>', $i)
  return $html.Substring($o+8, $c-($o+8)).Trim("`n")
}
$distCss = Extract-Style $dist
$origCss = Extract-Style $orig
$distJs  = Extract-MainScript $dist

# ---- CSS unchanged (v2.6.1 touched no styles) ----
Write-Host "== CSS UNCHANGED vs v2.5.2 ==" -ForegroundColor Cyan
Check ($distCss -eq $origCss) 'dist CSS == v2.5.2 CSS byte-for-byte (styles untouched since v2.5.2)'

# ---- build fidelity ----
$cssFiles = @('tokens.css','base.css','shell.css','components.css','charts.css')
$jsFiles  = (Select-String -Path (Join-Path $PSScriptRoot 'module-order.js') -Pattern "'([^']+\.js)'" -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value })
$srcCss = ($cssFiles | ForEach-Object { Read-Lf (Join-Path $root ('css/'+$_)) }) -join $LF
$srcJs  = ($jsFiles  | ForEach-Object { Read-Lf (Join-Path $root ('js/' +$_)) }) -join $LF
Write-Host "== BUILD FIDELITY (source -> dist) ==" -ForegroundColor Cyan
Check ($srcCss.Trim("`n") -eq $distCss) 'concat(css/*.css) == dist CSS payload'
Check ($srcJs.Trim("`n")  -eq $distJs)  'concat(js/*.js) == dist JS payload'

# ---- version identity ----
Write-Host "== VERSION IDENTITY ==" -ForegroundColor Cyan
Check ($dist.Contains("const APP_VERSION = '2.6.3';")) "APP_VERSION == 2.6.3"
Check ($dist.Contains("const APP_RELEASE_NAME = 'Payroll Intelligence Workspace';")) "APP_RELEASE_NAME updated"
Check ($dist.Contains('<title>TAM Intelligence OS v2.6.3</title>')) "<title> updated to v2.6.3"
Check ($dist.Contains("{v:'2.6.3 ")) "Release Notes has a 2.6.3 entry"

# ---- SCHEMA + storage keys + migration flags unchanged ----
$mDist = [regex]::Match($dist,'const SCHEMA_VERSION = (\d+);')
Write-Host "== DATA-SAFETY INVARIANTS ==" -ForegroundColor Cyan
Check ($mDist.Groups[1].Value -eq '6') "SCHEMA_VERSION == 6 (UNCHANGED)"
$keys = @('tam_txns_v1','tam_settings_v1','tam_backups_v1','tam_employees_v1','tam_contracts_v1','tam_payroll_plans_v1','tam_recurring_expenses_v1','tam_monthly_plans_v1','tam_overtime_records_v1','tam_import_batches_v1','tam_payroll_adjustments_v1','tam_employee_merges_v1','tam_audit_log_v1')
$flags = @('tam_migrated_exec_v21','tam_migrated_hr_v22','tam_migrated_norm_v221','tam_migrated_overtime_v23','tam_migrated_payrollops_v25','tam_migrated_dedup_v252','tam_v23_ack')
foreach($k in $keys){ Check (($dist.Contains($k)) -and ($orig.Contains($k))) ("storage key present & unchanged: " + $k) }
foreach($f in $flags){ Check (($dist.Contains($f)) -and ($orig.Contains($f))) ("migration flag present & unchanged: " + $f) }
Check ($dist.Contains('<script id="seed-data" type="application/json">[]</script>')) "seed-data JSON present and EMPTY"
Check ($dist.Contains('<div id="app"></div>') -and $dist.Contains('<div id="toast-root"></div>') -and $dist.Contains('<div id="modal-root"></div>')) "all three mount points present"
$initCount = ([regex]::Matches($dist,'\(async function init\(\)')).Count
Check ($initCount -eq 1) ("exactly one bootstrap init() (found $initCount)")
Check (-not $dist.Contains('type="module"')) "no type=module (still classic scripts)"

# ---- FOCUS FIX present ----
Write-Host "== SEARCH FOCUS / INCREMENTAL RENDER FIX ==" -ForegroundColor Cyan
foreach($fn in @('function applyEmployeeFilter','function applyContractFilter','function applyTxnFilter','function applyOvertimeFilter','function applyPayrollFilter')){
  Check ($dist.Contains($fn)) ("incremental refresh defined: " + $fn.Replace('function ',''))
}
# New search handlers route to apply*Filter
$newHandlers = @(
  "getElementById('eSearch').addEventListener('input', e=>{ State.empFilter.search=e.target.value; applyEmployeeFilter(main); })",
  "getElementById('cSearch').addEventListener('input', e=>{ State.contractFilter.search=e.target.value; applyContractFilter(main); })",
  "getElementById('fSearch').addEventListener('input', e=>{ State.txFilter.search=e.target.value; applyTxnFilter(main); })",
  "getElementById('otSearch').addEventListener('input', e=>{ State.overtimeFilter.search=e.target.value; applyOvertimeFilter(main); })",
  "getElementById('pfSearch').addEventListener('input', e=>{ f.search=e.target.value; applyPayrollFilter(area, monthKey, main); })"
)
foreach($h in $newHandlers){ Check ($dist.Contains($h)) ("search handler is incremental: " + $h.Substring(14, [Math]::Min(24,$h.Length-14)) + "...") }
# Old full-renderer-on-keystroke handlers are gone
$oldHandlers = @(
  "State.empFilter.search=e.target.value; renderEmployees(main)",
  "State.contractFilter.search=e.target.value; renderContracts(main)",
  "State.txFilter.search=e.target.value; renderTransactions(main)",
  "State.overtimeFilter.search=e.target.value; renderOvertime(main)"
)
foreach($h in $oldHandlers){ Check (-not $dist.Contains($h)) ("old full-render search handler removed: " + $h.Substring(0,24) + "...") }
# The tbody containers the refresh targets must exist
foreach($id in @('id="empRows"','id="ctRows"','id="otRows"','id="txnRows"','id="pwRows"','id="txnCount"')){
  Check ($dist.Contains($id)) ("incremental container present: " + $id)
}

# ---- report ----
Write-Host ''
if($fails.Count -eq 0){
  Write-Host ("VERIFICATION PASSED -- {0} checks OK." -f $passes) -ForegroundColor Green
  exit 0
} else {
  Write-Host ("VERIFICATION FAILED -- {0} passed, {1} failed:" -f $passes,$fails.Count) -ForegroundColor Red
  foreach($f in $fails){ Write-Host ("   - " + $f) -ForegroundColor Red }
  exit 1
}
