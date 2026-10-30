import { readForm, HttpError } from "./http.js";
import {
  adminLoginAllowed,
  checkAdminPassword,
  clearAdminCookie,
  clearAdminLoginFailures,
  createViewAsSession,
  makeAdminSession,
  validateCsrf
} from "./auth.js";
import {
  adminShell,
  badge,
  esc,
  formatDate,
  htmlResponse,
  initials,
  loginShell,
  redirect,
  safeUrl
} from "./ui.js";
import { assertSameOrigin } from "./security.js";

function text(form, key, max = 500) {
  return String(form.get(key) || "").trim().slice(0, max);
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function slugify(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function normalizeUrl(value) {
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const checked = safeUrl(withProtocol);
  if (!checked) throw new Error("Website URL must be a valid http or https address.");
  return checked;
}

function formErrorPage(env, session, message, returnTo = "/admin/clients") {
  return htmlResponse(adminShell(env, { session, title: "Could not save", body: `<div class="notice error"><b>Could not save.</b> ${esc(message)}</div><a class="button secondary" href="${esc(returnTo)}">Go back</a>` }), 400);
}

export function adminLoginPage(env, { error = "" } = {}) {
  const notice = error ? `<div class="notice error">${esc(error)}</div>` : "";
  return htmlResponse(loginShell(env, {
    kind: "admin",
    title: "Welcome back",
    subtitle: "Sign in to manage clients, projects, updates, and requests.",
    action: "/admin/login",
    field: `<div class="field" style="margin-top:22px"><label for="password">Admin password</label><input id="password" name="password" type="password" required autocomplete="current-password"></div>`,
    button: "Open admin",
    notice
  }));
}

export async function handleAdminLogin(request, env) {
  if (!assertSameOrigin(request)) return new Response("Invalid origin", { status: 403 });
  const form = await readForm(request);
  const rate = await adminLoginAllowed(env, request);
  if (!rate.allowed) return adminLoginPage(env, { error: "Too many attempts. Try again in 15 minutes." });
  if (!(await checkAdminPassword(env, String(form.get("password") || "")))) {
    return adminLoginPage(env, { error: "That password did not match." });
  }
  await clearAdminLoginFailures(env, rate.key);
  const made = await makeAdminSession(request, env);
  return redirect("/admin", { "set-cookie": made.cookie });
}

export async function handleAdminLogout(request, session) {
  if (!validateCsrf(request, await readForm(request), session)) return new Response("Invalid form token", { status: 403 });
  return redirect("/admin/login", { "set-cookie": clearAdminCookie(request) });
}

async function dashboardData(env) {
  const batch = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS count FROM clients WHERE status = 'active'`),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM projects WHERE status = 'active'`),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM requests WHERE status != 'done'`),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM clients WHERE next_action IS NOT NULL AND trim(next_action) != ''`),
    env.DB.prepare(`SELECT c.id, c.name, c.business, c.next_action, c.status, p.stage, p.progress
                    FROM clients c LEFT JOIN projects p ON p.id = (SELECT id FROM projects WHERE client_id = c.id AND status = 'active' ORDER BY created_at DESC, id DESC LIMIT 1)
                    WHERE c.status != 'past' ORDER BY c.updated_at DESC LIMIT 6`),
    env.DB.prepare(`SELECT r.id, r.details, r.status, r.created_at, c.name AS client_name
                    FROM requests r JOIN clients c ON c.id = r.client_id
                    WHERE r.status != 'done' ORDER BY r.created_at DESC LIMIT 5`)
  ]);
  return {
    activeClients: batch[0].results[0]?.count || 0,
    activeProjects: batch[1].results[0]?.count || 0,
    openRequests: batch[2].results[0]?.count || 0,
    nextActions: batch[3].results[0]?.count || 0,
    clients: batch[4].results,
    requests: batch[5].results
  };
}

