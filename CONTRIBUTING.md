# Contributing

Bug reports, documentation fixes and focused pull requests are welcome. Start with an
issue for a larger feature so its scope can be discussed before implementation.

## Run locally

Follow the [README](README.md#quick-start). Use fictional records and local D1 while
developing. No Cloudflare account, email key or deployed database is needed for tests.

```bash
npm ci
npm run check
```

Node.js 22 and 24 are tested in CI. Keep `package-lock.json` in your changes when updating
dependencies. Miniflare is pinned to the version used by Wrangler; update them together
and run the Worker integration tests. The current Wrangler release uses Miniflare 5 beta.

## Where things live

| Path | Responsibility |
| --- | --- |
| `src/index.js` | Routes, error handling and response privacy headers |
| `src/admin.js` | Studio dashboard, client records and admin forms |
| `src/portal.js` | Client sign-in, project view and requests |
| `src/auth.js` | Sessions, magic links, configuration and login limits |
| `src/security.js` | Signing, cookies and origin checks |
| `src/http.js` | Bounded form parsing |
| `src/email.js` | Resend transport and sign-in email |
| `src/ui.js` | Server-rendered HTML and shared CSS |
| `migrations/` | Ordered D1 schema migrations |
| `test/` | Node tests and real Worker/D1 integration tests |
| `demo/` | Fictional fixtures and the build-only demo renderer |
| `scripts/build-demo.mjs` | Static demo generation using a temporary local database |

`npm run dev:demo` previews the read-only demo. See [docs/DEMO.md](docs/DEMO.md) for how
it stays separate from the full app. `npm run check` also tests the generated demo's
links, client views, response headers and rejection of write requests.

The admin belongs to one studio. Client portal sessions scope access to one client. A
portal form field or URL parameter must never decide which client owns a query or write.
Keep that rule covered when adding client-facing tables or routes.

## Before opening a pull request

- Describe the problem and resulting behavior. Include reproduction steps for a bug.
- Run `npm run check`. Add a regression test for behavior or security fixes.
- Check affected screens at desktop and mobile widths. Include fictional-data screenshots
  for visual changes.
- Add a new migration for schema changes; do not rewrite an already released migration.
- Keep credentials, local databases, real client records and private font files out of Git.

CI runs tests and the dependency audit. It does not deploy or send real email. Dependency
updates need review; passing CI is not automatic permission to merge a feature or deploy.

Report security problems using [SECURITY.md](SECURITY.md), not a public issue. Contributions
are provided under the project's existing [MIT license](LICENSE).
