// Build-time renderer only. The deployed demo contains static files, not this Worker.
import { adminClient, adminClients, adminDashboard, adminNewClient } from "../src/admin.js";
import { portalHome } from "../src/portal.js";
import { document, htmlResponse } from "../src/ui.js";
import { demoClients, demoPages } from "./pages.js";

const repository = "https://github.com/kickstartcreatives/studio-client-hub";
const demoStyle = `
  .demo-bar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px 24px; padding:16px clamp(20px,4vw,40px); background:#faf3e5; border-bottom:1px solid #e6d8bb; color:#463f31; }
  .demo-bar strong { display:block; font-size:14px; }
  .demo-bar p { margin:3px 0 0; font-size:12px; }
  .demo-links { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
  .demo-links a { padding:8px 12px; border-radius:8px; font-size:12px; font-weight:750; text-decoration:none; }
  .demo-links a[aria-current] { color:white; background:var(--accent); }
  .demo-links a:hover { text-decoration:underline; }
  .demo-fields { border:0; padding:0; margin:0; min-width:0; }
  .demo-fields :disabled { cursor:not-allowed; }
  .demo-fields button { opacity:.55; }
  .demo-placeholder { color:var(--muted); font-size:12px; }
  @media(max-width:600px) { .demo-bar { gap:10px; } .demo-links { gap:2px; } .demo-links a { padding:8px 10px; } }
`;

function decorate(response, path, clientId) {
  const isPortal = path.startsWith("/portal");
  const studioPath = isPortal ? `/admin/clients/${clientId}` : "/admin";
  const portalPath = `/portal/${clientId}`;
  const banner = `<aside class="demo-bar" aria-label="About this demo">
    <div><strong>Studio Client Hub · Public demo</strong><p id="demo-note">Fictional clients. Browse both views. Saving and sending are turned off.</p></div>
    <nav class="demo-links" aria-label="Demo views"><a href="${studioPath}"${!isPortal ? ' aria-current="true"' : ""}>Studio view</a><a href="${portalPath}"${isPortal ? ' aria-current="true"' : ""}>Client view</a><a href="${repository}">Get the template ↗</a></nav>
  </aside>`;

  return new HTMLRewriter()
    .on("head", { element(el) { el.append(`<meta name="robots" content="noindex, nofollow"><style>${demoStyle}</style>`, { html: true }); } })
    .on("title", { element(el) { el.prepend("Demo · "); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute("content", "Explore the studio dashboard and client portal with fictional sample projects. Free, open-source template for web designers."); } })
    .on("body", { element(el) { el.prepend(banner, { html: true }); } })
    .on("form", { element(el) {
      const action = el.getAttribute("action") || "";
      if (action.endsWith("/logout")) { el.remove(); return; }
      if (action.startsWith("/admin/view-as/")) {
        const id = action.slice("/admin/view-as/".length);
        if (!demoClients.includes(id)) throw new Error("Unknown demo client");
        el.replace(`<a class="button ghost" href="/portal/${id}">Open as client ↗</a>`, { html: true });
        return;
      }
      el.tagName = "fieldset";
      el.removeAttribute("method");
      el.removeAttribute("action");
      el.setAttribute("disabled", "");
      el.setAttribute("aria-describedby", "demo-note");
      el.setAttribute("class", `${el.getAttribute("class") || ""} demo-fields`.trim());
    } })
    .on('input[type="hidden"]', { element(el) { el.remove(); } })
    .on("a", { element(el) {
      const href = el.getAttribute("href") || "";
      if (href === "/portal") { el.setAttribute("href", portalPath); el.removeAttribute("target"); }
      if (href.startsWith("mailto:")) { el.tagName = "span"; el.removeAttribute("href"); }
      if (href === "https://example.com" || href === "https://example.com/") {
        el.replace('<span class="demo-placeholder">Example website</span>', { html: true });
      }
    } })
    .on("#request .sub", { element(el) { el.setInnerContent("Clients can send requests in the full app. Sending is turned off in this demo."); } })
    .transform(response);
}

export default {
  async fetch(request, bindings) {
    if (request.method !== "GET") return new Response("Read-only demo", { status: 405 });
    const url = new URL(request.url);
    const path = url.pathname;
    if (!demoPages.includes(path)) return new Response("Not found", { status: 404 });
    // Deliberately ignore credentials, cookies, query strings and any supplied studio variables.
    const env = { DB: bindings.DB, STUDIO_NAME: "Northstar Studio" };
    const clientId = demoClients.find((id) => path.endsWith(`/${id}`)) || demoClients[0];
    const session = { csrf: "" };
    let response;
    if (path === "/" || path === "/admin") response = await adminDashboard(env, session);
    else if (path === "/admin/clients") response = await adminClients(env, session);
    else if (path === "/admin/clients/new") response = adminNewClient(env, session);
    else if (path.startsWith("/admin/clients/")) response = await adminClient(env, session, clientId, new URL(request.url.split("?")[0]));
    else if (path.startsWith("/portal")) {
      const client = await env.DB.prepare(`SELECT c.*, c.name AS client_name, u.name AS user_name, u.id AS user_id, c.id AS client_id FROM clients c JOIN users u ON u.client_id = c.id WHERE c.id = ?`).bind(clientId).first();
      if (!client) throw new Error(`Missing fictional client: ${clientId}`);
      response = await portalHome(env, { ...client, csrf: "" }, new URL("https://demo.invalid/portal"));
    } else {
      response = htmlResponse(document({ title: "Page not found", env, body: '<main class="content" id="main"><h1>That page is not in the demo.</h1><p>You can explore the studio dashboard and three fictional client projects.</p><a class="button" href="/admin">Open the dashboard</a></main>' }), 404);
    }
    return decorate(response, path, clientId);
  }
};
