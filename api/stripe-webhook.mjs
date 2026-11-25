// Stripe webhook -> Resend emails.
// Stripe event: checkout.session.completed (the Payment Link checkout).
// Sends: (1) confirmation to the customer, (2) new-order notice to me@darkdorms.com, cc Melvin.
// Env vars: RESEND_API_KEY, STRIPE_WEBHOOK_SECRET, optional ORDER_NOTIFY_TO, ORDER_NOTIFY_CC.
import { sendEmail } from "./_lib/resend.mjs";
import { verifyStripeSignature, orderFromSession } from "./_lib/stripe.mjs";
import { orderConfirmation, ownerNotice } from "./_lib/emails.mjs";

const NOTIFY_TO = (process.env.ORDER_NOTIFY_TO || "me@darkdorms.com").split(",").map((s) => s.trim()).filter(Boolean);
const NOTIFY_CC = (process.env.ORDER_NOTIFY_CC || "agent-agent@inkboxmail.com").split(",").map((s) => s.trim()).filter(Boolean);

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) {
    return json(400, { error: "bad signature" });
  }
  const event = JSON.parse(raw);
  const s = event.data?.object;

  // Only paid checkouts. (Delayed card payments come later as checkout.session.async_payment_succeeded.)
  const paidNow = event.type === "checkout.session.completed" && s?.payment_status === "paid";
  const paidLater = event.type === "checkout.session.async_payment_succeeded";
  if (!paidNow && !paidLater) return json(200, { ignored: event.type });

  const o = orderFromSession(s);
  const results = {};
  try {
    if (o.email) {
      const c = orderConfirmation(o);
      results.customer = await sendEmail({ to: [o.email], ...c, idempotencyKey: `confirm/${o.id}`, tags: [{ name: "type", value: "order_confirmation" }] });
    }
    const n = ownerNotice(o);
    results.owner = await sendEmail({ to: NOTIFY_TO, cc: NOTIFY_CC, ...n, idempotencyKey: `notice/${o.id}`, tags: [{ name: "type", value: "order_notice" }] });
  } catch (err) {
    console.error("email send failed", o.id, err.message);
    return json(500, { error: err.message }); // Stripe retries; the idempotency keys stop doubles.
  }
  return json(200, { ok: true, results });
}

export function GET() {
  return json(405, { error: "POST only" });
}
