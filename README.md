# Studio Client Hub

[![CI](https://github.com/kickstartcreatives/studio-client-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/kickstartcreatives/studio-client-hub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-3f6b5b.svg)](LICENSE)

A calm, self-hosted client CRM and portal for independent web designers. It gives the
studio an admin dashboard and Client 360, while each client gets a private project page
for progress, updates, agreements, and requests.

The starter is intentionally standalone: one Cloudflare Worker and one D1 database. It
does not depend on a separate proposal app, website monitor, project tracker, or private
font license.

Use **[this template](https://github.com/new?template_name=studio-client-hub&template_owner=kickstartcreatives)**
to make your own copy, or clone the repository to try it locally. Local evaluation needs
no Cloudflare account or email service. Hosting it for clients requires your own Cloudflare
and Resend setup.

![Studio dashboard with fictional demo data](docs/images/admin-dashboard.png)

<details>
<summary>See the client portal</summary>

![Client portal with fictional demo data](docs/images/client-portal.png)

</details>

## What is included

- Studio overview with active clients, projects, requests, and next actions
- Client 360 with relationship, engagement, rate, project, updates, and agreements
- Editable project stage, progress, target date, and current focus
- Private client portal with single-use email sign-in links
- Client request form and admin request status workflow
- “Open as client” preview from the admin
- Fictional demo client for local evaluation
- Responsive layouts for desktop, tablet, and mobile
- Generic Inter/system typography and a muted evergreen accent
- Tenant-scoped client queries, CSRF checks, secure cookies, login throttling, and escaped output

## Stack

- Cloudflare Workers
- Cloudflare D1 (SQLite)
- Optional Resend email delivery
- Plain JavaScript and server-rendered HTML

There is no framework, build-time CSS system, or client-side JavaScript dependency.

## Quick start

Use Node.js 24 LTS (recommended) or 22, plus npm. The minimum supported version is
Node.js 22, matching [Wrangler's requirements](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
If you use nvm, run `nvm use` in this directory.

```bash
git clone https://github.com/kickstartcreatives/studio-client-hub.git
cd studio-client-hub
npm ci
npm run setup
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open `http://localhost:8787/admin/login` and use the generated `ADMIN_PASSWORD` from
`.dev.vars`. The setup command creates unique local credentials and preserves any existing
file. Do not copy `.dev.vars.example` unchanged; its placeholders intentionally fail the
configuration check. Your local database and credentials are ignored by Git.

To preview the client experience, open `http://localhost:8787/portal`, enter
`maya@example.com`, and use the local preview link shown on the page. Preview links are
shown only on localhost when `DEV_SHOW_MAGIC_LINKS=1`; that setting should never be
configured as a deployed Worker variable.

## Customize the design

Edit the non-secret values in `wrangler.jsonc`:

- `STUDIO_NAME`
- `SUPPORT_EMAIL`
- `EMAIL_FROM`

The complete visual system lives near the top of `src/ui.js`. The main tokens are:

- `--accent: #3f6b5b` (muted evergreen)
- `--sidebar: #202a35` (dark slate)
- `--canvas: #f5f7f6` (soft neutral)
- `--font: Inter, ui-sans-serif, ...` (generic, redistributable font stack)

No private font files or source-studio brand assets are included.

## Deploy to Cloudflare

1. Sign in to Wrangler:

   ```bash
   npx wrangler login
   ```

2. Create a D1 database:

   ```bash
   npx wrangler d1 create studio-client-hub
   ```

3. Replace the placeholder `database_id` in `wrangler.jsonc` with the ID returned by
   Cloudflare.

4. Set production secrets. Use unique random values of at least 32 characters for the
   two signing secrets and a strong admin password of at least 12 characters.

   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put MAGIC_LINK_SECRET
   npx wrangler secret put RESEND_API_KEY
   ```

5. Configure a verified Resend sender in `EMAIL_FROM`. Without a valid Resend key and
   verified sender, deployed client magic links cannot be delivered.

6. Apply the schema and deploy:

   ```bash
   npx wrangler d1 migrations apply studio-client-hub --remote
   npx wrangler deploy
   ```

Do not run `seed.sql` against production unless you intentionally want the fictional
Sunrise Wellness demo record.

## Quality checks

```bash
npm run check
```

The integration suite boots the actual Worker runtime and D1, then tests admin auth,
single-use magic links, tenant isolation, CSRF protection, output escaping, CRUD flows,
request submission, and the design token. GitHub Actions runs the same checks on every
push and pull request, plus a weekly check. CI covers Node.js 22 and 24 and never deploys.

## Contributing and maintenance

See [CONTRIBUTING.md](CONTRIBUTING.md) for the code map and contribution workflow.
[Report a bug](https://github.com/kickstartcreatives/studio-client-hub/issues/new?template=bug_report.yml)
with reproduction steps and fictional data. Security problems go through the
[private reporting process](SECURITY.md#reporting-a-vulnerability).

Dependabot proposes weekly dependency and GitHub Actions updates. Review and test changes
before updating a deployed fork. This is a self-hosted starter, with no hosted service or
promised support response time.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `Setup incomplete` | Run `npm run setup` if `.dev.vars` is missing. Otherwise replace placeholders and check secret lengths; signing secrets must differ. |
| `no such table` | Run `npm run db:migrate:local`. Remote deployments need the separate `--remote` migration step. |
| No demo client | Run `npm run db:seed:local`; the seed can be run again without duplicating its records. |
| No local sign-in link | Use `localhost` or `127.0.0.1`, check `DEV_SHOW_MAGIC_LINKS=1`, and use `maya@example.com`. Repeated attempts pause links for 15 minutes. |
| No deployed email | Check the Resend key, verified `EMAIL_FROM` domain and provider delivery logs. The sign-in response intentionally does not reveal whether an address is registered. |

## Intentional scope

This first public version does not include file uploads, invoicing, automatic site-health
monitoring, multi-studio accounts, or imports from another CRM. Those features require
additional services and setup, so they are better added as optional modules than hidden
dependencies in the starter.

See [docs/AUDIT.md](docs/AUDIT.md) for the publication audit and [SECURITY.md](SECURITY.md)
for security guidance.

## License

MIT. You can use, adapt and redistribute the code, including commercially, while keeping
the license and copyright notice. See [LICENSE](LICENSE). Third-party dependencies retain
their own licenses. `private: true` in `package.json` only prevents accidental npm publishing;
it does not make this GitHub repository private.
