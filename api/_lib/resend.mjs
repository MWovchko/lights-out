// Small Resend helper. No npm packages needed.
// Env vars (set in Vercel, never in this repo):
//   RESEND_API_KEY  the Resend API key (re_...)
//   EMAIL_FROM      optional, default "DarkDorms <me@darkdorms.com>"
//   EMAIL_REPLY_TO  optional, default "me@darkdorms.com"
export const FROM = process.env.EMAIL_FROM || "DarkDorms <me@darkdorms.com>";
export const REPLY_TO = process.env.EMAIL_REPLY_TO || "me@darkdorms.com";

export async function sendEmail({ to, cc, subject, html, text, idempotencyKey, tags }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  // Resend drops a repeat send with the same key for 24 hours (stops double emails on webhook retries).
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to, cc, subject, html, text, tags }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message || JSON.stringify(body)}`);
  return body; // { id }
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