export async function adminDashboard(env, session) {
  const data = await dashboardData(env);
  const clients = data.clients.length ? data.clients.map((client) => `<a class="card client-card" href="/admin/clients/${esc(client.id)}"><div class="client-title"><div class="avatar">${esc(initials(client.name))}</div><div class="client-name"><h2>${esc(client.name)}</h2><p>${esc(client.business || "Independent client")}</p></div>${badge(client.status)}</div><div class="client-meta"><div><span class="meta-label">Current stage</span><span class="meta-value">${esc(client.stage || "No active project")}</span></div><div><span class="meta-label">Next action</span><span class="meta-value">${esc(client.next_action || "Nothing queued")}</span></div></div></a>`).join("") : `<div class="empty">No clients yet. Add your first one to get started.</div>`;
  const requests = data.requests.length ? data.requests.map((request) => `<div class="request"><div><b>${esc(request.client_name)}</b><p>${esc(request.details)}</p><small>${formatDate(request.created_at)}</small></div>${badge(request.status)}</div>`).join("") : `<div class="empty">No open requests.</div>`;
  const body = `<div class="page-head"><div><p class="eyebrow">Studio overview</p><h1>Everything in one calm place.</h1><p class="sub">See who needs attention, what is moving, and what came in from clients.</p></div><a class="button" href="/admin/clients/new">Add client</a></div>
  <section class="stats" aria-label="Studio snapshot"><div class="stat"><span>Active clients</span><strong>${data.activeClients}</strong></div><div class="stat"><span>Active projects</span><strong>${data.activeProjects}</strong></div><div class="stat"><span>Open requests</span><strong>${data.openRequests}</strong></div><div class="stat"><span>Next actions</span><strong>${data.nextActions}</strong></div></section>
  <div class="split"><section><div class="card-head" style="padding-left:0;border:0"><h2>Clients</h2><a href="/admin/clients">View all</a></div><div class="client-grid single-column">${clients}</div></section><section class="card"><div class="card-head"><h2>Incoming requests</h2></div><div class="card-body">${requests}</div></section></div>`;
  return htmlResponse(adminShell(env, { session, title: "Overview", active: "dashboard", body }));
}

export async function adminClients(env, session) {
  const { results } = await env.DB.prepare(
    `SELECT c.*, p.stage, p.progress FROM clients c
     LEFT JOIN projects p ON p.id = (SELECT id FROM projects WHERE client_id = c.id AND status = 'active' ORDER BY created_at DESC, id DESC LIMIT 1)
     ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'lead' THEN 1 ELSE 2 END, c.name COLLATE NOCASE`
  ).all();
  const cards = results.length ? results.map((client) => `<a class="card client-card" href="/admin/clients/${esc(client.id)}"><div class="client-title"><div class="avatar">${esc(initials(client.name))}</div><div class="client-name"><h2>${esc(client.name)}</h2><p>${esc(client.business || client.engagement)}</p></div>${badge(client.status)}</div><div class="client-meta"><div><span class="meta-label">Engagement</span><span class="meta-value">${esc(client.engagement)}</span></div><div><span class="meta-label">Current stage</span><span class="meta-value">${esc(client.stage || "No active project")}</span></div></div></a>`).join("") : `<div class="empty">No clients yet.</div>`;
  const body = `<div class="page-head"><div><p class="eyebrow">Relationships</p><h1>Clients</h1><p class="sub">Every relationship, project, agreement, update, and request in one view.</p></div><a class="button" href="/admin/clients/new">Add client</a></div><div class="client-grid">${cards}</div>`;
  return htmlResponse(adminShell(env, { session, title: "Clients", active: "clients", body }));
}

export function adminNewClient(env, session) {
  const body = `<div class="page-head"><div><p class="eyebrow">New relationship</p><h1>Add a client</h1><p class="sub">Start with the essentials. You can add project details and updates next.</p></div></div>
  <section class="card"><div class="card-body"><form method="post" action="/admin/clients"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><div class="form-grid">
    <div class="field"><label for="name">Contact name</label><input id="name" name="name" required maxlength="100" autocomplete="name"></div>
    <div class="field"><label for="business">Business</label><input id="business" name="business" maxlength="120" autocomplete="organization"></div>
    <div class="field"><label for="email">Portal email</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email"></div>
    <div class="field"><label for="engagement">Engagement</label><input id="engagement" name="engagement" value="Website project" maxlength="100"></div>
    <div class="field"><label for="rate">Contracted rate</label><input id="rate" name="rate" placeholder="$4,800 project" maxlength="100"></div>
    <div class="field"><label for="status">Relationship status</label><select id="status" name="status"><option value="active">Active client</option><option value="lead">Lead</option><option value="past">Past client</option></select></div>
    <div class="field full"><label for="next_action">Next action</label><input id="next_action" name="next_action" placeholder="Review homepage direction" maxlength="200"></div>
  </div><div class="form-actions"><button class="button" type="submit">Create client</button><a class="button secondary" href="/admin/clients">Cancel</a></div></form></div></section>`;
  return htmlResponse(adminShell(env, { session, title: "Add client", active: "clients", body }));
}

