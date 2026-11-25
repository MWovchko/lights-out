# Referral links, QR codes and $2 payouts

## How it works
1. Each rep gets a link: `https://darkdorms.com/r/<code>` (for example `/r/jake`). Make the link and a printable QR card at **darkdorms.com/referrals** (no login needed for that part).
2. A visitor who opens the link is tagged with that code for 30 days on that device (last rep link opened wins). The `?ref=` is removed from the address bar.
3. When they press Preorder, `site.js` adds `client_reference_id=ref_<code>` to the Stripe Payment Link. Nothing about the Stripe link itself changes (price, active/inactive, settings).
4. **darkdorms.com/referrals** (admin password) reads paid Stripe checkouts live and shows, per rep: strips sold, pending (still inside the refund window), earned, paid out, and owed.
5. Pay reps by Venmo or Cash App, then add the payment to `api/_lib/referrers.mjs` so "owed" drops back.

## Rules (change in `api/_lib/referrers.mjs`)
- `PAYOUT_PER_STRIP = 2`
- `HOLD_DAYS = 7`: newer sales show as pending until the refund window passes.
- Fully refunded orders earn $0. Partly refunded (50% policy) still earn and are flagged "partly refunded".
- Any code works even before it is listed. Listing a rep adds their name and payout history.

## Setup (Vercel env vars, never in the repo)
- `STRIPE_SECRET_KEY`: restricted read-only key (Checkout Sessions, Payment Intents, Charges: Read).
- `ADMIN_SECRET`: 16+ characters. The same variables PR #3 (Resend emails) uses, so set them once.

No webhook or database. This does not touch `api/stripe-webhook.mjs` from PR #3, so they merge in either order.

## Tests
`node --test tests/referrals.test.mjs`

## Later options
- **Stripe Promotion Codes**: one code per rep (e.g. `JAKE`) for people who hear about it in person and never scan. Needs "Allow promotion codes" turned on for the Payment Link, and a code usually means a discount for the buyer, which cuts the margin further.
- **Stripe Connect**: pays reps automatically from each sale. Worth it only with many reps; it needs each rep to onboard with Stripe and adds fees.
- If a rep earns $600+ in a year, you need their W-9 and to send a 1099-NEC.
