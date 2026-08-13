import assert from "node:assert/strict";
import test from "node:test";
import { createSignedPayload, secretsMatch, verifySignedPayload } from "../src/security.js";

test("signed payloads verify and reject tampering", async () => {
  const secret = "long-test-secret";
  const signed = await createSignedPayload(secret, { exp: 123, csrf: "abc" });
  assert.deepEqual(await verifySignedPayload(secret, signed), { exp: 123, csrf: "abc" });
  assert.equal(await verifySignedPayload(secret, `${signed}tampered`), null);
  assert.equal(await verifySignedPayload("another-secret", signed), null);
});

test("secret comparison handles matches and mismatches", async () => {
  assert.equal(await secretsMatch("same value", "same value"), true);
  assert.equal(await secretsMatch("same value", "different value"), false);
  assert.equal(await secretsMatch("short", "a much longer value"), false);
});
