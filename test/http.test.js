import assert from "node:assert/strict";
import test from "node:test";
import { readForm } from "../src/http.js";

test("chunked oversized forms are bounded without trusting Content-Length", async () => {
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode("details=" + "x".repeat(33000)));
    controller.close();
  } });
  const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, duplex: "half" });
  await assert.rejects(readForm(request), (error) => error.status === 413);
});
