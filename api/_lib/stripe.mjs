import crypto from "node:crypto";

// Checks the Stripe-Signature header against STRIPE_WEBHOOK_SECRET (whsec_...).
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

// Read-only Stripe GET. Uses STRIPE_SECRET_KEY (a restricted, read-only key is enough).
export async function stripeGet(path, params = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(`${k}[]`, x));
    else if (v !== undefined) qs.append(k, v);
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${body.error?.message}`);
  return body;
}

// Pulls the order details out of a Checkout Session from the payment link.
export function orderFromSession(s) {
  const field = (k) => (s.custom_fields || []).find((f) => f.key === k)?.text?.value || "";
  const name = s.customer_details?.name || "";
  return {
    id: s.id,
    ref: (s.payment_intent && typeof s.payment_intent === "string" ? s.payment_intent : s.id).slice(-8).toUpperCase(),
    email: s.customer_details?.email || "",
    name,
    firstName: name.trim().split(/\s+/)[0] || "there",
    phone: s.customer_details?.phone || "",
    dorm: field("dorm"),
    room: field("room"),
    total: ((s.amount_total || 0) / 100).toFixed(2),
    tax: ((s.total_details?.amount_tax || 0) / 100).toFixed(2),
    paymentLink: s.payment_link || "",
    livemode: !!s.livemode,
  };
}
