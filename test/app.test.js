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

test("private pages, redirects and errors prevent caching and referrer disclosure", async () => {
  for (const path of ["/", "/admin", "/portal", "/missing", "/portal/auth/%E0%A4%A"]) {
    const response = await mf.dispatchFetch(`${origin}${path}`, { redirect: "manual" });
    assert.notEqual(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
});

test("malformed and oversized forms are rejected without a server error", async () => {
  for (const path of ["/admin/login", "/portal/login", "/admin/clients", "/portal/requests"]) {
    const cookie = `${adminCookie}; ${clientCookie}`;
    for (const [type, body, status] of [
      ["application/json", "{}", 415],
      ["multipart/form-data", "broken", 400],
      ["application/x-www-form-urlencoded", `details=${"a".repeat(40000)}`, 413]
    ]) {
      const response = await mf.dispatchFetch(`${origin}${path}`, { method: "POST", headers: { "content-type": type, origin, cookie }, body });
      assert.equal(response.status, status, `${path}: ${type}`);
    }
  }
});

test("multiple active projects produce one client card and a consistent current project", async () => {
  await db.prepare(`INSERT INTO projects (id, client_id, name, stage, current_focus, created_at) VALUES ('newer-project', 'client-sunrise', 'Second project', 'New stage', 'New focus', datetime('now', '+1 minute'))`).run();
  for (const path of ["/admin", "/admin/clients"]) {
    const response = await mf.dispatchFetch(`${origin}${path}`, { headers: { cookie: adminCookie } });
    const markup = await response.text();
    assert.equal((markup.match(/href="\/admin\/clients\/client-sunrise"/g) || []).length, 1);
    assert.match(markup, /New stage/);
  }
  const response = await mf.dispatchFetch(`${origin}/portal`, { headers: { cookie: clientCookie } });
  assert.match(await response.text(), /New focus/);
});

test("duplicate portal emails roll back client creation", async () => {
  const response = await mf.dispatchFetch(...formRequest("/admin/clients", { csrf: adminCsrf, name: "Duplicate", business: "Should not exist", email: "MAYA@EXAMPLE.COM" }, adminCookie));
  assert.equal(response.status, 400);
  const row = await db.prepare("SELECT COUNT(*) AS count FROM clients WHERE business = 'Should not exist'").first();
  assert.equal(row.count, 0);
});

test("private updates and other tenants' projects, requests and agreements stay hidden", async () => {
  const other = await db.prepare("SELECT client_id FROM users WHERE email = 'jordan@example.com'").first();
  await db.batch([
    db.prepare("INSERT INTO updates (id, client_id, body, client_visible) VALUES ('staff-only', 'client-sunrise', 'STAFF_ONLY_CONTENT', 0)"),
    db.prepare("INSERT INTO projects (id, client_id, name) VALUES ('other-project', ?, 'OTHER_PROJECT_SECRET')").bind(other.client_id),
    db.prepare("INSERT INTO agreements (id, client_id, label) VALUES ('other-agreement', ?, 'OTHER_AGREEMENT_SECRET')").bind(other.client_id),
    db.prepare("INSERT INTO requests (id, client_id, user_id, type, details) SELECT 'other-request', client_id, id, 'support', 'OTHER_REQUEST_SECRET' FROM users WHERE email = 'jordan@example.com'")
  ]);
  const response = await mf.dispatchFetch(`${origin}/portal?client_id=${other.client_id}`, { headers: { cookie: clientCookie } });
  const markup = await response.text();
  assert.doesNotMatch(markup, /STAFF_ONLY_CONTENT|OTHER_PROJECT_SECRET|OTHER_AGREEMENT_SECRET|OTHER_REQUEST_SECRET/);
  const sent = await mf.dispatchFetch(...formRequest("/portal/requests", { csrf: clientCsrf, client_id: other.client_id, user_id: "forged", type: "support", details: "Tenant injection attempt" }, clientCookie));
  assert.equal(sent.status, 303);
  const row = await db.prepare("SELECT client_id, user_id FROM requests WHERE details = 'Tenant injection attempt'").first();
  assert.equal(row.client_id, "client-sunrise");
  assert.equal(row.user_id, "user-maya");
  const forbidden = await mf.dispatchFetch(`${origin}/admin/clients/${other.client_id}`, { headers: { cookie: clientCookie }, redirect: "manual" });
  assert.equal(forbidden.headers.get("location"), "/admin/login");
});

test("portal and admin mutations reject a foreign origin even with the correct CSRF token", async () => {
  for (const [path, values, cookie] of [
    ["/portal/requests", { csrf: clientCsrf, type: "support", details: "Foreign origin" }, clientCookie],
    ["/admin/clients", { csrf: adminCsrf, name: "Foreign origin", email: "foreign@example.com" }, adminCookie],
    ["/admin/view-as/client-sunrise", { csrf: adminCsrf }, adminCookie],
    ["/portal/logout", { csrf: clientCsrf }, clientCookie],
    ["/admin/logout", { csrf: adminCsrf }, adminCookie]
  ]) {
    const [url, init] = formRequest(path, values, cookie);
    init.headers.origin = "https://foreign.example";
    assert.equal((await mf.dispatchFetch(url, init)).status, 403, path);
  }
  const missingCsrf = await mf.dispatchFetch(...formRequest("/portal/requests", { type: "support", details: "No token" }, clientCookie));
  assert.equal(missingCsrf.status, 403);
});

test("client preview and logout require POST and a valid form token", async () => {
  for (const path of ["/admin/view-as/client-sunrise", "/admin/logout", "/portal/logout"]) {
    const response = await mf.dispatchFetch(`${origin}${path}`, { headers: { cookie: `${adminCookie}; ${clientCookie}` }, redirect: "manual" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
    const denied = await mf.dispatchFetch(...formRequest(path, { csrf: "bad" }, `${adminCookie}; ${clientCookie}`));
    assert.equal(denied.status, 403);
  }
  const preview = await mf.dispatchFetch(...formRequest("/admin/view-as/client-sunrise", { csrf: adminCsrf }, adminCookie));
  assert.equal(preview.status, 303);
  const previewCookie = cookieFrom(preview);
  const page = await mf.dispatchFetch(`${origin}/portal`, { headers: { cookie: previewCookie } });
  const csrf = hidden(await page.text(), "csrf");
  const logout = await mf.dispatchFetch(...formRequest("/portal/logout", { csrf }, previewCookie));
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  const revoked = await mf.dispatchFetch(`${origin}/portal`, { headers: { cookie: previewCookie } });
  assert.match(await revoked.text(), /Open your client portal/);
  const adminLogout = await mf.dispatchFetch(...formRequest("/admin/logout", { csrf: adminCsrf }, adminCookie));
  assert.equal(adminLogout.status, 303);
  assert.match(adminLogout.headers.get("set-cookie"), /Max-Age=0/);
});

test("concurrent admin guesses are limited and the window resets", async () => {
  await db.prepare("DELETE FROM login_attempts").run();
  const responses = await Promise.all(Array.from({ length: 12 }, () => mf.dispatchFetch(...formRequest("/admin/login", { password: "wrong" }))));
  const bodies = await Promise.all(responses.map((response) => response.text()));
  assert.equal(bodies.filter((body) => body.includes("did not match")).length, 5);
  assert.equal(bodies.filter((body) => body.includes("Too many attempts")).length, 7);
  const blocked = await mf.dispatchFetch(...formRequest("/admin/login", { password: "correct horse battery staple" }));
  assert.equal(blocked.status, 200);
  await db.prepare("UPDATE login_attempts SET updated_at = datetime('now', '-16 minutes')").run();
  const allowed = await mf.dispatchFetch(...formRequest("/admin/login", { password: "correct horse battery staple" }));
  assert.equal(allowed.status, 303);
});

test("portal throttling cannot be bypassed by parallel requests or rotating IPs", async () => {
  await db.prepare("DELETE FROM login_attempts").run();
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => {
    const [url, init] = formRequest("/portal/login", { email: "maya@example.com" });
    init.headers["CF-Connecting-IP"] = `192.0.2.${i + 1}`;
    return mf.dispatchFetch(url, init);
  }));
  const bodies = await Promise.all(responses.map((response) => response.text()));
  assert.equal(bodies.filter((body) => body.includes("Local preview link")).length, 5);
});

test("portal IP throttling also limits requests across different addresses", async () => {
  await db.prepare("DELETE FROM login_attempts").run();
  for (let i = 0; i < 20; i++) await mf.dispatchFetch(...formRequest("/portal/login", { email: `unknown-${i}@example.com` }));
  const blocked = await mf.dispatchFetch(...formRequest("/portal/login", { email: "maya@example.com" }));
  assert.doesNotMatch(await blocked.text(), /Local preview link/);
  await db.prepare("UPDATE login_attempts SET updated_at = datetime('now', '-16 minutes')").run();
  const allowed = await mf.dispatchFetch(...formRequest("/portal/login", { email: "maya@example.com" }));
  assert.match(await allowed.text(), /Local preview link/);
});

test("magic links expire and concurrent redemption creates only one session", async () => {
  await db.prepare("DELETE FROM login_attempts").run();
  async function newLink() {
    const response = await mf.dispatchFetch(...formRequest("/portal/login", { email: "maya@example.com" }));
    return (await response.text()).match(/href="(http:\/\/localhost\/portal\/auth\/[^"]+)"/)[1];
  }
  const expired = await newLink();
  await db.prepare("UPDATE magic_tokens SET expires_at = datetime('now', '-1 minute') WHERE used_at IS NULL").run();
  const expiredResponse = await mf.dispatchFetch(expired, { redirect: "manual" });
  assert.equal(expiredResponse.headers.get("set-cookie"), null);
  assert.match(await expiredResponse.text(), /expired or has already been used/);
  const link = await newLink();
  const attempts = await Promise.all(Array.from({ length: 8 }, () => mf.dispatchFetch(link, { redirect: "manual" })));
  assert.equal(attempts.filter((response) => response.status === 303).length, 1);
});

test("local preview links never appear on a deployed hostname", async () => {
  await db.prepare("DELETE FROM login_attempts").run();
  const response = await mf.dispatchFetch("https://studio.example/portal/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://studio.example" }, body: "email=maya%40example.com" });
  const markup = await response.text();
  assert.doesNotMatch(markup, /Local preview link|\/portal\/auth\//);
  assert.match(markup, /Email delivery is not configured/);
});

