# Public-template review

Review date: October 29, 2026. This is a record of the checks performed, not a guarantee
that the software has no defects.

## Scope

Studio Client Hub remains a public MIT-licensed template. It is a standalone Worker and
D1 app with fictional sample data, not an export of a private production CRM. The original
standalone snapshot was published on August 13, 2026.

## Fixes in this review

- Replaced the broken copy-the-example setup path with generated, unique local credentials.
  Setup preserves an existing `.dev.vars`; configuration rejects published placeholders
  and reused signing secrets.
- Updated Wrangler and its matching Miniflare runtime. The previous lockfile had four
  high-severity audit findings; the updated lockfile has zero reported vulnerabilities.
- Made login throttles atomic and added separate portal email and IP limits. Tests cover
  concurrent guesses, changed IPs and window expiry.
- Converted sign-out and admin client previews to POST with CSRF validation.
- Added bounded form parsing, controlled malformed-token handling and safe error responses.
- Prevented caching of dynamic responses and stripped URL paths from referrers. Chrome
  form testing caught an initial `no-referrer` regression; the verified policy is
  `strict-origin`, which preserves same-origin form validation.
- Fixed duplicate client cards when a client has multiple active projects.
- Connected editor labels to their inputs, named icon-only links and restored admin
  sign-out on small screens. Focus outlines now use a solid color.
- Added contributor instructions, issue/PR templates, Dependabot updates, pinned Actions,
  a weekly dependency check, troubleshooting and fictional-data README screenshots.

## Verification

- Fresh source export: `npm ci`, local setup, D1 migration and fictional seed succeeded.
- `npm run check`: 32 tests pass; Worker bundle dry-run succeeds; npm audit reports zero
  known vulnerabilities at review time.
- Integration tests use the actual Worker runtime and D1. Coverage includes admin CRUD,
  transactional duplicate-email rejection, client scoping, private updates, forged client
  IDs, CSRF/origin rejection, escaped output, session expiry, secure cookies, throttling,
  and single-use magic links under concurrent redemption.
- Setup tests check unique secrets, file permissions and preservation of an existing file.
- Email transport tests simulate provider success, errors and timeout. No real email is sent.
- Chrome checks on a clean local database: admin login, client preview, magic-link login,
  request submission, profile editing and sign-out. Admin and portal checked at 390 px,
  with a 768 px admin check and 1440 px desktop captures. No horizontal overflow on checked
  screens; editor controls have accessible labels.
- Gitleaks 8.30.1: repository history and proposed patch scanned with redacted output.
  No detected secrets. Manual review found example contacts/domains, generic CSS and no
  private font files, real deployment IDs or local filesystem paths in published source.
- Private vulnerability reporting and Dependabot security updates are enabled. GitHub
  secret scanning and push protection remain enabled.

CI checks Node.js 22 and 24 on pushes and pull requests. The
[workflow history](https://github.com/kickstartcreatives/studio-client-hub/actions/workflows/ci.yml)
records results for each commit.

## Limits of this verification

No production Worker, remote D1 database or real Resend sender was provisioned during this
review. A maintainer still needs to verify their own deployed domain, sender and backups
before inviting real clients. Browser checks used Chrome; other browser engines were not
exercised. This review is not an independent penetration test or a full accessibility audit.

The app deliberately uses one shared studio administrator and one client per portal
contact. It does not implement staff roles, billing, attachments or automatic imports.
Session revocation and database-housekeeping procedures are in [SECURITY.md](../SECURITY.md).
