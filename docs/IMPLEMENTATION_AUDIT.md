# KI3 POS implementation audit — 2026-07-23

## Architecture

- Vite 6, React 19, React Router 7, TypeScript 5.8 and Tailwind CSS 4.
- npm is the authoritative package manager (`package-lock.json`); a legacy `bun.lock` is also present.
- Firebase Authentication, named Cloud Firestore database, realtime listeners and persistent multi-tab cache.
- PWA service worker and GitHub Pages workflow.
- Browser-only Spark-plan architecture; no deployed Cloud Functions or custom server API.

## Implemented

- Admin, owner and employee authentication/route protection.
- Firestore-enforced tenant isolation, role permissions and subscription blocking.
- Tenant/subscription administration, dashboards, products, inventory traces, employees, POS, orders, refunds, accounting reports and core modules.
- Online/in-store checkout, offline queue, split/credit payments, payment QR/account display, holds, shifts and receipt printing.
- Loading, empty and error states, responsive light/dark UI, confirmation and toast components.
- Idempotent schema-version-2 checkout and immutable payment/accounting ledgers.

## Remaining or architecture-limited

- Trusted admin custom-claim provisioning must happen outside this browser repository.
- Automated email/SMS, scheduled backups and privileged Auth user deletion require a trusted external backend; they are not implemented on the Spark-only build.
- Support impersonation records requests but deliberately does not open another user's session.
- Manual JSON backup exists; automated restore is not implemented.
- `db_schema.sql` is legacy documentation, not the live database.
- The production build has a non-blocking Firebase bundle-size warning.

## Priority checklist

1. Keep TypeScript, rules lint, unit tests, emulator authorization tests and production build green.
2. Deploy the atomic-ledger Firestore Rules and frontend together.
3. Add reconciliation UI driven directly by payment/accounting transaction collections.
4. Add trusted backend jobs only if the Firebase plan and operational requirements change.
5. Add end-to-end browser tests for checkout, reconnect retry, suspension and refund.
