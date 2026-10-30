import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { demoPages } from "../demo/pages.js";

let mf;
const origin = "https://demo.invalid";

before(async () => {
  const config = JSON.parse(await readFile("wrangler.demo.jsonc", "utf8"));
  assert.equal(config.main, undefined, "the hosted demo must not have an application Worker");
  assert.equal(config.d1_databases, undefined, "the hosted demo must not bind a database");
  mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { throw new Error("The demo must serve assets only"); } }',
    compatibilityDate: config.compatibility_date,
    assets: {
      directory: config.assets.directory,
      routerConfig: { has_user_worker: false },
      assetConfig: { html_handling: config.assets.html_handling, not_found_handling: config.assets.not_found_handling }
    }
  }));
});

after(async () => { await mf?.dispose(); });

test("demo pages and every internal navigation link work without cookies", async () => {
  const links = new Set();
  for (const path of demoPages.filter((path) => path !== "/404")) {
    const response = await mf.dispatchFetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("set-cookie"), null);
    const markup = await response.text();
    assert.match(markup, /Fictional clients/);
    assert.doesNotMatch(markup, /<form\b|name="csrf"|<script\b|href="mailto:/i, path);
    assert.doesNotMatch(markup, /Sign out|Send sign-in link/);
    for (const [, href] of markup.matchAll(/href="(\/[^"#]*)"/g)) links.add(href);
    for (const [, attributes] of markup.matchAll(/<fieldset\b([^>]*)>/g)) assert.match(attributes, /\bdisabled(?:=|\s|$)/);
  }
  for (const path of links) {
    const response = await mf.dispatchFetch(`${origin}${path}`, { redirect: "manual" });
    assert.equal(response.status, 200, `Broken demo link: ${path}`);
  }
});

test("demo rejects writes and has no login or API endpoints", async () => {
  for (const path of ["/", "/admin/clients", "/admin/clients/client-sunrise/profile", "/admin/login", "/portal/login", "/portal/requests"]) {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const response = await mf.dispatchFetch(`${origin}${path}`, { method, body: "demo input", redirect: "manual" });
      assert.equal(response.status, 405, `${method} ${path}`);
      assert.equal(response.headers.get("set-cookie"), null);
    }
  }
  for (const path of ["/admin/login", "/portal/auth/not-a-token", "/missing", "/.dev.vars", "/demo/seed.sql"]) {
    const response = await mf.dispatchFetch(`${origin}${path}`);
    assert.equal(response.status, 404, path);
    assert.match(await response.text(), /That page is not in the demo/);
  }
});

test("demo client views show only their own public updates and preserve the view switch", async () => {
  const sunrise = await (await mf.dispatchFetch(`${origin}/portal/client-sunrise`)).text();
  assert.match(sunrise, /Hi Maya/);
  assert.doesNotMatch(sunrise, /seasonal menu|Juniper Trail/);
  assert.match(sunrise, /href="\/admin\/clients\/client-sunrise"/);
  const harbor = await (await mf.dispatchFetch(`${origin}/portal/client-harbor`)).text();
  assert.match(harbor, /Hi Sam/);
  assert.match(harbor, /seasonal menu/);
  assert.doesNotMatch(harbor, /Sunrise Wellness|Replace the team photo/);
  assert.match(harbor, /href="\/admin\/clients\/client-harbor"/);
  const lead = await (await mf.dispatchFetch(`${origin}/portal/client-juniper`)).text();
  assert.match(lead, /Hi Alex/);
  assert.doesNotMatch(lead, /Prepare questions about product photography/);
  const admin = await (await mf.dispatchFetch(`${origin}/admin/clients/client-juniper`)).text();
  assert.match(admin, /Prepare questions about product photography/);
  assert.match(admin, /href="\/portal\/client-juniper"/);
});

test("demo blocks scripts, form submissions, indexing and framing in response headers", async () => {
  for (const path of ["/", "/portal", "/missing"]) {
    const response = await mf.dispatchFetch(`${origin}${path}`);
    assert.match(response.headers.get("content-security-policy"), /default-src 'none'.*form-action 'none'.*frame-ancestors 'none'/);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
  assert.equal(await (await mf.dispatchFetch(`${origin}/robots.txt`)).text(), "User-agent: *\nDisallow: /\n");
});
