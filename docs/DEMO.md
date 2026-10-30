# Public demo

The demo lets visitors browse the dashboard, three fictional client records, and each
client's portal without signing in. Forms are visible but disabled. It does not save
changes, accept requests, or send email.

## Run it locally

```bash
npm ci
npm run dev:demo
```

You don't need to run the setup command, create a database, or supply credentials.
Open the local URL printed by Wrangler. To try saving records and signing in, use the
full app's [quick start](../README.md#quick-start) instead.

## How it's built

`scripts/build-demo.mjs` creates a temporary local D1 database, applies the migrations,
and loads only the checked-in fictional records from `seed.sql` and `demo/seed.sql`.
The build doesn't read `.dev.vars`, connect to a remote database, or permit outbound
requests from its renderer. The temporary database is discarded when the build finishes.

`demo/render.js` calls the app's existing page renderers, adds the demo navigation, and
turns forms into disabled fieldsets. It removes sign-out controls and replaces "Open as
client" with links to the matching static portal. No authentication bypass is added to
the app. The renderer is a build tool and is not deployed.

The output in `.demo-dist/` is plain HTML, a favicon, and hosting headers. The demo's
Cloudflare configuration has no application Worker, database binding, or email key.
Its content security policy blocks scripts and form submissions. Search indexing is
disabled so fictional businesses do not appear as real client websites.

## Publish your own demo

Choose your own Worker name in `wrangler.demo.jsonc`, then run:

```bash
npx wrangler login
npm run check
npm run deploy:demo
```

This uploads static assets using the separate demo configuration. It does not deploy
the full app from `wrangler.jsonc`. The demo is public at the URL returned by Wrangler.
Use fictional data only. Never substitute an export of a real client database.

GitHub CI builds and tests the demo on Node 22 and 24. Publishing is manual; a GitHub
push alone does not update a hosted demo. Rebuild and deploy after changing the screens
or sample records. Static asset hosting is described in the
[Cloudflare documentation](https://developers.cloudflare.com/workers/static-assets/).
