import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { missingConfiguration } from "../src/auth.js";

test("setup generates usable unique secrets and never overwrites existing credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-setup-"));
  try {
    const script = resolve("scripts/setup.mjs");
    execFileSync(process.execPath, [script], { cwd: directory });
    const first = await readFile(join(directory, ".dev.vars"), "utf8");
    const env = Object.fromEntries(first.trim().split("\n").map((line) => line.split("=")));
    assert.deepEqual(missingConfiguration(env), []);
    assert.equal(new Set([env.ADMIN_PASSWORD, env.SESSION_SECRET, env.MAGIC_LINK_SECRET]).size, 3);
    if (process.platform !== "win32") assert.equal((await stat(join(directory, ".dev.vars"))).mode & 0o777, 0o600);
    execFileSync(process.execPath, [script], { cwd: directory });
    assert.equal(await readFile(join(directory, ".dev.vars"), "utf8"), first);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("published placeholders, short and reused signing secrets fail closed", async () => {
  const example = await readFile(".dev.vars.example", "utf8");
  const env = Object.fromEntries(example.split("\n").filter((line) => line && !line.startsWith("#")).map((line) => line.split("=")));
  assert.equal(missingConfiguration(env).length, 3);
  assert.ok(missingConfiguration({ ADMIN_PASSWORD: "long-password", SESSION_SECRET: "short", MAGIC_LINK_SECRET: "short" }).includes("SESSION_SECRET"));
  const same = "x".repeat(40);
  assert.ok(missingConfiguration({ ADMIN_PASSWORD: "long-password", SESSION_SECRET: same, MAGIC_LINK_SECRET: same }).includes("distinct signing secrets"));
});
