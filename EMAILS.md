# DarkDorms emails (Resend)

Emails go out through [Resend](https://resend.com) from `DarkDorms <me@darkdorms.com>`, replies go to me@darkdorms.com.
No API keys live in this repo. They are Vercel environment variables.

| Email | When | Who gets it | Code |
|---|---|---|---|
| Order confirmation | Stripe says a payment link checkout is paid | The customer | `api/stripe-webhook.mjs` |
| New order notice | Same moment | me@darkdorms.com, cc Melvin (agent-agent@inkboxmail.com) | `api/stripe-webhook.mjs` |
| Inventory is in | Only when run by hand after Maxwell says inventory arrived | Every paid, not fully refunded customer, one email each | `api/send-inventory-email.mjs` + `email/inventory-arrived.html` |

Wording lives in `api/_lib/emails.mjs` (BRAND block at the top).

## Vercel environment variables (Production)

| Name | Value |
|---|---|
| `RESEND_API_KEY` | Resend API key, "Sending access" only, domain darkdorms.com |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the Stripe webhook endpoint below |
| `STRIPE_SECRET_KEY` | Restricted Stripe key with **Checkout Sessions: Read**, **PaymentIntents: Read**, **Charges: Read** (only for the inventory email) |
| `ADMIN_SECRET` | Any long random password (20+ characters). Guards the inventory send |
| `EMAIL_FROM` (optional) | Default `DarkDorms <me@darkdorms.com>` |
| `ORDER_NOTIFY_TO` / `ORDER_NOTIFY_CC` (optional) | Defaults me@darkdorms.com / agent-agent@inkboxmail.com |

## Stripe webhook
Stripe Dashboard > Developers > Webhooks > Add endpoint
- URL: `https://darkdorms.com/api/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`

Webhook retries never double-send: each send uses a Resend idempotency key per Stripe session.

## Inventory-arrived email (Melvin, only after Maxwell's go-ahead)
```sh
# 1. who would get it (sends nothing)
curl -s -X POST https://darkdorms.com/api/send-inventory-email -H "Authorization: Bearer $ADMIN_SECRET" -d '{"mode":"dry-run"}'
# 2. one test copy to me@darkdorms.com
curl -s -X POST https://darkdorms.com/api/send-inventory-email -H "Authorization: Bearer $ADMIN_SECRET" -d '{"mode":"test"}'
# 3. the real send
curl -s -X POST https://darkdorms.com/api/send-inventory-email -H "Authorization: Bearer $ADMIN_SECRET" -d '{"mode":"send","confirm":"INVENTORY IS IN"}'
```
Free Resend plan: 3,000 emails a month, 100 a day. Over 100 customers, split the send across days or upgrade.
