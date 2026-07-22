# KI3 POS

KI3 POS is a multi-tenant shop-management and point-of-sale web app. It supports system administrators, shop owners and employees with Firebase Authentication, realtime Firestore data, offline caching and a GitHub Pages deployment.

## Features

- Secure email/password and Google sign-in with role-protected routes
- Tenant shop and account provisioning
- Realtime products/services, employees, orders, customers, shifts and settings
- Owner-configured KPay, Wave Money and bank accounts shown directly at employee checkout
- Payment transaction history grouped by cash, KPay, Wave and bank transfer
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
npm run build
```

## Firebase

The app uses project `gen-lang-client-0708972425` and the named Firestore database configured in `firebase-applet-config.json`. Enable Google and Email/Password providers in Firebase Authentication.

Deploy rules and indexes:

```bash
firebase deploy --only firestore
```

Administrator access is controlled by the Firebase Authentication `admin: true` custom claim.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml` and publish the PWA to GitHub Pages:

https://sithu24lwin1999-byte.github.io/sympl3-ki3/

For a custom domain, add the domain in GitHub Pages settings and create the required DNS records with the domain provider.
