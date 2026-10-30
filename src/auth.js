import {
  assertSameOrigin,
  clearCookieHeader,
  cookieHeader,
  createSignedPayload,
  hmacHex,
  randomToken,
  readCookie,
  secretsMatch,
  sha256Hex,
  verifySignedPayload
} from "./security.js";

export const ADMIN_COOKIE = "studio_admin";
export const CLIENT_COOKIE = "studio_client";
const ADMIN_SESSION_SECONDS = 12 * 60 * 60;
const CLIENT_SESSION_DAYS = 30;

export function missingConfiguration(env) {
  const minimums = { ADMIN_PASSWORD: 12, SESSION_SECRET: 32, MAGIC_LINK_SECRET: 32 };
  const missing = Object.entries(minimums)
    .filter(([key, minimum]) => typeof env[key] !== "string" || env[key].length < minimum || /^(replace-with|change-this)/i.test(env[key]))
    .map(([key]) => key);
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.MAGIC_LINK_SECRET) missing.push("distinct signing secrets");
  return missing;
}

async function reserveAttempts(env, entries) {
  const statements = await Promise.all(entries.map(async ([scope, value, limit]) => {
    const key = await sha256Hex(`${scope}:${value}`);
    return { key, limit, statement: env.DB.prepare(
      `INSERT INTO login_attempts (key, failures, updated_at)
       VALUES (?, 1, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         failures = CASE WHEN updated_at <= datetime('now', '-15 minutes') THEN 1 ELSE failures + 1 END,
         updated_at = CASE WHEN updated_at <= datetime('now', '-15 minutes') THEN datetime('now') ELSE updated_at END
       RETURNING failures`
    ).bind(key) };
  }));
  const results = await env.DB.batch(statements.map((item) => item.statement));
  return { allowed: results.every((result, index) => result.results[0].failures <= statements[index].limit), key: statements[0].key };
}

export async function portalLoginAllowed(env, request, email) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  return reserveAttempts(env, [["portal-ip", ip, 20], ["portal-email", email || "blank", 5]]);
}

export async function makeAdminSession(request, env) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    exp: now + ADMIN_SESSION_SECONDS,
    csrf: randomToken(24),
    nonce: randomToken(12)
  };
  const value = await createSignedPayload(env.SESSION_SECRET, payload);
  return { payload, cookie: cookieHeader(request, ADMIN_COOKIE, value, ADMIN_SESSION_SECONDS) };
}

export async function getAdminSession(request, env) {
  const value = readCookie(request, ADMIN_COOKIE);
  const payload = await verifySignedPayload(env.SESSION_SECRET, value);
  if (!payload || typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (!payload.csrf || !payload.nonce) return null;
  return payload;
}

export async function adminLoginAllowed(env, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  return reserveAttempts(env, [["admin", ip, 5]]);
}

export async function clearAdminLoginFailures(env, key) {
  await env.DB.prepare(`DELETE FROM login_attempts WHERE key = ?`).bind(key).run();
}

export async function checkAdminPassword(env, supplied) {
  return secretsMatch(env.ADMIN_PASSWORD, supplied);
}

export function validateCsrf(request, form, session) {
  return assertSameOrigin(request) && Boolean(session?.csrf) && form.get("csrf") === session.csrf;
}

export async function createMagicToken(env, user) {
  const raw = randomToken();
  const tokenHash = await hmacHex(env.MAGIC_LINK_SECRET, raw);
  await env.DB.prepare(
    `INSERT INTO magic_tokens (id, client_id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+20 minutes'))`
  ).bind(crypto.randomUUID(), user.client_id, user.id, tokenHash).run();
  return raw;
}

export async function consumeMagicToken(request, env, raw) {
  if (!raw) return null;
  const tokenHash = await hmacHex(env.MAGIC_LINK_SECRET, raw);
  const burn = await env.DB.prepare(
    `UPDATE magic_tokens SET used_at = datetime('now')
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
  ).bind(tokenHash).run();
  if (burn.meta?.changes !== 1) return null;
  const token = await env.DB.prepare(
    `SELECT client_id, user_id FROM magic_tokens WHERE token_hash = ?`
  ).bind(tokenHash).first();
  if (!token) return null;
  const rawSession = randomToken();
  const sessionId = await hmacHex(env.MAGIC_LINK_SECRET, rawSession);
  const csrf = randomToken(24);
  await env.DB.prepare(
    `INSERT INTO sessions (id, client_id, user_id, csrf_token, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+${CLIENT_SESSION_DAYS} days'))`
  ).bind(sessionId, token.client_id, token.user_id, csrf).run();
  return {
    cookie: cookieHeader(request, CLIENT_COOKIE, rawSession, CLIENT_SESSION_DAYS * 86400, "Lax")
  };
}

export async function createViewAsSession(request, env, clientId) {
  const user = await env.DB.prepare(
    `SELECT id, client_id FROM users WHERE client_id = ? ORDER BY created_at LIMIT 1`
  ).bind(clientId).first();
  if (!user) return null;
  const rawSession = randomToken();
  const sessionId = await hmacHex(env.MAGIC_LINK_SECRET, rawSession);
  await env.DB.prepare(
    `INSERT INTO sessions (id, client_id, user_id, csrf_token, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+1 hour'))`
  ).bind(sessionId, user.client_id, user.id, randomToken(24)).run();
  return cookieHeader(request, CLIENT_COOKIE, rawSession, 3600, "Lax");
}

export async function getClientSession(request, env) {
  const rawSession = readCookie(request, CLIENT_COOKIE);
  if (!rawSession) return null;
  const sessionId = await hmacHex(env.MAGIC_LINK_SECRET, rawSession);
  return env.DB.prepare(
    `SELECT s.id AS session_id, s.client_id, s.user_id, s.csrf_token AS csrf,
            u.name AS user_name, u.email AS user_email,
            c.name AS client_name, c.business, c.live_url, c.care_plan
     FROM sessions s
     JOIN users u ON u.id = s.user_id AND u.client_id = s.client_id
     JOIN clients c ON c.id = s.client_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`
  ).bind(sessionId).first();
}

export async function destroyClientSession(request, env) {
  const rawSession = readCookie(request, CLIENT_COOKIE);
  if (!rawSession) return;
  const sessionId = await hmacHex(env.MAGIC_LINK_SECRET, rawSession);
  await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

export function clearAdminCookie(request) {
  return clearCookieHeader(request, ADMIN_COOKIE);
}

export function clearClientCookie(request) {
  return clearCookieHeader(request, CLIENT_COOKIE);
}
