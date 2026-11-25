import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jakarta',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Pravaclin — MediCare Pro | Multi-Tenant Clinic Management SaaS',
  description:
    'Multi-tenant Clinic Management SaaS Platform with Patient Registry, Doctor Scheduling, Appointments, Digital Prescriptions, Laboratory Reports, Pharmacy, Billing, and RBAC.',
  openGraph: {
    title: 'Pravaclin — MediCare Pro | Multi-Tenant Clinic Management SaaS',
    description:
      'Multi-tenant Clinic Management SaaS Platform with Patient Registry, Doctor Scheduling, Appointments, Digital Prescriptions, Laboratory Reports, Pharmacy, Billing, and RBAC.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${dmSans.variable} ${jetbrains.variable}`}
    >
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
