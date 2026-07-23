# 2026-07-23 — Atomic sale ledgers (schema version 2)

## Change

New completed orders now include:

- `schemaVersion: 2`
- `idempotencyKey`
- `paymentTransactionId`
- `accountingTransactionId`

New tenant subcollections:

- `shops/{shopId}/paymentTransactions`
- `shops/{shopId}/accountingTransactions`

Refunded orders also receive `refundPaymentTransactionId` and `refundAccountingTransactionId`. Due updates receive the latest linked due-collection and ledger IDs.

## Deployment order

1. Run `npm run verify`.
2. Deploy `firestore.rules` and `firestore.indexes.json`.
3. Publish the frontend.

Rules and frontend must be released together because the new rules require schema-version-2 ledger links for new completed sales.

## Existing data

No destructive backfill is required. Existing orders remain readable and report code keeps its legacy fallbacks. Do not manufacture historical payment/accounting records without reconciliation against source receipts.

## Rollback

Revert the frontend and Firestore Rules together. Documents already written with schema version 2 are backward-compatible because all added fields and subcollections are additive.
