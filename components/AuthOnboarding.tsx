'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Building2,
  ShieldCheck,
  CalendarClock,
  FileText,
  FlaskConical,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  User as UserIcon,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetUserPassword,
} from '@/lib/firebase';
import { createOrganization, seedSampleClinicData, TenantActor } from '@/lib/firestore-service';
import type { Organization } from '@/lib/types';

export function AuthScreen() {
  const [mode, setMode] = useState<'google' | 'email_signin' | 'email_signup' | 'reset'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(msg.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'email_signin') {
        await signInWithEmail(email.trim(), password);
      } else if (mode === 'email_signup') {
        await registerWithEmail(email.trim(), password, name.trim());
      } else if (mode === 'reset') {
        await resetUserPassword(email.trim());
        setInfo('Password reset link sent to your email address.');
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Authentication error.';
      if (raw.includes('operation-not-allowed')) {
        setError(
          'Email/Password sign-in is not yet enabled in this Firebase project. Use "Continue with Google" right now, or enable Email/Password under Firebase Console → Authentication → Sign-in method.'
        );
      } else {
        setError(raw.replace('Firebase: ', ''));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Clean 3-zone Top Bar */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0 p-1 shadow-sm">
              <Image
                src="/assets/pravaclin-logo.jpg"
                alt="Pravaclin Logo"
                width={40}
                height={40}
                className={`w-full h-full object-contain rounded-full ${loading ? 'animate-[spin_1.6s_linear_infinite]' : ''}`}
                referrerPolicy="no-referrer"
                priority
              />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Pravaclin
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap shrink-0">Multi-Tenant Architecture</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="whitespace-nowrap shrink-0">Digital Rx & Lab</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="whitespace-nowrap shrink-0">Role-Based Security</span>
          </nav>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            Sign In
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Clinical Product Proposition */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Healthcare Operations SaaS · Clinics, Diagnostic Centers & Chambers
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12] max-w-2xl">
              Complete Multi-Tenant Clinic Management, Engineered for Clinical Precision.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              Manage independent clinics, patient registries, doctor schedules, conflict-free appointments,
              printable A4 digital prescriptions, verified lab workflows, pharmacy stock, and billing in one
              isolated Firestore workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Strict Tenant Isolation</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Every clinic operates in an isolated organization boundary enforced by Firestore security rules and role permissions.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                <CalendarClock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Smart Scheduling & Tokens</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Auto-generated doctor time slots with double-booking prevention, leave tracking, and live queue tokens.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Digital Prescriptions (A4 & Homeo)</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Doctor-authored Rx studio with medicine search, vitals, clinical advice, and immutable finalized PDFs.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>End-to-End Diagnostic Lab</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Track orders from sample collection to authorized verification with locked reports and full audit history.
              </p>
            </div>
          </div>
        </div>

        {/* Right Authentication Surface */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Access Your Clinic Workspace
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Sign in with your verified account to manage your clinic or register a new organization.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div className="mb-5 p-3.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-300 text-xs flex items-start gap-2.5">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{info}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white font-medium text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Signing in...' : 'Continue with Google Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-slate-900 px-3 text-slate-500 dark:text-slate-400">
                  Or email & password
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('email_signin');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'email_signin' || mode === 'google'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Email Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('email_signup');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'email_signup'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'reset'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Reset
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'email_signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Mahmudul Hasan"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white font-medium text-sm transition-colors disabled:opacity-60"
              >
                {mode === 'email_signup'
                  ? 'Register Account'
                  : mode === 'reset'
                    ? 'Send Reset Link'
                    : 'Sign In with Email'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

interface ClinicRegistrationProps {
  actor: TenantActor;
  onCreated: (orgId: string) => void;
  onCancel?: () => void;
}

export function ClinicRegistrationModal({ actor, onCreated, onCancel }: ClinicRegistrationProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'clinic' | 'diagnostic' | 'hospital' | 'chamber'>('clinic');
  const [planId, setPlanId] = useState('professional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(actor.email || '');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState<'BDT' | 'USD' | 'EUR'>('USD');
  const [enablePharmacy, setEnablePharmacy] = useState(true);
  const [enableInpatient, setEnableInpatient] = useState(true);
  const [includeSampleData, setIncludeSampleData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Clinic name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const orgId = await createOrganization(actor, {
        name: name.trim(),
        type,
        planId,
        billingCycle,
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        currency,
        language: 'en',
        enablePharmacy,
        enableInpatient,
      });

      if (includeSampleData) {
        const tempOrg: Organization = {
          id: orgId,
          name: name.trim(),
          slug: 'temp',
          type,
          ownerUid: actor.uid,
          authorizedUids: [actor.uid],
          status: 'active',
          planId,
          currency,
          language: 'en',
        };
        await seedSampleClinicData(tempOrg, actor);
      }

      onCreated(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register clinic.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-1">
              <Building2 className="w-4 h-4" />
              <span>Multi-Tenant Organization Setup</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Register Your Healthcare Organization
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Creates a completely isolated clinic database, default main branch, and Clinic Owner permissions.
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Clinic / Hospital Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. City Medical Clinic or Modern Diagnostic Center"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Facility Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'clinic' | 'diagnostic' | 'hospital' | 'chamber')}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="clinic">Medical Clinic</option>
                <option value="diagnostic">Diagnostic Center</option>
                <option value="hospital">Hospital / Inpatient Facility</option>
                <option value="chamber">Personal Doctor Chamber</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Subscription Plan
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="starter">Starter (1 Doctor · 500 Patients)</option>
                <option value="professional">Professional (5 Doctors · 5,000 Patients)</option>
                <option value="enterprise">Enterprise (Multi-Branch · All Modules)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 010-2000"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Official Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Clinic Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, Suite, City, Country"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'BDT' | 'USD' | 'EUR')}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="USD">USD ($ US Dollar)</option>
                <option value="EUR">EUR (€ Euro)</option>
                <option value="BDT">BDT (৳ Taka)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Billing Cycle
              </label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enablePharmacy}
                onChange={(e) => setEnablePharmacy(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Enable Integrated Pharmacy & Stock Inventory Module</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableInpatient}
                onChange={(e) => setEnableInpatient(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Enable Inpatient Beds, Wards & Cabin Management Module</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSampleData}
                onChange={(e) => setIncludeSampleData(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              />
              <span>Pre-populate sample doctors, patients, Rx, lab reports & invoices (Test Mode)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#047857] hover:bg-[#065f46] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Provisioning Clinic...' : 'Create Isolated Clinic Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
