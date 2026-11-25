'use client';

import React, { useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';

interface AuthScreenProps {
  onEnterDemo: () => void;
}

export function AuthScreen({ onEnterDemo }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Brand Column */}
      <div className="lg:w-1/2 bg-slate-900 dark:bg-slate-900 text-white p-8 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Pravaclin</span>
        </div>

        <div className="my-12 lg:my-0 max-w-lg space-y-6">
          <p className="text-sm font-medium text-emerald-400">
            Multi-Tenant Clinic &amp; Diagnostic Management SaaS
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-balance">
            Clinical precision from front-desk queue to pharmacy dispensing.
          </h1>
          <p className="text-base text-slate-300 leading-relaxed">
            Operate solo chambers, diagnostic labs, or multi-branch hospitals with strict
            tenant-isolated Cloud Firestore records, printable A4 prescriptions, verified lab
            reports, and POS pharmacy inventory.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            {[
              { icon: ShieldCheck, title: 'Strict Tenant Isolation', desc: 'Organization-scoped RBAC & immutable audit logs' },
              { icon: Activity, title: 'End-to-End Clinical Flow', desc: 'Queue tokens, A4 Rx, lab verification & billing' },
              { icon: Building2, title: 'Multi-Branch Ready', desc: 'Unified staff invites & branch-level operations' },
              { icon: CheckCircle2, title: 'Pharmacy POS & Alerts', desc: 'Atomic stock deduction & 90-day expiry tracking' },
            ].map((item) => (
              <div key={item.title} className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <item.icon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Pravaclin Clinical Operations Platform · HIPAA-minded tenant isolation architecture
        </p>
      </div>

      {/* Right Sign-In Column */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {mode === 'signin' ? 'Sign in to your clinic workspace' : 'Create clinic owner account'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isFirebaseConfigured
                ? 'Authenticate with Firebase to access your clinic tenant.'
                : 'Firebase environment keys are not configured yet. Launch the interactive clinic workspace or add NEXT_PUBLIC_FIREBASE_* keys.'}
            </p>
          </div>

          {!isFirebaseConfigured && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  Interactive Workspace Ready
                </p>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                  Explore all 12 clinical &amp; operational modules immediately. To connect live
                  Firebase Auth and Cloud Firestore, set your <code className="font-mono">NEXT_PUBLIC_FIREBASE_*</code>{' '}
                  environment variables in Vercel or <code className="font-mono">.env.local</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={onEnterDemo}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <span>Open Interactive Clinic Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isFirebaseConfigured && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors cursor-pointer disabled:opacity-60"
              >
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="px-3 text-xs text-slate-400">or email credentials</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Dr. Ariful Hasan"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor@clinic.com"
                      className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Authenticating...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                >
                  {mode === 'signin' ? 'Need a clinic account? Register' : 'Already have an account? Sign in'}
                </button>
                <button
                  type="button"
                  onClick={onEnterDemo}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Preview Demo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
