import { readForm } from "./http.js";
import {
  clearClientCookie,
  consumeMagicToken,
  createMagicToken,
  destroyClientSession,
  portalLoginAllowed,
  validateCsrf
} from "./auth.js";
import { sendEmail, magicLinkEmail } from "./email.js";
import { assertSameOrigin } from "./security.js";
import { badge, esc, formatDate, htmlResponse, loginShell, portalShell, redirect, safeUrl } from "./ui.js";

export function portalLoginPage(env, { sent = false, badLink = false, devLink = "", setupError = "" } = {}) {
  let notice = "";
  if (setupError) notice = `<div class="notice error">${esc(setupError)}</div>`;
  else if (badLink) notice = `<div class="notice error">That link has expired or has already been used. Request a new one below.</div>`;
  else if (sent) notice = `<div class="notice success">If that email is on file, a secure sign-in link is on its way. It works once and expires in 20 minutes.</div>`;
  if (devLink) notice += `<div class="notice"><b>Local preview link</b><br><a href="${esc(devLink)}">Open the seeded client portal →</a></div>`;
  return htmlResponse(loginShell(env, {
    title: "Open your client portal",
    subtitle: "Enter your email and we will send a secure sign-in link. No password to remember.",
    action: "/portal/login",
    field: `<div class="field" style="margin-top:22px"><label for="email">Email address</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com"></div>`,
    button: "Send sign-in link",
    notice
  }));
}

export async function handlePortalLogin(request, env) {
  if (!assertSameOrigin(request)) return new Response("Invalid origin", { status: 403 });
  const form = await readForm(request);
  const email = String(form.get("email") || "").trim().toLowerCase().slice(0, 254);
  const rate = await portalLoginAllowed(env, request, email);
  if (!rate.allowed) return portalLoginPage(env, { sent: true });
  const localPreview = env.DEV_SHOW_MAGIC_LINKS === "1" && ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
  if (!env.RESEND_API_KEY && !localPreview) {
    return portalLoginPage(env, { setupError: "Email delivery is not configured yet. The studio owner needs to add a Resend API key." });
  }
  let devLink = "";
  if (email) {
    const user = await env.DB.prepare(`SELECT id, client_id, email, name FROM users WHERE email = ?`).bind(email).first();
    if (user) {
      const raw = await createMagicToken(env, user);
      const url = `${new URL(request.url).origin}/portal/auth/${encodeURIComponent(raw)}`;
      if (localPreview) {
        devLink = url;
      } else {
        const result = await sendEmail(env, { to: user.email, ...magicLinkEmail(env, user, url) });
        if (!result.ok) console.error("Magic-link email delivery failed");
      }
    }
  }
  return portalLoginPage(env, { sent: true, devLink });
}

export async function handlePortalToken(request, env, raw) {
  const result = await consumeMagicToken(request, env, raw);
  if (!result) return portalLoginPage(env, { badLink: true });
  return redirect("/portal", { "set-cookie": result.cookie });
}

export async function handlePortalLogout(request, env, session) {
  if (!validateCsrf(request, await readForm(request), session)) return new Response("Invalid form token", { status: 403 });
  await destroyClientSession(request, env);
  return redirect("/portal", { "set-cookie": clearClientCookie(request) });
}

