# KI3 POS

KI3 POS is a multi-tenant shop-management and point-of-sale web app. It supports system administrators, shop owners and employees with Firebase Authentication, realtime Firestore data, offline caching and a GitHub Pages deployment.

## Features

- Secure email/password and Google sign-in with role-protected routes
- Tenant shop and account provisioning
- Realtime products, employees, orders, customers, shifts and settings
- Transactional stock deduction and refund stock restoration
- Discounts, taxes, customer capture, shift opening/closing and receipt printing
- Offline order queue with automatic reconnect sync
- Live owner/admin dashboards, CSV/PDF reports and cloud-data backup
- Installable PWA and responsive layouts

Payment buttons record the selected method only; no external wallet or bank API is included.

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
