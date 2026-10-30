import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { demoPages } from "../demo/pages.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, ".demo-dist");
const sourceFiles = (await readdir(join(root, "src"))).filter((name) => name.endsWith(".js"));
// No persistence directory, Wrangler credentials, remote bindings or local .dev.vars.
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: ["demo/render.js", "demo/pages.js", ...sourceFiles.map((name) => `src/${name}`)]
    .map((path) => ({ type: "ESModule", path: join(root, path) })),
  modulesRoot: root,
  compatibilityDate: "2026-07-01",
  d1Databases: { DB: "fictional-demo-build" },
  outboundService: () => new Response("Network disabled during demo builds", { status: 403 })
}));

try {
  const db = await mf.getD1Database("DB");
  const migrations = (await readdir(join(root, "migrations"))).filter((name) => name.endsWith(".sql")).sort();
  for (const file of [...migrations.map((name) => `migrations/${name}`), "seed.sql", "demo/seed.sql"]) {
    // These checked-in fixtures contain no semicolons inside string literals.
    const sql = (await readFile(join(root, file), "utf8")).replace(/--.*$/gm, "");
    for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const path of demoPages) {
    const response = await mf.dispatchFetch(`https://demo.invalid${path}`);
    if (response.status !== (path === "/404" ? 404 : 200)) throw new Error(`Cannot render ${path}: ${response.status}`);
    const file = join(output, path === "/" ? "index.html" : `${path.slice(1)}.html`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await response.text());
  }
  await cp(join(root, "public/favicon.svg"), join(output, "favicon.svg"));
  await cp(join(root, "demo/_headers"), join(output, "_headers"));
  await writeFile(join(output, "robots.txt"), "User-agent: *\nDisallow: /\n");
  console.log(`Built ${demoPages.length} static demo pages in .demo-dist. No live database or credentials used.`);
} catch (error) {
  await rm(output, { recursive: true, force: true });
  throw error;
} finally {
  await mf.dispose();
}
