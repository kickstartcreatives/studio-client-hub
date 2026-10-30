export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function formatDate(value, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(`${value}${value.length === 10 ? "T12:00:00" : "Z"}`);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

const BASE_CSS = `
  .sign-out { color: inherit; font: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  .sign-out:hover { text-decoration: underline; }
  :root {
    --ink: #1f2937;
    --ink-soft: #465364;
    --muted: #6b7280;
    --canvas: #f5f7f6;
    --card: #ffffff;
    --line: #dce4e0;
    --line-strong: #cbd6d1;
    --accent: #3f6b5b;
    --accent-dark: #315548;
    --accent-soft: #e8f0ec;
    --accent-pale: #f2f6f4;
    --success: #31735a;
    --success-soft: #e5f3ec;
    --warning: #946f34;
    --warning-soft: #f8f0de;
    --danger: #a74949;
    --danger-soft: #f8e8e8;
    --sidebar: #202a35;
    --sidebar-soft: #2b3744;
    --radius: 14px;
    --shadow: 0 1px 2px rgba(31,41,55,.05), 0 10px 30px rgba(31,41,55,.035);
    --font: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  html { color-scheme: light; background: var(--canvas); }
  body { margin: 0; color: var(--ink); background: var(--canvas); font-family: var(--font); font-size: 15px; line-height: 1.55; }
  a { color: var(--accent-dark); text-decoration-thickness: 1px; text-underline-offset: 3px; }
  button, input, select, textarea { font: inherit; }
  button, .button { cursor: pointer; }
  :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .skip-link { position: absolute; left: -9999px; top: 8px; z-index: 100; background: white; padding: 8px 12px; }
  .skip-link:focus { left: 8px; }
  .app { min-height: 100vh; }
  .admin-app { display: grid; grid-template-columns: 230px minmax(0,1fr); }
  .sidebar { min-height: 100vh; position: sticky; top: 0; align-self: start; background: var(--sidebar); color: #e6ece9; padding: 24px 16px; }
  .brand { display: flex; gap: 11px; align-items: center; color: white; text-decoration: none; padding: 0 8px 22px; }
  .brand-mark { width: 33px; height: 33px; border-radius: 9px; display: grid; place-items: center; background: var(--accent); font-weight: 800; color: white; }
  .brand-text { min-width: 0; }
  .brand-text b { display: block; font-size: 14px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .brand-text span { display: block; color: #aeb9b4; font-size: 11px; margin-top: 1px; }
  .nav-label { margin: 18px 10px 7px; color: #829089; font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
  .nav { display: grid; gap: 3px; }
  .nav a { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 9px 11px; border-radius: 9px; color: #c7d0cc; text-decoration: none; font-size: 13px; font-weight: 650; }
  .nav a:hover { color: white; background: var(--sidebar-soft); }
  .nav a.active { color: white; background: rgba(63,107,91,.65); }
  .nav-icon { width: 18px; text-align: center; color: #9eaaa4; }
  .nav a.active .nav-icon { color: white; }
  .sidebar-foot { position: absolute; left: 16px; right: 16px; bottom: 18px; border-top: 1px solid rgba(255,255,255,.09); padding-top: 12px; }
  .sidebar-foot a, .sidebar-foot .sign-out { color: #aeb9b4; font-size: 12px; text-decoration: none; }
  .main { min-width: 0; }
  .topbar { min-height: 66px; display: flex; align-items: center; justify-content: space-between; gap: 18px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.88); backdrop-filter: blur(10px); padding: 0 clamp(22px,4vw,52px); }
  .topbar-title { font-size: 13px; color: var(--muted); }
  .topbar-title b { color: var(--ink); }
  .content { width: min(1180px, 100%); margin: 0 auto; padding: clamp(28px,4vw,48px) clamp(20px,4vw,52px) 70px; }
  .page-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-bottom: 28px; }
  .eyebrow { color: var(--accent); margin: 0 0 5px; font-weight: 800; font-size: 11px; letter-spacing: .11em; text-transform: uppercase; }
  h1, h2, h3, p { margin-top: 0; }
  h1 { margin-bottom: 7px; font-size: clamp(27px,4vw,38px); line-height: 1.15; letter-spacing: -.035em; }
  h2 { font-size: 18px; letter-spacing: -.018em; }
  h3 { font-size: 14px; }
  .sub { color: var(--muted); margin-bottom: 0; max-width: 62ch; }
  .button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; border: 1px solid transparent; border-radius: 9px; padding: 9px 15px; background: var(--accent); color: white; font-weight: 750; font-size: 13px; line-height: 1; text-decoration: none; }
  .button:hover { background: var(--accent-dark); }
  .button.secondary { color: var(--ink); border-color: var(--line-strong); background: white; }
  .button.secondary:hover { border-color: var(--accent); color: var(--accent-dark); }
  .button.ghost { color: var(--accent-dark); background: var(--accent-soft); }
  .button.danger { color: var(--danger); background: var(--danger-soft); }
  .button.small { min-height: 34px; padding: 7px 11px; font-size: 12px; }
  .stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; margin-bottom: 22px; }
  .stat { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 17px 18px; box-shadow: var(--shadow); }
  .stat span { display: block; color: var(--muted); font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: .07em; }
  .stat strong { display: block; margin-top: 4px; font-size: 26px; line-height: 1.15; letter-spacing: -.03em; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--line); padding: 17px 20px; }
  .card-head h2, .card-head h3 { margin: 0; }
  .card-body { padding: 20px; }
  .client-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
  .client-grid.single-column { grid-template-columns: 1fr; }
  .client-card { position: relative; padding: 20px; color: inherit; text-decoration: none; transition: transform .15s, border-color .15s, box-shadow .15s; }
  .client-card:hover { transform: translateY(-2px); border-color: var(--line-strong); box-shadow: 0 12px 30px rgba(31,41,55,.08); }
  .client-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .avatar { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-dark); font-weight: 850; }
  .client-name { min-width: 0; flex: 1; }
  .client-name h2 { margin: 0 0 2px; font-size: 16px; }
  .client-name p { margin: 0; color: var(--muted); font-size: 12px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 4px 8px; font-size: 10px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; white-space: nowrap; }
  .badge.active, .badge.done { color: var(--success); background: var(--success-soft); }
  .badge.queued, .badge.lead { color: var(--warning); background: var(--warning-soft); }
  .badge.in_progress { color: var(--accent-dark); background: var(--accent-soft); }
  .badge.past, .badge.paused { color: var(--muted); background: #eef0f2; }
  .client-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid var(--line); margin-top: 17px; padding-top: 14px; }
  .meta-label { display: block; color: var(--muted); font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .06em; }
  .meta-value { display: block; margin-top: 2px; color: var(--ink-soft); font-size: 12px; font-weight: 650; overflow-wrap: anywhere; }
  .split { display: grid; grid-template-columns: minmax(0,1.55fr) minmax(280px,.85fr); gap: 18px; align-items: start; }
  .stack { display: grid; gap: 18px; }
  .snapshot { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 1px; overflow: hidden; background: var(--line); border: 1px solid var(--line); border-radius: var(--radius); margin-bottom: 18px; }
  .snapshot-item { background: white; padding: 17px; min-height: 88px; }
  .snapshot-item .meta-value { font-size: 13px; color: var(--ink); }
  .snapshot-item.attention { background: var(--accent-pale); }
  .progress { height: 8px; border-radius: 999px; overflow: hidden; background: #e6ebe8; }
  .progress > span { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
  .project-row { display: grid; gap: 12px; }
  .project-top { display: flex; justify-content: space-between; gap: 16px; }
  .project-top h3 { margin: 0 0 2px; }
  .project-top p { margin: 0; color: var(--muted); font-size: 12px; }
  .timeline { display: grid; }
  .timeline-item { position: relative; padding: 0 0 18px 24px; }
  .timeline-item:last-child { padding-bottom: 0; }
  .timeline-item::before { content: ""; position: absolute; left: 6px; top: 8px; bottom: -4px; width: 1px; background: var(--line); }
  .timeline-item:last-child::before { display: none; }
  .timeline-item::after { content: ""; position: absolute; left: 2px; top: 6px; width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .timeline-item p { margin: 0 0 5px; color: var(--ink-soft); font-size: 13px; white-space: pre-wrap; }
  .timeline-item time { color: var(--muted); font-size: 11px; }
  .request { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 13px 0; border-bottom: 1px solid var(--line); }
  .request > .badge, .request > .inline-form { align-self: start; }
  .request:last-child { border-bottom: 0; }
  .request p { margin: 2px 0 4px; color: var(--ink-soft); font-size: 13px; }
  .request small { color: var(--muted); }
  .empty { padding: 26px 18px; color: var(--muted); text-align: center; border: 1px dashed var(--line-strong); border-radius: 10px; }
  .notice { border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 10px; padding: 13px 15px; margin-bottom: 18px; background: white; color: var(--ink-soft); }
  .notice.error { border-left-color: var(--danger); background: var(--danger-soft); }
  .notice.success { border-left-color: var(--success); background: var(--success-soft); }
  form { margin: 0; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  .field { display: grid; gap: 6px; }
  .field.full { grid-column: 1 / -1; }
  label { color: var(--ink-soft); font-size: 12px; font-weight: 750; }
  input, select, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: 9px; background: white; color: var(--ink); padding: 10px 11px; }
  textarea { min-height: 105px; resize: vertical; }
  input::placeholder, textarea::placeholder { color: #9ba4ad; }
  .form-actions { display: flex; gap: 9px; align-items: center; margin-top: 17px; }
  .inline-form { display: flex; align-items: center; gap: 8px; }
  .inline-form select { min-width: 130px; padding: 7px 9px; }
  details.editor { border-top: 1px solid var(--line); }
  details.editor summary { cursor: pointer; list-style: none; color: var(--accent-dark); font-size: 12px; font-weight: 750; padding: 13px 20px; }
  details.editor summary::-webkit-details-marker { display: none; }
  details.editor[open] summary { border-bottom: 1px solid var(--line); }
  details.editor .editor-body { padding: 18px 20px 20px; }
  .login-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at 75% 5%, var(--accent-soft), transparent 34%), var(--canvas); }
  .login-card { width: min(440px,100%); padding: 30px; }
  .login-card .brand { padding: 0 0 28px; color: var(--ink); }
  .login-card .brand-text b { color: var(--ink); }
  .login-card .brand-text span { color: var(--muted); }
  .login-card h1 { font-size: 30px; }
  .login-card .button { width: 100%; margin-top: 16px; }
  .login-foot { color: var(--muted); font-size: 11px; text-align: center; margin: 18px 0 0; }
  .portal-app { min-height: 100vh; }
  .portal-topbar { min-height: 70px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 max(22px,calc((100vw - 1060px)/2)); border-bottom: 1px solid var(--line); background: white; }
  .portal-topbar .brand { padding: 0; color: var(--ink); }
  .portal-topbar .brand-text b { color: var(--ink); }
  .portal-topbar .brand-text span { color: var(--muted); }
  .portal-topbar nav { display: flex; gap: 14px; align-items: center; font-size: 12px; }
  .portal-topbar nav a { color: var(--muted); text-decoration: none; }
  .portal-main { width: min(1060px,100%); margin: 0 auto; padding: 42px 22px 72px; }
  .portal-hero { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; margin-bottom: 26px; }
  .portal-hero h1 { max-width: 700px; }
  .portal-progress { background: var(--ink); color: white; border-radius: var(--radius); padding: 22px; margin-bottom: 18px; }
  .portal-progress .meta-label { color: #aeb9b4; }
  .portal-progress .project-top p { color: #c8d0cc; }
  .portal-progress .progress { background: rgba(255,255,255,.18); }
  .portal-progress .progress > span { background: #8eb3a5; }
  .portal-grid { display: grid; grid-template-columns: minmax(0,1.45fr) minmax(270px,.8fr); gap: 18px; align-items: start; }
  .portal-request-types { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; margin-bottom: 14px; }
  .radio-card { position: relative; }
  .radio-card input { position: absolute; opacity: 0; pointer-events: none; }
  .radio-card span { display: block; padding: 10px; border: 1px solid var(--line-strong); border-radius: 9px; color: var(--ink-soft); font-size: 12px; font-weight: 700; text-align: center; cursor: pointer; }
  .radio-card input:checked + span { color: var(--accent-dark); border-color: var(--accent); background: var(--accent-soft); }
  .two-col-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-tile { padding: 13px; border: 1px solid var(--line); border-radius: 9px; background: var(--accent-pale); }
  .info-tile strong { display: block; margin-top: 3px; font-size: 13px; }
  .footer { margin-top: 38px; color: var(--muted); font-size: 11px; text-align: center; }
  @media (max-width: 900px) {
    .admin-app { grid-template-columns: 74px minmax(0,1fr); }
    .sidebar { padding-left: 10px; padding-right: 10px; }
    .brand { justify-content: center; padding-left: 0; padding-right: 0; }
    .brand-text, .nav-label, .nav a span:not(.nav-icon) { display: none; }
    .nav a { justify-content: center; padding: 9px; }
    .stats, .snapshot { grid-template-columns: repeat(2,1fr); }
    .split, .portal-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 620px) {
    .admin-app { display: block; }
    .sidebar { min-height: 0; position: static; display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
    .sidebar .brand { display: flex; justify-content: flex-start; padding: 0; margin-right: auto; }
    .sidebar .brand-mark { width: 30px; height: 30px; }
    .sidebar .nav-label { display: none; }
    .sidebar .sidebar-foot { position: static; border: 0; padding: 0; flex-shrink: 0; }
    .sidebar .nav { display: flex; }
    .sidebar .nav a { min-height: 36px; width: 38px; }
    .topbar { min-height: 52px; padding: 0 18px; }
    .content { padding: 25px 16px 55px; }
    .page-head { align-items: flex-start; flex-direction: column; }
    .page-head .button { width: 100%; }
    .stats, .client-grid, .form-grid, .snapshot { grid-template-columns: 1fr; }
    .field.full { grid-column: auto; }
    .client-meta { grid-template-columns: 1fr; }
    .snapshot { gap: 0; }
    .snapshot-item { border-bottom: 1px solid var(--line); }
    .portal-topbar { padding: 10px 16px; }
    .portal-topbar nav a:not(.button) { display: none; }
    .portal-main { padding: 30px 16px 55px; }
    .portal-hero { grid-template-columns: 1fr; align-items: start; }
    .portal-hero .button { width: 100%; }
    .two-col-list { grid-template-columns: 1fr; }
  }
`;

function brand(env, subtitle = "Studio Client Hub") {
  const name = esc(env.STUDIO_NAME || "Your Studio");
  const initial = esc(name.trim().charAt(0).toUpperCase() || "S");
  return `<span class="brand-mark" aria-hidden="true">${initial}</span><span class="brand-text"><b>${name}</b><span>${esc(subtitle)}</span></span>`;
}

export function document({ title, body, env, description = "A calm client hub for independent web studios." }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(description)}"><meta name="color-scheme" content="light">
<link rel="icon" href="/favicon.svg"><title>${esc(title)}</title><style>${BASE_CSS}</style></head>
<body><a class="skip-link" href="#main">Skip to content</a>${body}</body></html>`;
}

export function adminShell(env, { title, active = "clients", body, session }) {
  return document({ title: `${title} · ${env.STUDIO_NAME || "Studio Client Hub"}`, env, body: `<div class="app admin-app">
  <aside class="sidebar"><a class="brand" aria-label="${esc(env.STUDIO_NAME || "Your Studio")} home" href="/admin">${brand(env)}</a>
    <p class="nav-label">Workspace</p><nav class="nav" aria-label="Admin">
      <a class="${active === "dashboard" ? "active" : ""}" href="/admin" aria-label="Overview"><span class="nav-icon">⌂</span><span>Overview</span></a>
      <a class="${active === "clients" ? "active" : ""}" href="/admin/clients" aria-label="Clients"><span class="nav-icon">◎</span><span>Clients</span></a>
      <a href="/portal" target="_blank" aria-label="Client portal"><span class="nav-icon">↗</span><span>Client portal</span></a>
    </nav><div class="sidebar-foot"><form method="post" action="/admin/logout"><input type="hidden" name="csrf" value="${esc(session?.csrf)}"><button class="sign-out" type="submit">Sign out</button></form></div>
  </aside><div class="main"><header class="topbar"><div class="topbar-title"><b>${esc(env.STUDIO_NAME || "Your Studio")}</b> / Admin</div></header>
  <main class="content" id="main">${body}</main></div></div>` });
}

export function portalShell(env, { title, body, session = null }) {
  return document({ title: `${title} · ${env.STUDIO_NAME || "Client portal"}`, env, body: `<div class="portal-app">
  <header class="portal-topbar"><a class="brand" aria-label="${esc(env.STUDIO_NAME || "Your Studio")} home" href="/portal">${brand(env, "Client portal")}</a>
    <nav aria-label="Portal">${session ? `<span>${esc(session.user_name)}</span><form method="post" action="/portal/logout"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><button class="sign-out" type="submit">Sign out</button></form>` : ""}</nav></header>
  <main class="portal-main" id="main">${body}</main></div>` });
}

export function loginShell(env, { title, subtitle, action, field, button, notice = "", kind = "client" }) {
  const label = kind === "admin" ? "Studio admin" : "Client portal";
  return document({ title, env, body: `<main class="login-page" id="main"><section class="card login-card">
    <a class="brand" aria-label="${esc(env.STUDIO_NAME || "Your Studio")} home" href="/">${brand(env, label)}</a><p class="eyebrow">${esc(label)}</p><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>
    ${notice}<form method="post" action="${esc(action)}">${field}<button class="button" type="submit">${esc(button)} <span aria-hidden="true">→</span></button></form>
    <p class="login-foot">Secure access · ${esc(env.STUDIO_NAME || "Your Studio")}</p></section></main>` });
}

export function badge(status) {
  const safe = String(status || "").toLowerCase().replace(/[^a-z_]/g, "_");
  return `<span class="badge ${safe}">${esc(String(status || "").replace(/_/g, " "))}</span>`;
}

export function initials(name) {
  return String(name || "Client").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: { Location: location, ...headers } });
}

export function htmlResponse(markup, status = 200, headers = {}) {
  return new Response(markup, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      ...headers
    }
  });
}
