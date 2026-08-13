# Studio Client Hub

A calm, self-hosted client CRM and portal for independent web designers. It gives the
studio an admin dashboard and Client 360, while each client gets a private project page
for progress, updates, agreements, and requests.

The starter is intentionally standalone: one Cloudflare Worker and one D1 database. It
does not depend on a separate proposal app, website monitor, project tracker, or private
font license.

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

You need Node.js 20 or newer.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open `http://localhost:8787/admin/login` and use the `ADMIN_PASSWORD` from `.dev.vars`.

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
npm test
npm audit
```

The integration suite boots the actual Worker runtime and D1, then tests admin auth,
single-use magic links, tenant isolation, CSRF protection, output escaping, CRUD flows,
request submission, and the design token. GitHub Actions runs the same checks on every
push and pull request.

## Intentional scope

This first public version does not include file uploads, invoicing, automatic site-health
monitoring, multi-studio accounts, or imports from another CRM. Those features require
additional services and setup, so they are better added as optional modules than hidden
dependencies in the starter.

See [docs/AUDIT.md](docs/AUDIT.md) for the publication audit and [SECURITY.md](SECURITY.md)
for security guidance.

## License

MIT. See [LICENSE](LICENSE).
