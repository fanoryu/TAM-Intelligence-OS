<!--
  TAM Intelligence OS — release notes template.
  Copy this into RELEASE_NOTES.md for each release and fill in every section.
  Do not invent changes — describe only what actually shipped and was verified.
-->

# TAM Intelligence OS vX.Y.Z — <Release Name>

**Release Name:** <Release Name>

## Added
- <new capability, or "None">

## Changed
- <behavior/structure change, or "None">

## Fixed
- <bug fix, or "None">

## Security
- <security-relevant change, or "None">

## Data Safety
- SCHEMA_VERSION: <unchanged (6) | migrated X → Y with migration + flag>
- Storage keys / migration flags: <unchanged | describe>
- Backup format: <unchanged | describe>
- <any data-safety notes>

## QA
<!-- Distinguish: browser-tested / automated-test verified / source-inspected / unable to verify -->
- Build: <result>
- Verify: <N/N checks>
- Browser (modular): <what was exercised>
- Browser (dist): <what was exercised>
- Console errors: <count>

## Regression
- <features re-tested and their results>

## Known Limitations
- <honest limitations / out-of-scope items>

## Git Information
- Commit: <hash>
- Tag: vX.Y.Z
- Branch: main

## Release Asset
- dist/tam-intelligence-os-vX.Y.Z.html
