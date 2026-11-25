import { esc } from "./resend.mjs";

// ---- Brand settings for this site. Change the wording here. ----
export const BRAND = {
  name: "DarkDorms",
  site: "https://darkdorms.com",
  contact: "me@darkdorms.com",
  promise: "Hallway noise stops at your door.",
};

const wrap = (inner, preheader) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"></head>
<body style="margin:0;padding:0;background:#07081a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07081a;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#e6e8ff;">
<tr><td style="padding:8px 24px 20px;font:800 22px Arial,Helvetica,sans-serif;color:#e6e8ff;"><span style="color:#ffd23f;">&#9679;</span> ${esc(BRAND.name)}</td></tr>
${inner}
<tr><td style="padding:28px 24px 8px;border-top:1px solid #23264d;font:400 13px/1.5 Arial,Helvetica,sans-serif;color:#6f74a8;">Questions: <a href="mailto:${BRAND.contact}" style="color:#9ea3d4;">${BRAND.contact}</a> &middot; <a href="${BRAND.site}" style="color:#9ea3d4;">${BRAND.site.replace("https://", "")}</a></td></tr>
</table></td></tr></table></body></html>`;

const step = (title, body) => `<tr><td style="padding:12px 14px;background:#10122b;border:1px solid #23264d;border-radius:12px;font:400 16px/1.5 Arial,Helvetica,sans-serif;color:#9ea3d4;"><b style="color:#ffd23f;">${title}</b> ${body}</td></tr><tr><td height="10" style="font-size:0;line-height:0;">&nbsp;</td></tr>`;

// 1) To the customer, right after Stripe says the payment went through.
export function orderConfirmation(o) {
  const where = o.dorm || o.room ? `${esc(o.dorm)}${o.room ? `, room ${esc(o.room)}` : ""}` : "your room";
  const subject = `You're in. Your ${BRAND.name} preorder is confirmed`;
  const html = wrap(`
<tr><td style="padding:0 24px;">
<h1 style="margin:0 0 14px;font:800 30px/1.1 Arial,Helvetica,sans-serif;color:#e6e8ff;">You're in, ${esc(o.firstName)}.</h1>
<p style="margin:0 0 22px;font:400 17px/1.55 Arial,Helvetica,sans-serif;color:#9ea3d4;">Your ${BRAND.name} preorder is confirmed. ${BRAND.promise} Stripe sent your receipt separately.</p>
</td></tr>
<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${step("1. We get the inventory.", "We'll email you the moment it arrives.")}
${step("2. Watch for our text.", `Within 24 hours after inventory is received, we text you a few hours before we come by ${where}.`)}
${step("3. Leave your door open.", "A student comes by and installs your strip. Then close your door and enjoy the quiet.")}
</table></td></tr>
<tr><td style="padding:12px 24px 0;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#9ea3d4;">
<b style="color:#e6e8ff;">Order ${esc(o.ref)}</b><br>Total paid: $${esc(o.total)}${Number(o.tax) > 0 ? ` (includes $${esc(o.tax)} tax)` : ""}<br>Delivery to: ${where}<br><br>
Wrong room, or need a different time? Just reply to this email.<br><br>This is a preorder. Refund policy: 50% refund.</td></tr>
<tr><td style="padding:16px 24px 0;font:400 16px/1.55 Arial,Helvetica,sans-serif;color:#e6e8ff;">Thanks for ordering,<br><b>The ${BRAND.name} team</b><br><span style="color:#9ea3d4;">For students, by a student.</span></td></tr>`,
    "Your preorder is confirmed. Here's what happens next.");
  const text = `You're in, ${o.firstName}. Your ${BRAND.name} preorder is confirmed (order ${o.ref}, $${o.total}).
1. We'll email you the moment inventory arrives.
2. Within 24 hours after that, we text you a few hours before we come by ${o.dorm} ${o.room}.
3. Leave your door open and a student installs your strip.
Wrong room or need a different time? Reply to this email. This is a preorder. Refund policy: 50% refund.
${BRAND.contact} | ${BRAND.site}`;
  return { subject, html, text };
}

// 2) To Maxwell (me@darkdorms.com) and Melvin: a new paid order.
export function ownerNotice(o) {
  const rows = [["Name", o.name], ["Email", o.email], ["Phone", o.phone], ["Hall", o.dorm], ["Room", o.room], ["Total", `$${o.total}`], ["Tax", `$${o.tax}`], ["Order ref", o.ref], ["Stripe session", o.id], ["Live mode", o.livemode ? "yes" : "TEST"]];
  const subject = `New ${BRAND.name} order: ${o.name || o.email} (${o.dorm} ${o.room})`.trim();
  const html = `<div style="font:15px/1.5 Arial,sans-serif"><h2 style="margin:0 0 10px">New paid order</h2><table cellpadding="4">${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join("")}</table></div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  return { subject, html, text };
}

// 3) "Inventory is in" email. Template file: /email/inventory-arrived.html on this site.
export function inventoryArrived(template, o) {
  let html = template;
  if (!o.dorm || !o.room) {
    html = html.replace(/We'll text you a few hours before we come by \{\{dorm_hall\}\}, room \{\{room\}\}\./, "We'll text you a few hours before we come by your room.");
  }
  html = html.replaceAll("{{first_name}}", esc(o.firstName)).replaceAll("{{dorm_hall}}", esc(o.dorm)).replaceAll("{{room}}", esc(o.room)).replaceAll("{{order_ref}}", esc(o.ref));
  const subject = `Your ${BRAND.name} strip is on the way (within 24 hours)`;
  const text = `Hi ${o.firstName}, inventory is in! Your ${BRAND.name} strip will be at your door within 24 hours. We'll text you a few hours before we come by. Leave your door open and a student will install your strip. Questions? Reply or email ${BRAND.contact}.`;
  return { subject, html, text };
}
