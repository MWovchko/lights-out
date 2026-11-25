// DarkDorms referrers (campus reps). Sales still count for any code used in a
// link, even one not listed here; listing a rep just adds their name and payouts.
//
// code:   what goes in their link, darkdorms.com/r/<code> (lowercase letters, numbers, - or _)
// name:   shown on the tracker
// payouts: money already sent to them, so the tracker shows what is still owed.
//          Add one line each time you pay: { date: "2026-12-01", amount: 6, note: "Venmo" }
//
// Keep payment handles (Venmo, Cash App) out of this file. The repo is not the place for them.
export const PAYOUT_PER_STRIP = 2; // dollars per strip sold through a referral link
export const HOLD_DAYS = 7;        // sales newer than this are "pending" (refund window) before they are payable

export const REFERRERS = [
  { code: "julia", name: "Julia", payouts: [] },
  // { code: "jake", name: "Jake (EMR)", payouts: [] },
];
