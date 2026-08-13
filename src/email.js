import { esc } from "./ui.js";

export async function sendEmail(env, { to, subject, text, html }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY is not configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        reply_to: env.SUPPORT_EMAIL || undefined,
        subject,
        text,
        html
      }),
      signal: AbortSignal.timeout(15_000)
    });
    const result = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, id: result.id } : { ok: false, error: result.message || `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, error: error?.name === "TimeoutError" ? "Email request timed out" : "Could not reach email provider" };
  }
}

export function magicLinkEmail(env, user, url) {
  const studio = env.STUDIO_NAME || "Your Studio";
  const first = String(user.name || "there").trim().split(/\s+/)[0];
  const subject = `Your sign-in link for ${studio}`;
  const text = `Hi ${first},\n\nUse this secure link to open your client portal:\n${url}\n\nIt works once and expires in 20 minutes. If you did not request it, you can ignore this email.`;
  const html = `<div style="background:#f5f7f6;padding:28px 16px;font-family:Inter,Arial,sans-serif;color:#1f2937"><div style="max-width:520px;margin:auto;background:white;border:1px solid #dce4e0;border-radius:14px;padding:30px"><p style="margin:0;color:#3f6b5b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${esc(studio)}</p><h1 style="font-size:24px;margin:12px 0">Your sign-in link</h1><p style="color:#465364;line-height:1.6">Hi ${esc(first)}, use the button below to open your portal. This link works once and expires in 20 minutes.</p><p style="margin:24px 0"><a href="${esc(url)}" style="display:inline-block;background:#3f6b5b;color:white;text-decoration:none;border-radius:9px;padding:12px 18px;font-weight:700">Open my portal →</a></p><p style="color:#6b7280;font-size:13px">If you did not request this, you can ignore the email.</p></div></div>`;
  return { subject, text, html };
}
