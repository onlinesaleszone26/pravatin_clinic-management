# Pravaclin — Multi-Tenant Clinic Management SaaS

**Pravaclin** is a complete, production-ready, multi-tenant Clinic, Hospital, and Diagnostic Center Management SaaS built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **Firebase Authentication**, and **Cloud Firestore**.

> **Live Demo:** Deploy to Vercel or Vibe96 Studio and update `APP_URL` in `.env.local` (plus authorize the domain under Firebase Console → Authentication → Settings → Authorized domains).

---

## Core Modules & Capabilities

- **Multi-Tenant Clinic Architecture:** Onboard unlimited clinics, solo chambers, diagnostic centers, or multi-branch hospitals with strict database-level tenant isolation.
- **Executive Dashboard with Financial Privacy:** Real-time appointment volume, service-wise revenue charts, and a one-click Hide/Show privacy toggle for financial totals at front-desk screens.
- **Patient Registration & EMR:** Full demographic registry, blood group, allergies, medical history, assigned doctor, completed-visit filtering and safe cleanup, search, and longitudinal patient timeline.
- **Doctors & Schedules:** Doctor profiles across medical disciplines (Allopathic, Homeopathic, Dental, Specialist), BMDC/registration details, consultation & follow-up fees, shifts, and slot scheduling.
- **Appointments & Live Queue:** Token-based queue tracking (`pending` → `confirmed` → `checked_in` → `in_consultation` → `completed`), conflict prevention, one-click handoff to Prescription or Billing, and completed visit cleanup.
- **Digital Prescriptions (Printable A4):** Structured vitals, complaints, diagnosis, medicines with frequency/duration/instructions, 3 print templates (General A4, Compact, Homeopathy), and terminal lock once finalized.
- **Laboratory & Diagnostics:** Configurable test catalog, lab orders, result entry with abnormal flags, verification lock, and printable A4 lab reports.
- **Billing, Invoices & Expenses:** Itemized consultation/lab/pharmacy invoices, partial & multi-method payments (Cash, bKash, Nagad, Card, Bank), receipts, refunds, and clinic expense ledger.
- **Complete Pharmacy Management & POS:** Medicine brand/generic catalog, batch/barcode tracking, inventory valuation & profit margins, 90-day expiry & low-stock alerts, CSV export, direct POS medicine dispensing (Registered Patients & Walk-Ins) with atomic stock deduction, digital prescription auto-matching, printable pharmacy sales receipts, and full sales history.
- **Inpatient Beds & Cabins:** Ward/cabin management, patient admission, nursing notes, and discharge workflow.
- **Staff HR, Custom RBAC & Verified Invitations:** 10 built-in roles, custom permission matrices, verified Google-email staff onboarding (`Accept & Join Clinic`), instant access revocation, and team access sync across records.
- **Reports, CSV/JSON Export & Audit Trail:** Date/doctor filters, CSV appointment & pharmacy exports, full clinic JSON backups, and append-only Firestore audit logs.
- **Multi-Currency & Light/Dark Mode:** Global English interface with configurable currency (`USD`, `EUR`, `BDT`) and full Light/Dark theme support across all modules.
- **Patient Self-Service Portal & SaaS Super Admin Console:** Dedicated patient portal for read-only personal records + isolated Super Admin panel for tenant governance and subscription plans.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + Lucide React Icons
- **Charts:** Recharts
- **Auth & Database:** Firebase Authentication (Google Sign-In & Email/Password) + Cloud Firestore
- **Security:** Strict tenant-isolated `firestore.rules`, anti-privilege-escalation checks, append-only audit logs, and hardened HTTP security headers in `next.config.ts`

---

## Quick Setup Guide (5 Minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** → **Sign-in method** → enable **Google** and **Email/Password**.
3. Create a **Cloud Firestore** database in production mode.
4. Register a **Web App** in **Project Settings → General → Your Apps** and copy your Firebase web config keys.

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and paste your Firebase keys:

```bash
cp .env.example .env.local
```

Update `.env.local`:

```env
APP_URL="http://localhost:3000"
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_DATABASE_ID="(default)"
NEXT_PUBLIC_SUPER_ADMIN_EMAIL="your-admin@example.com"
```

### 4. Update Super Admin Email & Deploy Firestore Security Rules

1. Open `firestore.rules` and update the bootstrap Super Admin email inside `isBootstrappedSuperAdmin()` to match your `NEXT_PUBLIC_SUPER_ADMIN_EMAIL`.
2. Deploy the security rules to your Firebase project:

```bash
npx firebase login
npx firebase use --add
npx firebase deploy --only firestore:rules
```

### 5. Authorize Your Deployment Domain

In **Firebase Console → Authentication → Settings → Authorized domains**, add your production domain (for example, `your-app.vibe96.com` or `your-clinic.vercel.app`) so Google Sign-In works smoothly.

### 6. Run Locally or Build for Production

```bash
# Development
npm run dev

# Production build & start
npm run build
npm run start
```

---

## Security Architecture

- **Tenant Isolation:** Every organization record is scoped to `organizations/{orgId}/...` with `authorizedUids` verification in `firestore.rules`.
- **Zero-Trust Staff Invites:** Staff join clinics via email-verified invitations matched against `request.auth.token.email` using atomic Firestore batches.
- **Clinical Immutability:** Finalized prescriptions and verified lab results are locked against unauthorized clinical tampering, and audit logs are strictly append-only.
- **HTTP Headers:** `next.config.ts` ships with `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security`.

> **Note:** Review `firestore.rules` and configure your regional privacy/healthcare compliance controls before operating with live patient data at scale.