export async function handleAddClient(request, env, session) {
  const form = await readForm(request);
  if (!validateCsrf(request, form, session)) return new Response("Invalid form token", { status: 403 });
  try {
    const name = required(text(form, "name", 100), "Contact name");
    const email = required(text(form, "email", 254).toLowerCase(), "Portal email");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Portal email is invalid.");
    const business = text(form, "business", 120);
    const status = ["active", "lead", "past"].includes(text(form, "status")) ? text(form, "status") : "active";
    const id = crypto.randomUUID();
    const slug = `${slugify(business || name) || "client"}-${id.slice(0, 6)}`;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO clients (id, name, business, slug, relationship, engagement, contracted_rate, next_action, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, name, business || null, slug, status === "lead" ? "Lead" : status === "past" ? "Past client" : "Active client", text(form, "engagement", 100) || "Website project", text(form, "rate", 100) || null, text(form, "next_action", 200) || null, status),
      env.DB.prepare(`INSERT INTO users (id, client_id, email, name) VALUES (?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), id, email, name)
    ]);
    return redirect(`/admin/clients/${id}?created=1`);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return formErrorPage(env, session, error?.message || "The client could not be created.", "/admin/clients/new");
  }
}

async function getClient360(env, clientId) {
  const batch = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(clientId),
    env.DB.prepare(`SELECT * FROM users WHERE client_id = ? ORDER BY created_at`).bind(clientId),
    env.DB.prepare(`SELECT * FROM projects WHERE client_id = ? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at DESC`).bind(clientId),
    env.DB.prepare(`SELECT * FROM agreements WHERE client_id = ? ORDER BY created_at DESC`).bind(clientId),
    env.DB.prepare(`SELECT * FROM updates WHERE client_id = ? ORDER BY created_at DESC LIMIT 20`).bind(clientId),
    env.DB.prepare(`SELECT r.*, u.name AS user_name FROM requests r JOIN users u ON u.id = r.user_id AND u.client_id = r.client_id WHERE r.client_id = ? ORDER BY r.created_at DESC LIMIT 20`).bind(clientId)
  ]);
  return { client: batch[0].results[0], users: batch[1].results, projects: batch[2].results, agreements: batch[3].results, updates: batch[4].results, requests: batch[5].results };
}

export async function adminClient(env, session, clientId, url) {
  const data = await getClient360(env, clientId);
  if (!data.client) return new Response("Client not found", { status: 404 });
  const client = data.client;
  const activeProject = data.projects.find((project) => project.status === "active");
  const projectRows = data.projects.length ? data.projects.map((project) => `<div class="project-row"><div class="project-top"><div><h3>${esc(project.name)}</h3><p>${esc(project.type)} · ${esc(project.stage)} · Target ${formatDate(project.target_launch)}</p></div>${badge(project.status)}</div><div class="progress" aria-label="${esc(project.progress)} percent complete"><span style="width:${Number(project.progress) || 0}%"></span></div><p class="sub">${esc(project.current_focus || "No current focus noted.")}</p><details class="editor" style="margin:4px -20px -20px"><summary>Edit project</summary><div class="editor-body"><form method="post" action="/admin/projects/${esc(project.id)}"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><div class="form-grid"><div class="field"><label for="project-${esc(project.id)}-stage">Stage</label><input id="project-${esc(project.id)}-stage" name="stage" required maxlength="80" value="${esc(project.stage)}"></div><div class="field"><label for="project-${esc(project.id)}-status">Status</label><select id="project-${esc(project.id)}-status" name="status"><option value="active" ${project.status === "active" ? "selected" : ""}>Active</option><option value="paused" ${project.status === "paused" ? "selected" : ""}>Paused</option><option value="complete" ${project.status === "complete" ? "selected" : ""}>Complete</option></select></div><div class="field"><label for="project-${esc(project.id)}-progress">Progress</label><input id="project-${esc(project.id)}-progress" name="progress" type="number" min="0" max="100" value="${Number(project.progress) || 0}"></div><div class="field"><label for="project-${esc(project.id)}-target">Target launch</label><input id="project-${esc(project.id)}-target" name="target_launch" type="date" value="${esc(project.target_launch || "")}"></div><div class="field full"><label for="project-${esc(project.id)}-focus">Current focus</label><input id="project-${esc(project.id)}-focus" name="current_focus" maxlength="300" value="${esc(project.current_focus || "")}"></div></div><button class="button small" type="submit" style="margin-top:15px">Save project</button></form></div></details></div>`).join("<hr style=\"border:0;border-top:1px solid var(--line);margin:18px 0\">") : `<div class="empty">No projects yet.</div>`;
  const updates = data.updates.length ? data.updates.map((update) => `<div class="timeline-item"><p>${esc(update.body)}${update.link_url ? ` <a href="${esc(safeUrl(update.link_url))}" rel="noreferrer">${esc(update.link_label || "Open link")}</a>` : ""}</p><time>${formatDate(update.created_at)} · ${update.client_visible ? "Visible to client" : "Private"}</time></div>`).join("") : `<div class="empty">No updates yet.</div>`;
  const agreements = data.agreements.length ? data.agreements.map((agreement) => `<div class="request"><div><b>${esc(agreement.label)}</b><p>${esc([agreement.amount, agreement.cadence].filter(Boolean).join(" · "))}</p></div>${badge(agreement.status)}</div>`).join("") : `<div class="empty">No agreements yet.</div>`;
  const requests = data.requests.length ? data.requests.map((item) => `<div class="request"><div><b>${esc(item.user_name)} · ${esc(item.type)}</b><p>${esc(item.details)}</p><small>${formatDate(item.created_at)} · ${esc(item.urgency)}</small></div><form class="inline-form" method="post" action="/admin/requests/${esc(item.id)}/status"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><select name="status" aria-label="Request status"><option value="queued" ${item.status === "queued" ? "selected" : ""}>Queued</option><option value="in_progress" ${item.status === "in_progress" ? "selected" : ""}>In progress</option><option value="done" ${item.status === "done" ? "selected" : ""}>Done</option></select><button class="button small secondary" type="submit">Save</button></form></div>`).join("") : `<div class="empty">No requests yet.</div>`;
  const created = url.searchParams.get("created") ? `<div class="notice success">Client created. Add a project or post an update when you are ready.</div>` : "";
  const live = safeUrl(client.live_url);
  const body = `${created}<div class="page-head"><div><p class="eyebrow">Client 360</p><h1>${esc(client.name)}</h1><p class="sub">${esc(client.business || client.engagement)}</p></div><form method="post" action="/admin/view-as/${esc(client.id)}"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><button class="button ghost" type="submit">Open as client ↗</button></form></div>
  <section class="snapshot"><div class="snapshot-item"><span class="meta-label">Relationship</span><span class="meta-value">${esc(client.relationship)}</span></div><div class="snapshot-item"><span class="meta-label">Engagement</span><span class="meta-value">${esc(client.engagement)}</span></div><div class="snapshot-item"><span class="meta-label">Contracted rate</span><span class="meta-value">${esc(client.contracted_rate || "Not set")}</span></div><div class="snapshot-item attention"><span class="meta-label">Needs attention</span><span class="meta-value">${esc(client.next_action || "Nothing queued")}</span></div></section>
  <div class="split"><div class="stack">
    <section class="card"><div class="card-head"><h2>Current work</h2>${activeProject ? `<span class="badge in_progress">${Number(activeProject.progress)}% complete</span>` : ""}</div><div class="card-body">${projectRows}</div><details class="editor"><summary>+ Add a project</summary><div class="editor-body"><form method="post" action="/admin/clients/${esc(client.id)}/projects"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><div class="form-grid"><div class="field"><label for="new-project-name">Project name</label><input id="new-project-name" name="name" required maxlength="120" placeholder="Website redesign"></div><div class="field"><label for="new-project-stage">Stage</label><input id="new-project-stage" name="stage" required maxlength="80" value="Discovery"></div><div class="field"><label for="new-project-progress">Progress</label><input id="new-project-progress" name="progress" type="number" min="0" max="100" value="10"></div><div class="field"><label for="new-project-target">Target launch</label><input id="new-project-target" name="target_launch" type="date"></div><div class="field full"><label for="new-project-focus">Current focus</label><input id="new-project-focus" name="current_focus" maxlength="300"></div></div><button class="button small" type="submit" style="margin-top:15px">Add project</button></form></div></details></section>
    <section class="card"><div class="card-head"><h2>Updates</h2></div><div class="card-body"><div class="timeline">${updates}</div></div><details class="editor"><summary>+ Post an update</summary><div class="editor-body"><form method="post" action="/admin/clients/${esc(client.id)}/updates"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><div class="field"><label for="update-body">Update</label><textarea id="update-body" name="body" required maxlength="3000" placeholder="Share what changed and what happens next."></textarea></div><div class="form-grid" style="margin-top:12px"><div class="field"><label for="update-url">Link URL (optional)</label><input id="update-url" name="link_url" type="url"></div><div class="field"><label for="update-link-label">Link label</label><input id="update-link-label" name="link_label" maxlength="80"></div></div><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input style="width:auto" name="client_visible" type="checkbox" value="1" checked> Show in client portal</label><button class="button small" type="submit" style="margin-top:15px">Post update</button></form></div></details></section>
    <section class="card"><div class="card-head"><h2>Requests</h2></div><div class="card-body">${requests}</div></section>
  </div><aside class="stack">
    <section class="card"><div class="card-head"><h2>Details</h2></div><div class="card-body"><form method="post" action="/admin/clients/${esc(client.id)}/profile"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><div class="field"><label for="client-name">Contact name</label><input id="client-name" name="name" required maxlength="100" value="${esc(client.name)}"></div><div class="field" style="margin-top:12px"><label for="client-business">Business</label><input id="client-business" name="business" maxlength="120" value="${esc(client.business || "")}"></div><div class="field" style="margin-top:12px"><label for="client-engagement">Engagement</label><input id="client-engagement" name="engagement" maxlength="100" value="${esc(client.engagement || "")}"></div><div class="field" style="margin-top:12px"><label for="client-rate">Contracted rate</label><input id="client-rate" name="contracted_rate" maxlength="100" value="${esc(client.contracted_rate || "")}"></div><div class="field" style="margin-top:12px"><label for="client-next-action">Next action</label><input id="client-next-action" name="next_action" maxlength="200" value="${esc(client.next_action || "")}"></div><div class="field" style="margin-top:12px"><label for="client-url">Live website</label><input id="client-url" name="live_url" value="${esc(live)}" placeholder="https://example.com"></div><div class="field" style="margin-top:12px"><label for="client-care-plan">Care plan</label><input id="client-care-plan" name="care_plan" maxlength="120" value="${esc(client.care_plan || "")}" placeholder="$125/mo"></div><div class="field" style="margin-top:12px"><label for="client-status">Status</label><select id="client-status" name="status"><option value="active" ${client.status === "active" ? "selected" : ""}>Active</option><option value="lead" ${client.status === "lead" ? "selected" : ""}>Lead</option><option value="past" ${client.status === "past" ? "selected" : ""}>Past</option></select></div><button class="button small" type="submit" style="margin-top:15px">Save details</button></form></div></section>
    <section class="card"><div class="card-head"><h2>Money & agreements</h2></div><div class="card-body">${agreements}</div><details class="editor"><summary>+ Add agreement</summary><div class="editor-body"><form method="post" action="/admin/clients/${esc(client.id)}/agreements"><input type="hidden" name="csrf" value="${esc(session.csrf)}"><div class="field"><label for="agreement-label">Label</label><input id="agreement-label" name="label" required maxlength="120"></div><div class="form-grid" style="margin-top:12px"><div class="field"><label for="agreement-amount">Amount</label><input id="agreement-amount" name="amount" maxlength="80"></div><div class="field"><label for="agreement-cadence">Cadence</label><input id="agreement-cadence" name="cadence" maxlength="80"></div></div><button class="button small" type="submit" style="margin-top:15px">Add agreement</button></form></div></details></section>
    <section class="card"><div class="card-head"><h2>Portal contact</h2></div><div class="card-body">${data.users.map((user) => `<p><b>${esc(user.name)}</b><br><a href="mailto:${esc(user.email)}">${esc(user.email)}</a></p>`).join("")}</div></section>
  </aside></div>`;
  return htmlResponse(adminShell(env, { session, title: client.name, active: "clients", body }));
}

async function checkedAdminForm(request, session) {
  const form = await readForm(request);
  if (!validateCsrf(request, form, session)) throw new Error("Invalid form token");
  return form;
}

export async function handleProfile(request, env, session, clientId) {
  try {
    const form = await checkedAdminForm(request, session);
    const status = ["active", "lead", "past"].includes(text(form, "status")) ? text(form, "status") : "active";
    await env.DB.prepare(`UPDATE clients SET name = ?, business = ?, engagement = ?, contracted_rate = ?, next_action = ?, live_url = ?, care_plan = ?, status = ?, relationship = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(required(text(form, "name", 100), "Contact name"), text(form, "business", 120) || null, text(form, "engagement", 100) || "Website project", text(form, "contracted_rate", 100) || null, text(form, "next_action", 200) || null, normalizeUrl(text(form, "live_url", 500)), text(form, "care_plan", 120) || null, status, status === "lead" ? "Lead" : status === "past" ? "Past client" : "Active client", clientId).run();
    return redirect(`/admin/clients/${clientId}`);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return formErrorPage(env, session, error.message, `/admin/clients/${clientId}`);
  }
}

export async function handleAddProject(request, env, session, clientId) {
  try {
    const form = await checkedAdminForm(request, session);
    const progress = Math.max(0, Math.min(100, Number(text(form, "progress")) || 0));
    await env.DB.prepare(`INSERT INTO projects (id, client_id, name, stage, progress, current_focus, target_launch, started_on) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`)
      .bind(crypto.randomUUID(), clientId, required(text(form, "name", 120), "Project name"), required(text(form, "stage", 80), "Stage"), progress, text(form, "current_focus", 300) || null, text(form, "target_launch", 10) || null).run();
    return redirect(`/admin/clients/${clientId}`);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return formErrorPage(env, session, error.message, `/admin/clients/${clientId}`);
  }
}

export async function handleUpdateProject(request, env, session, projectId) {
  try {
    const form = await checkedAdminForm(request, session);
    const status = ["active", "paused", "complete"].includes(text(form, "status")) ? text(form, "status") : "active";
    const progress = Math.max(0, Math.min(100, Number(text(form, "progress")) || 0));
    const project = await env.DB.prepare(`SELECT client_id FROM projects WHERE id = ?`).bind(projectId).first();
    if (!project) return new Response("Project not found", { status: 404 });
    await env.DB.prepare(`UPDATE projects SET stage = ?, status = ?, progress = ?, current_focus = ?, target_launch = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(required(text(form, "stage", 80), "Stage"), status, progress, text(form, "current_focus", 300) || null, text(form, "target_launch", 10) || null, projectId).run();
    return redirect(`/admin/clients/${project.client_id}`);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return formErrorPage(env, session, error.message, "/admin/clients");
  }
}

export async function handleAddUpdate(request, env, session, clientId) {
  try {
    const form = await checkedAdminForm(request, session);
    await env.DB.prepare(`INSERT INTO updates (id, client_id, body, link_url, link_label, client_visible) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), clientId, required(text(form, "body", 3000), "Update"), normalizeUrl(text(form, "link_url", 500)), text(form, "link_label", 80) || null, form.get("client_visible") === "1" ? 1 : 0).run();
    return redirect(`/admin/clients/${clientId}`);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return formErrorPage(env, session, error.message, `/admin/clients/${clientId}`);
  }
}

