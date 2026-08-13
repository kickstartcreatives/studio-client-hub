# Publication audit

Audit date: 2026-08-13

## Decision

The production Hub and client portal were not copied into this repository. They are
valuable production systems, but they are not safe or practical public-template code in
their current form.

Instead, this repository reimplements the reusable experience as a standalone app.

## Findings in the production code

The audit found five categories that had to be removed or redesigned:

1. **Deployment-specific configuration.** The production projects contain real domains,
   database bindings, account-level access settings, storage configuration, and operator
   contact values.
2. **Cross-application coupling.** Client 360 and the portal read across several sibling
   applications and databases. A fresh clone would render incomplete pages or fail until
   every related service was recreated.
3. **Private design assets.** The original interface uses font files and brand details
   that are not appropriate to redistribute in a generic public repository.
4. **Business-specific rules and copy.** Service tiers, status vocabulary, prices,
   proposal flows, care plans, and operational language are tailored to one studio.
5. **Setup documentation drift.** Some production repository documentation describes an
   earlier skeleton rather than the current connected system.

Publishing those repositories directly would create a brittle starter and increase the
risk of exposing configuration or redistributing assets without the right license.

## Changes made for the public starter

- Reduced the architecture to one Worker and one D1 database
- Replaced cross-database joins with local, explicit tables
- Removed real domains, IDs, names, paths, pricing rules, and account settings
- Removed private font files and used Inter/system fonts
- Replaced the bright indigo accent with muted evergreen (`#3f6b5b`)
- Rewrote the product copy in neutral studio language
- Added fictional seed data only
- Added fail-closed configuration checks
- Added signed admin sessions and HMAC-hashed client sessions/tokens
- Added single-use, 20-minute magic links
- Added SameSite/HttpOnly cookies, origin checks, and CSRF tokens
- Added login throttling and tenant-scoped portal queries
- Added a Content Security Policy and standard browser security headers
- Added automated runtime, D1, security, and tenant-isolation tests
- Pinned and audited development dependencies

## Verification completed

- Worker bundle dry-run: passed
- D1 migration and fictional seed: passed
- Automated integration/security tests: passed
- Admin dashboard desktop browser review: passed
- Client 360 desktop browser review: passed
- Client portal desktop browser review: passed
- Admin and portal mobile review at 390 px: passed with no horizontal overflow
- Browser console error check: clean
- Static asset delivery check: passed
- npm vulnerability audit: zero known vulnerabilities
- Bright-indigo token scan: clean

## Remaining publication checks

Before making a GitHub repository public, the maintainer should still:

- Review the fictional wording and sample data
- Replace the placeholder repository URLs once the repository exists
- Decide whether to include screenshots in the README
- Enable branch protection and secret scanning in GitHub
- Confirm the target Cloudflare and Resend setup with a clean external account

No test suite can guarantee that software will never have a future defect. This audit is
evidence that the documented clean-install path and core workflows work in the tested
environment; it is not a promise that every future platform or dependency change will be
bug-free.
