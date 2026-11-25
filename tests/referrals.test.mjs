// Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, GET } from "../api/referrals.mjs";

const DAY = 864e5, now = Date.parse("2026-12-20T12:00:00Z");
const sess = (id, ref, qty, daysAgo, charge = {}) => ({
  id, status: "complete", payment_status: "paid", client_reference_id: ref, created: Math.floor((now - daysAgo * DAY) / 1000),
  amount_total: 1099 * qty, customer_details: { name: "Pat Lee" }, line_items: { data: [{ quantity: qty }] },
  payment_intent: { latest_charge: { amount: 1099 * qty, amount_refunded: 0, refunded: false, ...charge } },
});

test("counts strips, pending, refunds and payouts", () => {
  const r = buildReport([
    sess("a", "ref_jake", 2, 10),
    sess("b", "ref_jake", 1, 2),                                   // pending
    sess("c", "ref_jake", 1, 20, { refunded: true, amount_refunded: 1099 }),
    sess("d", "ref_sam", 3, 9),                                    // unlisted code still counts
    sess("e", null, 5, 9),                                         // no referral: ignored
    sess("f", "something_else", 5, 9),                             // not a ref_ id: ignored
  ], [{ code: "jake", name: "Jake", payouts: [{ amount: 2 }] }, { code: "amy", name: "Amy" }], now);
  const jake = r.referrers.find((x) => x.code === "jake");
  assert.equal(jake.strips, 2); assert.equal(jake.pendingStrips, 1); assert.equal(jake.refundedStrips, 1);
  assert.equal(jake.earned, 4); assert.equal(jake.pending, 2); assert.equal(jake.paid, 2); assert.equal(jake.owed, 2);
  const sam = r.referrers.find((x) => x.code === "sam");
  assert.equal(sam.listed, false); assert.equal(sam.owed, 6);
  assert.equal(r.referrers.find((x) => x.code === "amy").strips, 0);
  assert.deepEqual(r.totals, { strips: 5, pendingStrips: 1, earned: 10, pending: 2, paid: 2, owed: 8 });
});

test("partial refund still earns, full refund by amount does not", () => {
  const r = buildReport([sess("a", "ref_x", 1, 10, { amount_refunded: 549 }), sess("b", "ref_x", 1, 10, { amount_refunded: 1099 })], [], now);
  const x = r.referrers[0];
  assert.equal(x.strips, 1); assert.equal(x.refundedStrips, 1);
  assert.equal(x.sales.find((s) => s.session === "a").status, "partly refunded");
});

test("GET rejects a wrong password and never calls Stripe", async () => {
  process.env.ADMIN_SECRET = "a-long-admin-secret-123";
  let called = false; const f = globalThis.fetch; globalThis.fetch = async () => { called = true; };
  const res = await GET(new Request("https://x/api/referrals", { headers: { Authorization: "Bearer nope" } }));
  globalThis.fetch = f;
  assert.equal(res.status, 401); assert.equal(called, false);
});

test("GET reads Stripe sessions and refund status", async () => {
  process.env.ADMIN_SECRET = "a-long-admin-secret-123"; process.env.STRIPE_SECRET_KEY = "rk_test_x";
  const s = sess("cs_1", "ref_jake", 2, 30); s.payment_intent = "pi_1"; s.created = Math.floor(Date.now() / 1000) - 30 * 86400;
  const urls = []; const f = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const body = String(url).includes("payment_intents") ? { id: "pi_1", latest_charge: { amount: 2198, amount_refunded: 0, refunded: false } } : { data: [s, sess("cs_2", null, 1, 3)], has_more: false };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const res = await GET(new Request("https://x/api/referrals", { headers: { Authorization: "Bearer a-long-admin-secret-123" } }));
  globalThis.fetch = f;
  const body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.totals.owed, 4);
  assert.equal(urls.length, 2); assert.ok(urls[0].includes("status=complete")); assert.ok(urls[1].includes("pi_1"));
});
