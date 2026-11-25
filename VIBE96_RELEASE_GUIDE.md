# Vibe96 Marketplace Upload Checklist — Pravaclin

Before uploading your ZIP or connecting your GitHub repository to **Vibe96 (`vibe96.com` / `studio.vibe96.com`)**, follow these 4 quick steps so your personal Firebase account stays private and buyers can set up the app cleanly:

## 1. Replace Your Personal Config Before Zipping (For Marketplace Sales)
- Replace the contents of `firebase-applet-config.json` in your upload ZIP with the blank template from `firebase-applet-config.example.json`.
- In `lib/firebase.ts` (last line) and `firestore.rules` (`isBootstrappedSuperAdmin()`), replace your personal email with `admin@example.com` (buyers will set their own email via `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` and `firestore.rules`).

> If you are only hosting the app for **your own clinic** on Vibe96 Studio (not selling the source code), keep your existing `firebase-applet-config.json` and simply add your Vibe96 domain under **Firebase Console → Authentication → Settings → Authorized domains**.

## 2. Exclude Build & Dependency Folders From ZIP
Do **not** include these folders/files in your upload archive:
- `node_modules/`
- `.next/`
- `.env.local` (if created locally)

## 3. Recommended Vibe96 Listing Details
- **Title:** Pravaclin — Multi-Tenant Clinic & Diagnostic Management SaaS
- **Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Firebase Auth, Cloud Firestore, Recharts
- **Key Selling Points:**
  - 16 complete modules: Executive Dashboard (with Hide/Show Financial Privacy Toggle), Patients & Completed Visit Management, Doctors & Schedules, Live Appointment Queue, Printable A4 Digital Prescriptions, Lab Reports, Billing & Expenses, Complete Pharmacy Management (Inventory Valuation, Profit Margin, 90-Day Expiry Alerts, CSV Export, Direct POS Dispensing with Prescription Auto-Matching, Atomic Stock Deduction, Printable Sales Receipts & Sales History), Inpatient Beds/Cabins, Staff HR & Custom RBAC, Verified Email Staff Invites, Multi-Branch Network, Audit Trail, and Patient Self-Service Portal.
  - Clean **English Global UI** + **Multi-Currency (`USD`, `EUR`, `BDT`)** + **Light & Dark Mode** + Mobile-Responsive layout + Custom **Pravaclin** Emerald & Teal identity.
  - Production-hardened **Cloud Firestore Security Rules** (`firestore.rules`) with strict multi-clinic isolation, zero-trust staff invitations, finalized Rx / verified lab locks, and append-only audit logs.

## 4. Verification & Live Demo Before Upload
1. Ensure you have a working **Live Demo URL** deployed (e.g., Vercel or Vibe96 Studio) and add that domain to **Firebase Console → Authentication → Settings → Authorized domains**.
2. Run these commands locally to confirm zero build or lint issues:
```bash
npm run lint
npm run build
```
