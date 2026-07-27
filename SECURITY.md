# Security Policy

TAM Intelligence OS is proprietary internal software for **PT Total Asset Manajemen**. It stores
finance, payroll, employee, and contract data locally in the browser. Please treat security issues
with care.

## Reporting a vulnerability (private)

**Do not open a public issue for security problems.**

Report privately through GitHub Security Advisories:

- <https://github.com/fanoryu/TAM-Intelligence-OS/security/advisories/new>

If you cannot use Security Advisories, contact the repository owner (**@fanoryu**) privately through
GitHub. Do not disclose the issue publicly until it has been addressed.

### Never include sensitive data in a report

When reporting, **redact and exclude** all of the following. Describe the behavior instead of
pasting the data:

- Payroll data (amounts, rates, totals)
- Employee personal data (names, IDs, contact details, bank details)
- Contract documents or contract numbers tied to real people
- Bank account information
- Credentials, passwords, API keys, or tokens (including GitHub tokens)
- Complete Backup JSON exports
- Uploaded evidence, workbooks, or attachments containing real company data

If a proof-of-concept requires data, use clearly fabricated placeholder values.

## What counts as a vulnerability

- Unauthorized disclosure, modification, or loss of stored finance/payroll/employee data
- Cross-site scripting (XSS) or code injection via imported files, field values, or settings
- Bypass of the typed-confirmation / backup safeguards around destructive actions (Start Fresh,
  Reset, Restore)
- Corruption of persisted data (localStorage / Claude Artifact storage) or of backup exports
- Leakage of data to any third party, endpoint, or network destination
- Supply-chain risks in the build/verify tooling or GitHub workflows
- Secrets or real company data committed to the repository

Cosmetic issues, feature requests, and non-security bugs should use the normal issue templates.

## Supported versions

Only the latest released version receives security fixes. Older versions are not maintained.

| Version | Supported |
|---|---|
| Latest release (currently 2.6.x) | ✅ |
| Any older version | ❌ |

## Response expectations

This is a small, single-owner project; timelines are best-effort:

- Acknowledgement: within a few business days.
- Initial assessment / triage: shortly after acknowledgement.
- Fix and release: prioritized by severity and data-safety impact.

## Credential & data rotation guidance

If credentials or tokens are ever exposed (in a report, a commit, a log, or a screenshot):

1. **Rotate immediately** — revoke and reissue the affected GitHub token / credential.
2. Remove the exposed value from any issue, PR, or comment.
3. If it was committed, purge it from history (e.g. `git filter-repo`) and force-update the remote,
   then rotate again (assume the old value is compromised).
4. If real company/backup data was exposed, notify the data owner at PT Total Asset Manajemen and
   follow internal data-handling procedures.

## Responsible disclosure

We ask reporters to give a reasonable opportunity to remediate before any public discussion, and to
avoid accessing, modifying, or exfiltrating data beyond the minimum needed to demonstrate the issue.
Good-faith research reported privately is welcomed.
