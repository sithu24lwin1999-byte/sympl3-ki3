# KI3 POS

KI3 POS is a multi-tenant shop-management and point-of-sale web app. It supports system administrators, shop owners and employees with Firebase Authentication, realtime Firestore data, offline caching and a GitHub Pages deployment.

## Features

- Secure email/password sign-in with role-protected routes
- Tenant shop and account provisioning
- Realtime products/services, employees, orders, customers, shifts and settings
- Owner-configured KPay, Wave Money and bank accounts shown directly at employee checkout
- Payment transaction history grouped by cash, KPay, Wave and bank transfer
- Idempotent, transactional checkout: order, payment ledger, accounting ledger and stock movements commit together
- Transactional stock deduction, purchase receiving, stock movements and refund restoration
- Suppliers, purchases, expenses, loyalty points, audit logs and cash-shift reconciliation
- Barcode checkout, employee permissions, configurable taxes/service charges and invoice printing
- Business profiles for restaurants, retail, fashion, bakeries, photobooths, service businesses and other shops
- Photobooth preset services for photo sessions and costume rental
- Multi-branch employee assignment and daily branch income/expense/net-cash reporting
- Employee-entered operating expenses and owner cash withdrawals
- Password-reset email flow for owners and employees
- Offline order queue with automatic reconnect sync
- Live owner/admin dashboards, CSV/PDF reports and cloud-data backup
- Installable PWA and responsive layouts

Wallet and bank payments record the owner-selected account and optional transaction reference. No external wallet or bank API transfers money automatically.

## Local development

Requirements: Node.js 22 and Firebase CLI.

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm test
npm run test:rules
npm run build
```

## Firebase

The app uses project `gen-lang-client-0708972425` and the named Firestore database configured in `firebase-applet-config.json`. Email/Password is the supported Firebase Authentication provider.

The production application is compatible with the Firebase Spark (free) plan and uses only Firebase Authentication and Cloud Firestore. Firebase Authentication performs password hashing and ID-token/session management. Firestore Security Rules independently enforce tenant status, expiry dates, tenant membership and employee permissions.

Managed owner/employee accounts are created through an isolated secondary Firebase Auth client, so the signed-in administrator or owner keeps their own session. Shop suspension, renewal and archiving are secured Firestore writes with audit logs. Expiration does not need a scheduled function: clients derive the display state from `expiry`, while Firestore Rules reject tenant writes after `expiresAt`.

Spark-plan limitations are handled deliberately:

- Tenant accounts are archived/disabled instead of attempting privileged Auth deletion.
- An existing employee login email is immutable; create a replacement account and disable the old account.
- Backups are manual JSON downloads. Automated server schedules and secret-backed email/SMS delivery require an external service or a paid backend.

Deploy Firestore rules and indexes before publishing the frontend:

```bash
firebase deploy --only firestore
```

Administrator access is controlled by the Firebase Authentication `admin: true` custom claim.

Authorization rules have an emulator test suite:

```bash
npm run test:rules
```

The Firestore emulator requires Java 21. On Apple Silicon with Homebrew:

```bash
brew install openjdk@21
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:rules
```

## Architecture and data safety

- `src/pages` contains role-scoped screens; `src/lib` contains authentication, authorization, Firestore transactions and reporting services.
- Firebase Authentication securely hashes passwords and issues ID-token sessions. The application never stores password hashes in Firestore.
- Firestore Security Rules are the server-side authorization boundary. UI route guards are an additional convenience, not the security mechanism.
- Every new checkout uses an idempotency key and deterministic order ID. Retrying the same offline sale returns the existing order without deducting stock again.
- Checkout writes the order, immutable payment transaction, immutable accounting transaction and stock movements in one Firestore transaction.
- Tenant writes are rejected when a shop is stopped, archived, suspended or expired.
- Firebase Auth supplies managed rate limiting and abuse protection. No custom credential endpoint is hosted by this Spark-plan build.
- `firebase-applet-config.json` is Firebase browser configuration, not a server credential. Never commit service accounts, private keys, provider secrets or passwords.

The active collections and compatibility policy are documented in [`docs/FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md). The checkout schema change is documented in [`docs/migrations/2026-07-23-atomic-sale-ledgers.md`](docs/migrations/2026-07-23-atomic-sale-ledgers.md).

## Administrator setup

The Main System Admin must be created in Firebase Authentication with Email/Password and receive the `admin: true` custom claim from a trusted administrator environment. Never put admin credentials or a service-account key in this repository. After changing a custom claim, sign out and sign in again so Firebase refreshes the ID token.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml` and publish the PWA to GitHub Pages:

https://sithu24lwin1999-byte.github.io/sympl3-ki3/

For a custom domain, add the domain in GitHub Pages settings and create the required DNS records with the domain provider.
