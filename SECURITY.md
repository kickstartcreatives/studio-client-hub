# Security

## Supported version

Security fixes target the latest commit on `main`. Update and test your fork before
deployment; this starter does not update an existing installation automatically.

## Reporting a vulnerability

Use [GitHub's private vulnerability report form](https://github.com/kickstartcreatives/studio-client-hub/security/advisories/new).
Include the affected commit, reproduction steps and expected impact. Use fictional data.
Do not post access tokens, real client records or exploit details in public issues.

## Deployment

- Generate a unique admin password of at least 12 characters and separate random values
  of at least 32 characters for `SESSION_SECRET` and `MAGIC_LINK_SECRET`.
- Store production credentials with `wrangler secret put`. The setup script generates
  local credentials only. Published placeholders and matching signing secrets are rejected.
- Keep `DEV_SHOW_MAGIC_LINKS` local. Preview links also require a localhost hostname.
- Use HTTPS and a verified Resend sender. Protect the Cloudflare and Resend accounts with MFA.
- Back up D1 before schema changes, test migrations locally and run `npm run check`.
- Use Cloudflare Access in front of `/admin` for an additional authentication layer if needed.

## Authentication boundaries

The shared admin password controls the entire studio. This starter has no staff roles or
per-person admin audit trail. Admin cookies expire after 12 hours; client sessions expire
after 30 days. Admin-created client previews expire after one hour and can submit requests
as that client. They are not read-only impersonation views.

Magic links expire after 20 minutes and redeem once, including simultaneous requests.
Client tokens and sessions are stored as HMAC hashes. Sign-out and admin previews require
POST plus a session CSRF token. Dynamic responses use `Cache-Control: no-store` and
`Referrer-Policy: strict-origin`.

Login limits use atomic D1 counters over 15-minute windows: five failed admin attempts per
IP (a successful login clears that counter); five portal attempts per email and twenty per
IP. These are basic abuse controls, not a replacement for an edge firewall or MFA. A shared
IP or repeated requests can temporarily block a legitimate login.

Changing `ADMIN_PASSWORD` does not invalidate an already issued signed admin cookie.
Rotate `SESSION_SECRET` to invalidate all admin sessions. Rotate `MAGIC_LINK_SECRET` to
invalidate all client sessions and outstanding sign-in links. Client sign-out deletes its
server-side session; admin sign-out clears the browser cookie.

## Tenant isolation

Every client-facing query derives `client_id` from the authenticated session. Never accept
a client ID from a portal form, URL or browser state as authorization. New client-owned
tables must carry `client_id`, use foreign keys and include isolation tests.

This is a website-project workspace. It has no patient-record workflow or compliance
certification. Keep sensitive information that belongs in another approved system there.

## Database housekeeping

Expired tokens and sessions remain in D1 until removed. During routine maintenance, the
following SQL can remove unusable auth records without deleting client or project data:

```sql
DELETE FROM magic_tokens WHERE expires_at <= datetime('now');
DELETE FROM sessions WHERE expires_at <= datetime('now');
DELETE FROM login_attempts WHERE updated_at <= datetime('now', '-1 day');
```

Protect database exports as private data. Neither a public code repository nor the MIT
license makes deployed client data public.
