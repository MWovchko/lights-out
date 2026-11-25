// "Inventory is in" email to every paid customer, via Resend.
// ONLY run after Maxwell says inventory has arrived.
//
// POST /api/send-inventory-email
//   Header: Authorization: Bearer <ADMIN_SECRET>
//   Body (JSON):
//     {"mode":"dry-run"}                 list who would get it, sends nothing (default)
//     {"mode":"test"}                    one sample copy to me@darkdorms.com only
//     {"mode":"send","confirm":"INVENTORY IS IN"}   sends to all customers, one email each
// Env vars: RESEND_API_KEY, STRIPE_SECRET_KEY (read-only restricted key is fine), ADMIN_SECRET,
//           optional INVENTORY_PAYMENT_LINKS (comma list of plink_ ids).
import crypto from "node:crypto";
import { sendEmail } from "./_lib/resend.mjs";
import { stripeGet, orderFromSession } from "./_lib/stripe.mjs";
import { inventoryArrived, BRAND } from "./_lib/emails.mjs";

const LINKS = (process.env.INVENTORY_PAYMENT_LINKS || "plink_1UbDI2LL2tMJP3LLtOTXjM1v,plink_1UbEOOLL2tMJP3LLZTDeAeT9").split(",").map((s) => s.trim());
const json = (status, body) => new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });

function authorized(request) {
  const secret = process.env.ADMIN_SECRET || "";
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (secret.length < 16 || got.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

async function paidCustomers() {
  const seen = new Map();
  for (const link of LINKS) {
    let starting_after;
    do {
      const page = await stripeGet("checkout/sessions", { payment_link: link, status: "complete", limit: 100, starting_after, "expand[]": "data.payment_intent.latest_charge" });
      for (const s of page.data) {
        if (s.payment_status !== "paid") continue;
        const charge = s.payment_intent?.latest_charge;
        if (charge?.refunded) continue; // fully refunded: skip
        const o = orderFromSession({ ...s, payment_intent: s.payment_intent?.id || s.payment_intent });
        const key = o.email.toLowerCase();
        if (key && !seen.has(key)) seen.set(key, o); // one email per person
      }
      starting_after = page.has_more ? page.data.at(-1).id : undefined;
    } while (starting_after);
  }
  return [...seen.values()];
}

export async function POST(request) {
  if (!authorized(request)) return json(401, { error: "unauthorized" });
  const body = await request.json().catch(() => ({}));
  const mode = body.mode || "dry-run";

  const tplRes = await fetch(new URL("/email/inventory-arrived.html", request.url));
  if (!tplRes.ok) return json(500, { error: "template not found" });
  const template = await tplRes.text();

  if (mode === "test") {
    const sample = { firstName: "Maxwell", dorm: "EMR 4-North", room: "219", ref: "TEST1234" };
    const e = inventoryArrived(template, sample);
    const r = await sendEmail({ to: [BRAND.contact], ...e, subject: `[TEST] ${e.subject}` });
    return json(200, { mode, sent_to: BRAND.contact, id: r.id });
  }

  const customers = await paidCustomers();
  if (mode === "dry-run") {
    return json(200, { mode, count: customers.length, customers: customers.map(({ name, email, dorm, room, ref }) => ({ name, email, dorm, room, ref })) });
  }

  if (mode !== "send" || body.confirm !== "INVENTORY IS IN") {
    return json(400, { error: 'To send for real use {"mode":"send","confirm":"INVENTORY IS IN"}' });
  }
  const sent = [], failed = [];
  for (const o of customers) {
    try {
      const e = inventoryArrived(template, o);
      const r = await sendEmail({ to: [o.email], ...e, idempotencyKey: `inventory/${o.email.toLowerCase()}`, tags: [{ name: "type", value: "inventory_arrived" }] });
      sent.push({ email: o.email, id: r.id });
    } catch (err) {
      failed.push({ email: o.email, error: err.message });
    }
    await new Promise((r) => setTimeout(r, 600)); // Resend free plan: 2 emails per second
  }
  return json(200, { mode, sent: sent.length, failed, at: new Date().toISOString() });
}
