import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const origin = "http://localhost";
let mf;
let db;

function formRequest(path, values, cookie = "") {
  const headers = { "content-type": "application/x-www-form-urlencoded", origin };
  if (cookie) headers.cookie = cookie;
  return [`${origin}${path}`, { method: "POST", headers, body: new URLSearchParams(values), redirect: "manual" }];
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "response should set a cookie");
  return setCookie.split(";", 1)[0];
}

function hidden(markup, name) {
  const match = markup.match(new RegExp(`name="${name}" value="([^"]+)"`));
  assert.ok(match, `page should contain hidden field ${name}`);
  return match[1];
}

async function executeSql(database, sql) {
  const statements = sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await database.prepare(statement).run();
}

before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    scriptPath: ".test-build/index.js",
    compatibilityDate: "2026-07-01",
    d1Databases: { DB: "test-db" },
    bindings: {
      ADMIN_PASSWORD: "correct horse battery staple",
      SESSION_SECRET: "test-session-secret-with-at-least-thirty-two-characters",
      MAGIC_LINK_SECRET: "test-magic-secret-with-at-least-thirty-two-characters",
      STUDIO_NAME: "Northstar Studio",
      SUPPORT_EMAIL: "hello@example.com",
      EMAIL_FROM: "Northstar Studio <portal@example.com>",
      DEV_SHOW_MAGIC_LINKS: "1"
    }
  }));
  db = await mf.getD1Database("DB");
  await executeSql(db, await readFile("migrations/0001_initial.sql", "utf8"));
  await executeSql(db, await readFile("seed.sql", "utf8"));
});

after(async () => {
  await mf?.dispose();
});

test("missing secrets fail closed with a useful setup response", async () => {
  const bare = new Miniflare(convertV4MiniflareOptions({ modules: true, scriptPath: ".test-build/index.js", compatibilityDate: "2026-07-01", d1Databases: { DB: "bare-db" } }));
  const response = await bare.dispatchFetch(`${origin}/`);
  assert.equal(response.status, 500);
  assert.match(await response.text(), /ADMIN_PASSWORD.*SESSION_SECRET.*MAGIC_LINK_SECRET/);
  await bare.dispose();
});

test("admin routes redirect to login and reject a wrong password", async () => {
  const locked = await mf.dispatchFetch(`${origin}/admin`, { redirect: "manual" });
  assert.equal(locked.status, 303);
  assert.equal(locked.headers.get("location"), "/admin/login");

  const wrong = await mf.dispatchFetch(...formRequest("/admin/login", { password: "wrong" }));
  assert.equal(wrong.status, 200);
  assert.match(await wrong.text(), /did not match/);
});

let adminCookie;
let adminCsrf;

test("admin can sign in and see the seeded client dashboard", async () => {
  const login = await mf.dispatchFetch(...formRequest("/admin/login", { password: "correct horse battery staple" }));
  assert.equal(login.status, 303);
  assert.equal(login.headers.get("location"), "/admin");
  adminCookie = cookieFrom(login);

  const dashboard = await mf.dispatchFetch(`${origin}/admin`, { headers: { cookie: adminCookie } });
  assert.equal(dashboard.status, 200);
  const markup = await dashboard.text();
  assert.match(markup, /Everything in one calm place/);
  assert.match(markup, /Sunrise Wellness/);

  const detail = await mf.dispatchFetch(`${origin}/admin/clients/client-sunrise`, { headers: { cookie: adminCookie } });
  const detailMarkup = await detail.text();
  assert.match(detailMarkup, /Client 360/);
  assert.match(detailMarkup, /Open as client/);
  adminCsrf = hidden(detailMarkup, "csrf");
});

