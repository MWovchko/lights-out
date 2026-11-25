// Referral tracker data: strips sold per referral code and $ owed.
// GET /api/referrals   Header: Authorization: Bearer <ADMIN_SECRET>
// Reads paid Stripe Checkout Sessions whose client_reference_id is "ref_<code>"
// (site.js adds it to the Payment Link when a visitor came through /r/<code>).
// Env vars: STRIPE_SECRET_KEY (restricted read-only key is enough: Checkout Sessions read,
//           Payment Intents read, Charges read), ADMIN_SECRET (16+ characters).
// Read-only: never changes anything in Stripe.
import crypto from "node:crypto";
import { REFERRERS, PAYOUT_PER_STRIP, HOLD_DAYS } from "./_lib/referrers.mjs";

const json = (status, body) => new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function authorized(request) {
  const secret = process.env.ADMIN_SECRET || "";
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (secret.length < 16 || got.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

async function stripeList(path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const out = [];
  let starting_after;
  for (let i = 0; i < 50; i++) { // up to 5,000 sessions
    const qs = new URLSearchParams(params);
    if (starting_after) qs.set("starting_after", starting_after);
    const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${body.error?.message}`);
    out.push(...body.data);
    if (!body.has_more || !body.data.length) break;
    starting_after = body.data[body.data.length - 1].id;
  }
  return out;
}

const money = (n) => Math.round(n * 100) / 100;

// Turns Stripe sessions into the tracker report. Exported for tests.
export function buildReport(sessions, referrers = REFERRERS, now = Date.now()) {
  const reps = new Map();
  const rep = (code) => {
    if (!reps.has(code)) {
      const r = referrers.find((x) => x.code === code);
      const paid = money((r?.payouts || []).reduce((a, p) => a + Number(p.amount || 0), 0));
      reps.set(code, { code, name: r?.name || "", listed: !!r, strips: 0, pendingStrips: 0, refundedStrips: 0, orders: 0, earned: 0, pending: 0, paid, owed: 0, sales: [] });
    }
    return reps.get(code);
  };
  referrers.forEach((r) => rep(r.code));

  for (const s of sessions) {
    const m = /^ref_([a-z0-9_-]{1,40})$/.exec(s.client_reference_id || "");
    if (!m || s.status !== "complete" || s.payment_status !== "paid") continue;
    const r = rep(m[1]);
    const qty = (s.line_items?.data || []).reduce((a, li) => a + (li.quantity || 0), 0) || 1;
    const charge = s.payment_intent?.latest_charge;
    const amount = charge?.amount || s.amount_total || 0;
    const refundedAmt = charge?.amount_refunded || 0;
    const refunded = !!charge?.refunded || (amount > 0 && refundedAmt >= amount);
    const partial = !refunded && refundedAmt > 0;
    const ageDays = (now - s.created * 1000) / 864e5;
    const pending = !refunded && ageDays < HOLD_DAYS;
    const sale = {
      date: new Date(s.created * 1000).toISOString().slice(0, 10),
      session: s.id,
      customer: (s.customer_details?.name || "").split(/\s+/)[0] || "",
      strips: qty,
      total: money((s.amount_total || 0) / 100),
      status: refunded ? "refunded" : partial ? "partly refunded" : pending ? "pending" : "payable",
      commission: refunded ? 0 : qty * PAYOUT_PER_STRIP,
    };
    r.sales.push(sale);
    r.orders += 1;
    if (refunded) { r.refundedStrips += qty; continue; }
    if (pending) { r.pendingStrips += qty; r.pending += sale.commission; }
    else { r.strips += qty; r.earned += sale.commission; }
  }

  const list = [...reps.values()].map((r) => ({ ...r, earned: money(r.earned), pending: money(r.pending), owed: money(Math.max(0, r.earned - r.paid)), sales: r.sales.sort((a, b) => (a.date < b.date ? 1 : -1)) }));
  list.sort((a, b) => b.strips + b.pendingStrips - (a.strips + a.pendingStrips) || a.code.localeCompare(b.code));
  const sum = (k) => money(list.reduce((a, r) => a + r[k], 0));
  return {
    generated: new Date(now).toISOString(),
    payoutPerStrip: PAYOUT_PER_STRIP,
    holdDays: HOLD_DAYS,
    totals: { strips: sum("strips"), pendingStrips: sum("pendingStrips"), earned: sum("earned"), pending: sum("pending"), paid: sum("paid"), owed: sum("owed") },
    referrers: list,
  };
}

export async function GET(request) {
  if (!authorized(request)) return json(401, { error: "Wrong or missing admin password" });
  try {
    const sessions = await stripeList("checkout/sessions", {
      status: "complete",
      limit: "100",
      "expand[]": "data.line_items",
    });
    const refSessions = sessions.filter((s) => /^ref_/.test(s.client_reference_id || ""));
    // Refund status lives on the charge; fetch it only for referral sessions.
    for (const s of refSessions) {
      if (typeof s.payment_intent === "string") {
        const res = await fetch(`https://api.stripe.com/v1/payment_intents/${s.payment_intent}?expand[]=latest_charge`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
        if (res.ok) s.payment_intent = await res.json();
      }
    }
    return json(200, buildReport(refSessions));
  } catch (err) {
    console.error("referrals report failed", err.message);
    return json(500, { error: err.message });
  }
}
