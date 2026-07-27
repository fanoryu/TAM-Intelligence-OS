# Release Process — TAM Intelligence OS

The version lives once, in `const APP_VERSION` (and `APP_RELEASE_NAME`) in
`js/core/constants.js`. Everything else — dist filename, verifier checks, CI, and the release
workflow — derives from it. To cut a release you change those two constants, add release notes, and
follow the steps below.

## 1. Implementation
- Edit the **modular source** only (never `dist/`). Preserve data-safety invariants
  (`SCHEMA_VERSION`, storage keys, migration flags, backup format) unless intentionally migrating.
- Bump `APP_VERSION` and `APP_RELEASE_NAME` in `js/core/constants.js`.
- Update `index.html` `<title>`, the in-app Release Notes entry, `README.md`, `ARCHITECTURE.md`,
  `CHANGELOG.md`, and `RELEASE_NOTES.md`.

## 2. Build
```bash
node tools/build-single-file.js
```
Produces `dist/tam-intelligence-os-v<APP_VERSION>.html`. Remove the superseded dist from the prior
version (`git rm`).

## 3. Verify
```bash
node tools/verify-build.js
```
Must pass all checks. (PowerShell fallback available for machines without Node.)

## 4. QA
Run `docs/QA-CHECKLIST.md` against the modular source **and** the portable dist. Zero console errors.

## 5. Regression
Re-test previously-working features (payroll, overtime, execution, import, dedup, backup/restore,
activity log, settings). Any regression is a **release blocker**.

## 6. Release candidate
Prepare an RC summary that distinguishes **browser-tested / automated-test verified /
source-inspected / unable to verify**, reports any secret-scan findings (paths + categories only,
never values), and lists known limitations and branch-protection recommendations.

## 7. Approval
Do **not** commit, tag, push, or publish before the owner's explicit approval.

## 8. Commit
```
Release vX.Y.Z - <Release Name>
```
Commit the source **and** the rebuilt `dist/` together. Confirm the working tree is clean.

## 9. Tag
```bash
git tag -a vX.Y.Z -m "TAM Intelligence OS vX.Y.Z"
git tag -l vX.Y.Z          # verify it exists
```

## 10. Push
```bash
git push origin main
git push origin vX.Y.Z
```

## 11. GitHub Release
Pushing the `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which rebuilds, verifies,
confirms the tag equals `v<APP_VERSION>`, and publishes the release with the portable HTML asset.
If publishing manually instead:
```bash
gh release create vX.Y.Z dist/tam-intelligence-os-vX.Y.Z.html \
  --title "TAM Intelligence OS vX.Y.Z" --notes-file RELEASE_NOTES.md --verify-tag
```

## 12. Asset verification
```bash
gh release view vX.Y.Z
```
Confirm the release exists and the asset `tam-intelligence-os-vX.Y.Z.html` is attached. Record the
commit hash, tag, release URL, asset name, CI status, branch, and working-tree status.

## Rollback
- **Bad release, tag not yet relied upon:** delete the GitHub Release and tag
  (`gh release delete vX.Y.Z`, `git push origin :refs/tags/vX.Y.Z`), fix, re-release.
- **Bad code already on main:** revert the release commit (`git revert <hash>`), rebuild, verify,
  and cut a new patch version. Do not rewrite public history unless removing sensitive data.
- **Restoring user data:** users restore from their most recent Complete Backup (Settings → Data
  Portability). A pre-restore safety backup is always created automatically.