test("admin mutations require CSRF and same-origin requests", async () => {
  const response = await mf.dispatchFetch(...formRequest("/admin/clients/client-sunrise/updates", { body: "Should not save", csrf: "wrong" }, adminCookie));
  assert.equal(response.status, 400);
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM updates WHERE body = ?`).bind("Should not save").first();
  assert.equal(row.count, 0);
});

test("admin can post a client-visible update and untrusted HTML is escaped", async () => {
  const body = `<script>alert("no")</script> Direction approved.`;
  const response = await mf.dispatchFetch(...formRequest(`/admin/clients/client-sunrise/updates`, { csrf: adminCsrf, body, client_visible: "1" }, adminCookie));
  assert.equal(response.status, 303);
  const detail = await mf.dispatchFetch(`${origin}/admin/clients/client-sunrise`, { headers: { cookie: adminCookie } });
  const markup = await detail.text();
  assert.doesNotMatch(markup, /<script>alert/);
  assert.match(markup, /&lt;script&gt;alert/);
});

test("admin can update project progress and relationship details", async () => {
  const projectResponse = await mf.dispatchFetch(...formRequest("/admin/projects/project-sunrise-site", {
    csrf: adminCsrf,
    stage: "Development",
    status: "active",
    progress: "72",
    current_focus: "Building the responsive templates.",
    target_launch: "2026-09-18"
  }, adminCookie));
  assert.equal(projectResponse.status, 303);
  const project = await db.prepare(`SELECT stage, progress, current_focus FROM projects WHERE id = ?`).bind("project-sunrise-site").first();
  assert.deepEqual({ stage: project.stage, progress: project.progress, current_focus: project.current_focus }, { stage: "Development", progress: 72, current_focus: "Building the responsive templates." });

  const profileResponse = await mf.dispatchFetch(...formRequest("/admin/clients/client-sunrise/profile", {
    csrf: adminCsrf,
    name: "Maya Chen",
    business: "Sunrise Wellness Co.",
    engagement: "Website redesign",
    contracted_rate: "$4,800 project",
    next_action: "Review mobile templates",
    live_url: "example.com",
    care_plan: "Site care · $125/mo",
    status: "active"
  }, adminCookie));
  assert.equal(profileResponse.status, 303);
  const client = await db.prepare(`SELECT next_action, live_url FROM clients WHERE id = ?`).bind("client-sunrise").first();
  assert.equal(client.next_action, "Review mobile templates");
  assert.equal(client.live_url, "https://example.com/");
});

test("admin can create a complete client record and portal contact", async () => {
  const page = await mf.dispatchFetch(`${origin}/admin/clients/new`, { headers: { cookie: adminCookie } });
  const csrf = hidden(await page.text(), "csrf");
  const response = await mf.dispatchFetch(...formRequest("/admin/clients", {
    csrf,
    name: "Jordan Lee",
    business: "Harbor Web Co.",
    email: "jordan@example.com",
    engagement: "Website build",
    rate: "$3,200 project",
    status: "active",
    next_action: "Send discovery notes"
  }, adminCookie));
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /^\/admin\/clients\/[a-f0-9-]+\?created=1$/);
  const client = await db.prepare(`SELECT id, next_action FROM clients WHERE business = ?`).bind("Harbor Web Co.").first();
  const user = await db.prepare(`SELECT client_id FROM users WHERE email = ?`).bind("jordan@example.com").first();
  assert.equal(user.client_id, client.id);
  assert.equal(client.next_action, "Send discovery notes");
});

let clientCookie;
let clientCsrf;
let magicLink;

test("local magic-link login works, is single-use, and opens the correct tenant", async () => {
  await db.prepare(`INSERT INTO updates (id, client_id, body, client_visible) VALUES (?, ?, ?, 1)`).bind("private-other", (await db.prepare(`SELECT id FROM clients WHERE business = ?`).bind("Harbor Web Co.").first()).id, "OTHER TENANT SECRET").run();
  const login = await mf.dispatchFetch(...formRequest("/portal/login", { email: "maya@example.com" }));
  const loginMarkup = await login.text();
  const match = loginMarkup.match(/href="(http:\/\/localhost\/portal\/auth\/[^"]+)"/);
  assert.ok(match, "local login should display the preview magic link");
  magicLink = match[1].replace(/&amp;/g, "&");

  const redeem = await mf.dispatchFetch(magicLink, { redirect: "manual" });
  assert.equal(redeem.status, 303);
  clientCookie = cookieFrom(redeem);

  const portal = await mf.dispatchFetch(`${origin}/portal`, { headers: { cookie: clientCookie } });
  const markup = await portal.text();
  assert.match(markup, /Hi Maya/);
  assert.match(markup, /Building the responsive templates/);
  assert.doesNotMatch(markup, /OTHER TENANT SECRET/);
  clientCsrf = hidden(markup, "csrf");

  const replay = await mf.dispatchFetch(magicLink);
  assert.equal(replay.status, 200);
  assert.match(await replay.text(), /expired or has already been used/);
});

test("a client request is written only to the logged-in tenant", async () => {
  const response = await mf.dispatchFetch(...formRequest("/portal/requests", {
    csrf: clientCsrf,
    type: "design",
    urgency: "soon",
    details: "Please soften the button color on the contact page."
  }, clientCookie));
  assert.equal(response.status, 303);
  const saved = await db.prepare(`SELECT client_id, user_id, status FROM requests WHERE details = ?`).bind("Please soften the button color on the contact page.").first();
  assert.equal(saved.client_id, "client-sunrise");
  assert.equal(saved.user_id, "user-maya");
  assert.equal(saved.status, "queued");
});

test("the design uses muted evergreen and contains no bright indigo token", async () => {
  const response = await mf.dispatchFetch(`${origin}/portal`);
  const markup = await response.text();
  assert.match(markup, /--accent: #3f6b5b/);
  assert.doesNotMatch(markup, /#4f46e5|79,\s*70,\s*229/i);
});
