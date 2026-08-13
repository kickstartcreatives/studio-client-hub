# Security

## Supported version

Security fixes are made on the latest version in the default branch.

## Reporting a vulnerability

Do not open a public issue with client data, access tokens, or exploit details. Use the
repository owner's private security-reporting channel instead.

## Deployment checklist

- Use a unique admin password of at least 12 characters.
- Generate separate random values of at least 32 characters for `SESSION_SECRET` and
  `MAGIC_LINK_SECRET`.
- Store all four production credentials with `wrangler secret put`; never add them to
  `wrangler.jsonc`, `.dev.vars.example`, source code, screenshots, or issues.
- Keep `DEV_SHOW_MAGIC_LINKS` local. Never configure it as a deployed variable.
- Use a verified Resend sender and protect the Resend account with MFA.
- Enable Cloudflare and GitHub security alerts.
- Review dependency alerts and run `npm audit` before releases.
- Back up D1 before schema changes and test every migration locally first.

## Tenant-isolation rule

Every client-facing query must derive `client_id` from the authenticated session and must
filter by that value. Never accept a client ID from a portal form, URL, or browser state as
authorization.

New client-owned tables must carry `client_id`, use foreign keys, and include
tenant-isolation tests before merge.
