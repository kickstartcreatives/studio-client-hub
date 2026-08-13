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

export default {
  async fetch(request, env) {
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
    if (path === "/admin/logout") return handleAdminLogout(request);

    if (path === "/admin" || path.startsWith("/admin/")) {
      const admin = await getAdminSession(request, env);
      if (!admin) return redirect("/admin/login");
      if (method === "GET" && path === "/admin") return adminDashboard(env);
      if (method === "GET" && path === "/admin/clients") return adminClients(env);
      if (method === "GET" && path === "/admin/clients/new") return adminNewClient(env, admin);
      if (method === "POST" && path === "/admin/clients") return handleAddClient(request, env, admin);
      if (method === "GET" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)$/))) return adminClient(env, admin, match[1], url);
      if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/profile$/))) return handleProfile(request, env, admin, match[1]);
      if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/projects$/))) return handleAddProject(request, env, admin, match[1]);
      if (method === "POST" && (match = path.match(/^\/admin\/projects\/([a-zA-Z0-9-]+)$/))) return handleUpdateProject(request, env, admin, match[1]);
      if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/updates$/))) return handleAddUpdate(request, env, admin, match[1]);
      if (method === "POST" && (match = path.match(/^\/admin\/clients\/([a-zA-Z0-9-]+)\/agreements$/))) return handleAddAgreement(request, env, admin, match[1]);
      if (method === "POST" && (match = path.match(/^\/admin\/requests\/([a-zA-Z0-9-]+)\/status$/))) return handleRequestStatus(request, env, admin, match[1]);
      if (method === "GET" && (match = path.match(/^\/admin\/view-as\/([a-zA-Z0-9-]+)$/))) return handleViewAs(request, env, match[1]);
      return notFound();
    }

    if (path === "/portal/login") {
      if (method === "POST") return handlePortalLogin(request, env);
      return redirect("/portal");
    }
    if (method === "GET" && (match = path.match(/^\/portal\/auth\/(.+)$/))) {
      return handlePortalToken(request, env, decodeURIComponent(match[1]));
    }
    if (path === "/portal/logout") return handlePortalLogout(request, env);

    const client = await getClientSession(request, env);
    if (method === "GET" && path === "/portal") return client ? portalHome(env, client, url) : portalLoginPage(env);
    if (method === "POST" && path === "/portal/requests") return client ? handlePortalRequest(request, env, client) : redirect("/portal");

    return notFound();
  }
};