test("HTTPS cookies are secure and tampered or expired sessions do not authenticate", async () => {
  await db.prepare("DELETE FROM login_attempts").run();
  const login = await mf.dispatchFetch("https://studio.example/admin/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://studio.example" }, body: "password=correct+horse+battery+staple", redirect: "manual" });
  assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Strict; Max-Age=43200; Secure/);
  const { createSignedPayload } = await import("../src/security.js");
  const expired = await createSignedPayload("test-session-secret-with-at-least-thirty-two-characters", { exp: 1, csrf: "x", nonce: "y" });
  for (const cookie of [`${adminCookie}tampered`, `studio_admin=${expired}`, "studio_admin=invalid"]) {
    const response = await mf.dispatchFetch(`${origin}/admin`, { headers: { cookie }, redirect: "manual" });
    assert.equal(response.headers.get("location"), "/admin/login");
  }
  await db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 minute')").run();
  const response = await mf.dispatchFetch(`${origin}/portal`, { headers: { cookie: clientCookie } });
  assert.match(await response.text(), /Open your client portal/);
});

test("remaining admin write flows persist projects, agreements and request status", async () => {
  const project = await mf.dispatchFetch(...formRequest("/admin/clients/client-sunrise/projects", { csrf: adminCsrf, name: "Added project", stage: "Planning", progress: "10" }, adminCookie));
  assert.equal(project.status, 303);
  assert.ok(await db.prepare("SELECT id FROM projects WHERE name = 'Added project'").first());
  const agreement = await mf.dispatchFetch(...formRequest("/admin/clients/client-sunrise/agreements", { csrf: adminCsrf, label: "Site care", amount: "$100", cadence: "Monthly" }, adminCookie));
  assert.equal(agreement.status, 303);
  assert.ok(await db.prepare("SELECT id FROM agreements WHERE amount = '$100'").first());
  const update = await mf.dispatchFetch(...formRequest("/admin/requests/request-sunrise-1/status", { csrf: adminCsrf, status: "done" }, adminCookie));
  assert.equal(update.status, 303);
  assert.equal((await db.prepare("SELECT status FROM requests WHERE id = 'request-sunrise-1'").first()).status, "done");
  const invalid = await mf.dispatchFetch(...formRequest("/admin/requests/request-sunrise-1/status", { csrf: adminCsrf, status: "invented" }, adminCookie));
  assert.equal(invalid.status, 400);
});

test("client editor controls have unique IDs and associated visible labels", async () => {
  const response = await mf.dispatchFetch(`${origin}/admin/clients/client-sunrise`, { headers: { cookie: adminCookie } });
  const markup = await response.text();
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "multiple projects must not duplicate field IDs");
  for (const match of markup.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) {
    const [tag] = match;
    const preceding = markup.slice(0, match.index);
    if (preceding.lastIndexOf("<label") > preceding.lastIndexOf("</label>")) continue;
    if (tag.includes('type="hidden"') || tag.includes('aria-label="')) continue;
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    assert.ok(id && markup.includes(`<label for="${id}">`), `unlabelled control: ${tag}`);
  }
});