async function portalData(env, clientId) {
  const batch = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM projects WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC, id DESC LIMIT 1`).bind(clientId),
    env.DB.prepare(`SELECT * FROM updates WHERE client_id = ? AND client_visible = 1 ORDER BY created_at DESC LIMIT 12`).bind(clientId),
    env.DB.prepare(`SELECT * FROM requests WHERE client_id = ? ORDER BY created_at DESC LIMIT 12`).bind(clientId),
    env.DB.prepare(`SELECT * FROM agreements WHERE client_id = ? AND status = 'active' ORDER BY created_at DESC`).bind(clientId)
  ]);
  return { project: batch[0].results[0], updates: batch[1].results, requests: batch[2].results, agreements: batch[3].results };
}

export async function portalHome(env, session, url) {
  const data = await portalData(env, session.client_id);
  const project = data.project;
  const first = String(session.user_name || "there").trim().split(/\s+/)[0];
  const updates = data.updates.length ? data.updates.map((update) => `<div class="timeline-item"><p>${esc(update.body)}${update.link_url ? ` <a href="${esc(safeUrl(update.link_url))}" rel="noreferrer">${esc(update.link_label || "Open link")}</a>` : ""}</p><time>${formatDate(update.created_at)}</time></div>`).join("") : `<div class="empty">There are no updates yet. Your studio will post them here.</div>`;
  const requests = data.requests.length ? data.requests.map((item) => `<div class="request"><div><b>${esc(item.type.replace(/_/g, " "))}</b><p>${esc(item.details)}</p><small>${formatDate(item.created_at)}</small></div>${badge(item.status)}</div>`).join("") : `<div class="empty">You have not sent any requests yet.</div>`;
  const agreements = data.agreements.length ? data.agreements.map((agreement) => `<div class="info-tile"><span class="meta-label">${esc(agreement.label)}</span><strong>${esc([agreement.amount, agreement.cadence].filter(Boolean).join(" · ") || "Active")}</strong></div>`).join("") : `<div class="empty">No active agreements are listed.</div>`;
  const submitted = url.searchParams.get("submitted") ? `<div class="notice success">Your request is in. You can follow its status below.</div>` : "";
  const live = safeUrl(session.live_url);
  const body = `${submitted}<section class="portal-hero"><div><p class="eyebrow">Your project space</p><h1>Hi ${esc(first)}. Here is where everything stands.</h1><p class="sub">Progress, recent updates, project details, and requests are all together here.</p></div>${live ? `<a class="button secondary" href="${esc(live)}" target="_blank" rel="noreferrer">View live site ↗</a>` : ""}</section>
  ${project ? `<section class="portal-progress"><div class="project-top"><div><span class="meta-label">Current project</span><h2 style="margin:4px 0">${esc(project.name)}</h2><p>${esc(project.current_focus || "Your project is moving forward.")}</p></div><div style="text-align:right"><span class="meta-label">Current stage</span><strong>${esc(project.stage)}</strong></div></div><div class="progress" aria-label="${Number(project.progress)} percent complete" style="margin-top:16px"><span style="width:${Number(project.progress) || 0}%"></span></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#c8d0cc"><span>${Number(project.progress) || 0}% complete</span><span>Target ${formatDate(project.target_launch)}</span></div></section>` : `<div class="notice">Your studio has not added an active project yet.</div>`}
  <div class="portal-grid"><div class="stack">
    <section class="card"><div class="card-head"><h2>Latest updates</h2></div><div class="card-body"><div class="timeline">${updates}</div></div></section>
    <section class="card"><div class="card-head"><h2>Your requests</h2></div><div class="card-body">${requests}</div></section>
  </div><aside class="stack">
    <section class="card" id="request"><div class="card-head"><h2>Send a request</h2></div><div class="card-body"><p class="sub" style="margin-bottom:15px">Share what you need and it will land in your studio's queue.</p><form method="post" action="/portal/requests"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><div class="portal-request-types">
      ${[["content","Content"],["design","Design"],["question","Question"],["support","Support"]].map(([value,label], index) => `<label class="radio-card"><input type="radio" name="type" value="${value}" ${index === 0 ? "checked" : ""}><span>${label}</span></label>`).join("")}
      </div><div class="field"><label for="details">What do you need?</label><textarea id="details" name="details" required maxlength="3000" placeholder="Add the details, page, or link involved."></textarea></div><div class="field" style="margin-top:12px"><label for="urgency">Timing</label><select id="urgency" name="urgency"><option value="normal">Normal queue</option><option value="soon">This week</option><option value="urgent">Urgent</option></select></div><button class="button" type="submit" style="width:100%;margin-top:15px">Send request</button></form></div></section>
    <section class="card"><div class="card-head"><h2>Project details</h2></div><div class="card-body"><div class="two-col-list"><div class="info-tile"><span class="meta-label">Client</span><strong>${esc(session.business || session.client_name)}</strong></div><div class="info-tile"><span class="meta-label">Care plan</span><strong>${esc(session.care_plan || "Not listed")}</strong></div>${agreements}</div></div></section>
  </aside></div><p class="footer">${esc(env.STUDIO_NAME || "Your Studio")} · ${env.SUPPORT_EMAIL ? `<a href="mailto:${esc(env.SUPPORT_EMAIL)}">${esc(env.SUPPORT_EMAIL)}</a>` : "Client portal"}</p>`;
  return htmlResponse(portalShell(env, { title: "Your client portal", body, session }));
}

export async function handlePortalRequest(request, env, session) {
  const form = await readForm(request);
  if (!validateCsrf(request, form, session)) return new Response("Invalid form token", { status: 403 });
  const type = String(form.get("type") || "other");
  const urgency = String(form.get("urgency") || "normal");
  const details = String(form.get("details") || "").trim().slice(0, 3000);
  if (!["content", "design", "question", "support", "other"].includes(type)) return new Response("Invalid request type", { status: 400 });
  if (!["normal", "soon", "urgent"].includes(urgency)) return new Response("Invalid urgency", { status: 400 });
  if (!details) return new Response("Request details are required", { status: 400 });
  await env.DB.prepare(`INSERT INTO requests (id, client_id, user_id, type, details, urgency, status) VALUES (?, ?, ?, ?, ?, ?, 'queued')`)
    .bind(crypto.randomUUID(), session.client_id, session.user_id, type, details, urgency).run();
  return redirect("/portal?submitted=1");
}
