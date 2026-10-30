import { HttpError } from "./http.js";
import { getAdminSession, getClientSession, missingConfiguration } from "./auth.js";
import {
  adminClient,
  adminClients,
  adminDashboard,
  adminLoginPage,
  adminNewClient,
  handleAddAgreement,
  handleAddClient,
  handleAddProject,
  handleAddUpdate,
  handleAdminLogin,
  handleAdminLogout,
  handleProfile,
  handleRequestStatus,
  handleUpdateProject,
  handleViewAs
} from "./admin.js";
import {
  handlePortalLogin,
  handlePortalLogout,
  handlePortalRequest,
  handlePortalToken,
  portalHome,
  portalLoginPage
} from "./portal.js";
import { redirect } from "./ui.js";

function setupResponse(missing) {
  return new Response(`Setup incomplete. Configure: ${missing.join(", ")}`, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

async function route(request, env) {
  const missing = missingConfiguration(env);
  if (missing.length) return setupResponse(missing);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();
  let match;

  if (path === "/") return redirect("/portal");

  if (path === "/admin/login") {
    if (method === "GET") return (await getAdminSession(request, env)) ? redirect("/admin") : adminLoginPage(env);
    if (method === "POST") return handleAdminLogin(request, env);
    return new Response("Method not allowed", { status: 405 });
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    const admin = await getAdminSession(request, env);
    if (!admin) return redirect("/admin/login");
    if (path === "/admin/logout") return method === "POST" ? handleAdminLogout(request, admin) : new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    if (method === "GET" && path === "/admin") return adminDashboard(env, admin);
    if (method === "GET" && path === "/admin/clients") return adminClients(env, admin);
    if (method === "GET" && path === "/admin/clients/new") return adminNewClient(env, admin);
    if (method === "POST" && path === "/admin/clients") return handleAddClient(request, env, admin);
    if (method === "GET" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)$/))) return adminClient(env, admin, match[1], url);
    if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/profile$/))) return handleProfile(request, env, admin, match[1]);
    if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/projects$/))) return handleAddProject(request, env, admin, match[1]);
    if (method === "POST" && (match = path.match(/^\/admin\/projects\/([a-zA-Z0-9-]+)$/))) return handleUpdateProject(request, env, admin, match[1]);
    if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/updates$/))) return handleAddUpdate(request, env, admin, match[1]);
    if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/agreements$/))) return handleAddAgreement(request, env, admin, match[1]);
    if (method === "POST" && (match = path.match(/^\/admin\/requests\/([a-zA-Z0-9-]+)\/status$/))) return handleRequestStatus(request, env, admin, match[1]);
    if ((match = path.match(/^\/admin\/view-as\/([a-zA-Z0-9-]+)$/))) return method === "POST" ? handleViewAs(request, env, match[1], admin) : new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    return notFound();
  }

  if (path === "/portal/login") {
    if (method === "POST") return handlePortalLogin(request, env);
    return redirect("/portal");
  }
  if (method === "GET" && (match = path.match(/^\/portal\/auth\/(.+)$/))) {
    // Generated tokens are unpadded base64url. Do not decode arbitrary URL input.
    if (!/^[A-Za-z0-9_-]{43}$/.test(match[1])) return portalLoginPage(env, { badLink: true });
    return handlePortalToken(request, env, match[1]);
  }

  const client = await getClientSession(request, env);
  if (path === "/portal/logout") {
    if (method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    return client ? handlePortalLogout(request, env, client) : redirect("/portal");
  }
  if (method === "GET" && path === "/portal") return client ? portalHome(env, client, url) : portalLoginPage(env);
  if (method === "POST" && path === "/portal/requests") return client ? handlePortalRequest(request, env, client) : redirect("/portal");

  return notFound();
}

export default {
  async fetch(request, env) {
    let response;
    try {
      response = await route(request, env);
    } catch (error) {
      if (error instanceof HttpError) response = new Response(error.message, { status: error.status });
      else {
        // Do not log request URLs, form bodies, cookies, or provider errors containing client data.
        console.error("Request failed", error?.name || "Error");
        response = new Response("Something went wrong. Please try again.", { status: 500 });
      }
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "strict-origin");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    return response;
  }
};
