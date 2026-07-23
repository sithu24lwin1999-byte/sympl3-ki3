# KI3 POS active Firestore schema

The running application uses Firebase Authentication and Cloud Firestore. `db_schema.sql` is a legacy reference and is not executed.

## Root collections

- `users/{uid}` — role, tenant assignment, branch and active state. Authentication secrets are never stored here.
- `shops/{shopId}` — owner, business profile, subscription state and expiry.
- `subscriptionTransactions/{id}` — immutable platform subscription history.
- `settings/{id}` — platform settings.
- `systemAuditLogs/{id}` — platform administrator audit events.
- `impersonationSessions/{id}` — audited support-access requests; no session takeover is implemented.
- `errorLogs/{id}` — administrator-readable diagnostics; client writes are denied.

## Tenant collections

All tenant documents live below `shops/{shopId}` and repeat `shopId` where rules require explicit validation.

- Operational: `branches`, `employees`, `products`, `customers`, `suppliers`, `shifts`, `heldOrders`, `orders`.
- Inventory: `purchases`, `purchaseReturns`, `salesReturns`, `stockMovements`.
- Finance: `paymentAccounts`, `paymentTransactions`, `accountingTransactions`, `expenses`, `expenseCategories`, `dueCollections`.
- Engagement/settings: `promotions`, `coupons`, `notifications`, `settings`, `auditLogs`.

## Atomic checkout invariants

New orders use `schemaVersion: 2`, an `idempotencyKey`, `paymentTransactionId` and `accountingTransactionId`.

For one checkout, a single Firestore transaction:

1. Reads the deterministic order ID and returns it unchanged if the idempotency key already exists.
2. Reads settings and every product before writing.
3. Validates stock and calculates each new balance.
4. Writes the order, one immutable payment transaction, one immutable accounting transaction and one immutable stock movement per tracked product.

Refunds write a sales return, refund payment transaction, refund accounting transaction, order state and restocking movements atomically. Due collection writes the due record, payment transaction, accounting transaction and order balance atomically.

Legacy orders remain readable. They do not gain fabricated ledger entries automatically.

## Authorization

`firestore.rules` is authoritative:

- Admin access requires the Firebase ID-token custom claim `admin == true`.
- Owners must match `shops/{shopId}.ownerId`.
- Employees must have an active tenant employee document and required permission.
- Tenant writes require an active, non-expired subscription.
- Ledger records are immutable and must link to the order/refund/due record created or updated in the same atomic request.
