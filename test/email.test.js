import assert from "node:assert/strict";
import test from "node:test";
import { magicLinkEmail, sendEmail } from "../src/email.js";

const env = { RESEND_API_KEY: "test-key", EMAIL_FROM: "Studio <portal@example.com>", SUPPORT_EMAIL: "hello@example.com" };
const message = { to: "maya@example.com", subject: "Sign in", text: "Test only", html: "<p>Test only</p>" };

test("email delivery handles success and provider failures without sending real email", async (t) => {
  let sent;
  const mocked = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent = JSON.parse(options.body);
    return Response.json({ id: "test-message" });
  });
  assert.deepEqual(await sendEmail(env, message), { ok: true, id: "test-message" });
  assert.deepEqual(sent.to, ["maya@example.com"]);
  assert.equal(sent.reply_to, "hello@example.com");
  assert.equal((await sendEmail({}, message)).ok, false);
  assert.equal(mocked.mock.callCount(), 1);
  mocked.mock.mockImplementation(async () => new Response("Unavailable", { status: 503 }));
  assert.deepEqual(await sendEmail(env, message), { ok: false, error: "HTTP 503" });
  mocked.mock.mockImplementation(async () => { throw new DOMException("Timeout", "TimeoutError"); });
  assert.deepEqual(await sendEmail(env, message), { ok: false, error: "Email request timed out" });
});

test("sign-in email escapes names and studio labels", () => {
  const mail = magicLinkEmail({ STUDIO_NAME: "<script>studio</script>" }, { name: "<img>" }, "https://studio.example/portal/auth/test");
  assert.doesNotMatch(mail.html, /<script>|<img>/);
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.text, /expires in 20 minutes/);
});