export async function handleAddAgreement(request, env, session, clientId) {
  try {
    const form = await checkedAdminForm(request, session);
    await env.DB.prepare(`INSERT INTO agreements (id, client_id, label, amount, cadence, status) VALUES (?, ?, ?, ?, ?, 'active')`)
      .bind(crypto.randomUUID(), clientId, required(text(form, "label", 120), "Agreement label"), text(form, "amount", 80) || null, text(form, "cadence", 80) || null).run();
    return redirect(`/admin/clients/${clientId}`);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return formErrorPage(env, session, error.message, `/admin/clients/${clientId}`);
  }
}

export async function handleRequestStatus(request, env, session, requestId) {
  const form = await readForm(request);
  if (!validateCsrf(request, form, session)) return new Response("Invalid form token", { status: 403 });
  const status = text(form, "status");
  if (!["queued", "in_progress", "done"].includes(status)) return new Response("Invalid status", { status: 400 });
  const row = await env.DB.prepare(`SELECT client_id FROM requests WHERE id = ?`).bind(requestId).first();
  if (!row) return new Response("Request not found", { status: 404 });
  await env.DB.prepare(`UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, requestId).run();
  return redirect(`/admin/clients/${row.client_id}`);
}

export async function handleViewAs(request, env, clientId, session) {
  if (!validateCsrf(request, await readForm(request), session)) return new Response("Invalid form token", { status: 403 });
  const cookie = await createViewAsSession(request, env, clientId);
  if (!cookie) return new Response("Add a portal contact before opening the client view.", { status: 404 });
  return redirect("/portal", { "set-cookie": cookie });
}
