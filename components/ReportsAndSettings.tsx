'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  ShieldCheck,
  Database,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Lock,
  UserCheck,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import {
  updateOrganizationSettings,
  saveSubscriptionPlan,
  seedDefaultSubscriptionPlans,
  updateTransactionStatus,
  savePlatformSettings,
  savePatient,
  createAppointment,
  syncClinicTeamAccess,
  TenantActor,
} from '@/lib/firestore-service';
import { exportJsonBackup, exportRowsToCsv, formatMoney, todayISO } from '@/lib/clinic-utils';
import type {
  Organization,
  Patient,
  Doctor,
  Appointment,
  Prescription,
  LabOrder,
  Invoice,
  Expense,
  PharmacyItem,
  AuditLog,
  SubscriptionPlan,
  PlatformTransaction,
} from '@/lib/types';

// ============================================================================
// REPORTS, DATA EXPORT & AUDIT TRAIL MODULE
// ============================================================================
export function ReportsModule({
  org,
  patients,
  doctors,
  appointments,
  prescriptions,
  labOrders,
  invoices,
  expenses,
  pharmacy,
  auditLogs,
}: {
  org: Organization;
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  invoices: Invoice[];
  expenses: Expense[];
  pharmacy: PharmacyItem[];
  auditLogs: AuditLog[];
}) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');

  const filteredAppts = useMemo(() => {
    return appointments.filter((a) => {
      if (fromDate && a.date < fromDate) return false;
      if (toDate && a.date > toDate) return false;
      if (doctorFilter !== 'all' && a.doctorId !== doctorFilter) return false;
      return true;
    });
  }, [appointments, fromDate, toDate, doctorFilter]);

  const totalCollected = invoices.filter((i) => i.status !== 'refunded').reduce((s, i) => s + i.paidAmount, 0);
  const totalDue = invoices.filter((i) => i.status !== 'refunded').reduce((s, i) => s + i.dueAmount, 0);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);

  const exportFullBackup = () => {
    exportJsonBackup(`${org.slug}-full-backup-${todayISO()}.json`, {
      exportedAt: new Date().toISOString(),
      organization: org,
      patients,
      doctors,
      appointments,
      prescriptions,
      labOrders,
      invoices,
      expenses,
      pharmacy,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter & Export Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-end justify-between gap-4 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Doctor Filter</label>
            <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
              <option value="all">All Doctors</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              exportRowsToCsv(
                `${org.slug}-appointments-report.csv`,
                ['APT #', 'Date', 'Slot', 'Patient', 'Doctor', 'Fee', 'Status', 'Payment'],
                filteredAppts.map((a) => [a.appointmentNumber, a.date, a.timeSlot, a.patientName, a.doctorName, a.consultationFee, a.status, a.paymentStatus])
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" /> Appointments CSV
          </button>
          <button
            type="button"
            onClick={exportFullBackup}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <Database className="w-3.5 h-3.5" /> Full JSON Backup
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Report Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print-sheet">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Filtered Visits</p>
          <p className="text-xl font-bold font-mono tabular-nums mt-1">{filteredAppts.length}</p>
          <p className="text-xs text-slate-400">{filteredAppts.filter((a) => a.status === 'cancelled').length} cancelled</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Confirmed Revenue</p>
          <p className="text-xl font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400 mt-1">{formatMoney(totalCollected, org.currency)}</p>
          <p className="text-xs text-amber-600">Due: {formatMoney(totalDue, org.currency)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Expenses</p>
          <p className="text-xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400 mt-1">{formatMoney(totalExp, org.currency)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Lab Orders / Verified</p>
          <p className="text-xl font-bold font-mono tabular-nums mt-1">
            {labOrders.length} / {labOrders.filter((l) => l.status === 'verified' || l.status === 'delivered').length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Pharmacy SKUs / Rx</p>
          <p className="text-xl font-bold font-mono tabular-nums mt-1">{pharmacy.length} / {prescriptions.length}</p>
        </div>
      </div>

      {/* Immutable Audit Trail */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Immutable Clinic Audit Log ({auditLogs.length})</h3>
            <p className="text-xs text-slate-500">Append-only security and clinical activity history protected by Firestore rules</p>
          </div>
          <Lock className="w-4 h-4 text-slate-400" />
        </div>
        {auditLogs.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No audit entries recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto text-xs">
            {auditLogs.slice(0, 60).map((log) => (
              <div key={log.id} className="px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 mr-2">{log.action}</span>
                  <span className="text-slate-800 dark:text-slate-200">{log.summary}</span>
                </div>
                <span className="font-mono text-slate-500 shrink-0">
                  {log.actorName} ({log.actorRole}) · {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Just now'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CLINIC SETTINGS & CUSTOMIZATION MODULE
// ============================================================================
export function ClinicSettingsModule({
  org,
  actor,
  onThemeChange,
  theme,
}: {
  org: Organization;
  actor: TenantActor;
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
}) {
  const [name, setName] = useState(org.name);
  const [address, setAddress] = useState(org.address || '');
  const [phone, setPhone] = useState(org.phone || '');
  const [email, setEmail] = useState(org.email || '');
  const [website, setWebsite] = useState(org.website || '');
  const [currency, setCurrency] = useState<'BDT' | 'USD' | 'EUR'>(org.currency);
  const [prescriptionHeader, setPrescriptionHeader] = useState(org.prescriptionHeader || org.name);
  const [prescriptionFooter, setPrescriptionFooter] = useState(org.prescriptionFooter || '');
  const [invoiceFooter, setInvoiceFooter] = useState(org.invoiceFooter || '');
  const [enablePharmacy, setEnablePharmacy] = useState(org.enablePharmacy !== false);
  const [enableInpatient, setEnableInpatient] = useState(org.enableInpatient !== false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [syncingAccess, setSyncingAccess] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const canSyncAccess = actor.role === 'clinic_owner' || actor.role === 'clinic_admin';

  const handleSyncTeamAccess = async () => {
    setSyncingAccess(true);
    setSyncMsg(null);
    try {
      const updated = await syncClinicTeamAccess(org, actor);
      setSyncMsg(
        updated > 0
          ? `Synchronized team access across ${updated} clinic record(s).`
          : 'All clinic records are already synchronized with active team accounts.'
      );
    } finally {
      setSyncingAccess(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(false);
    try {
      await updateOrganizationSettings(org.id, {
        name,
        address,
        phone,
        email,
        website,
        currency,
        language: 'en',
        prescriptionHeader,
        prescriptionFooter,
        invoiceFooter,
        enablePharmacy,
        enableInpatient,
      });
      setSavedMsg(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">General Clinic Profile & Localization</h2>
            <p className="text-xs text-slate-500">Organization ID: <span className="font-mono">{org.id}</span> · Slug: <span className="font-mono">{org.slug}</span></p>
          </div>
          <Sliders className="w-4 h-4 text-slate-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">Clinic Name</label><input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <div><label className="block text-xs font-medium mb-1">Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <div><label className="block text-xs font-medium mb-1">Official Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <div><label className="block text-xs font-medium mb-1">Website</label><input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <div>
            <label className="block text-xs font-medium mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as 'BDT' | 'USD' | 'EUR')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
              <option value="USD">USD ($ US Dollar)</option>
              <option value="EUR">EUR (€ Euro)</option>
              <option value="BDT">BDT (৳ Taka)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Theme Mode</label>
            <select value={theme} onChange={(e) => onThemeChange(e.target.value as 'light' | 'dark')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Document Templates & Optional Modules</h3>
        <div className="space-y-3">
          <div><label className="block text-xs font-medium mb-1">Prescription Print Header</label><input value={prescriptionHeader} onChange={(e) => setPrescriptionHeader(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <div><label className="block text-xs font-medium mb-1">Prescription Print Footer</label><input value={prescriptionFooter} onChange={(e) => setPrescriptionFooter(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <div><label className="block text-xs font-medium mb-1">Invoice Receipt Footer</label><input value={invoiceFooter} onChange={(e) => setInvoiceFooter(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 pt-2"><input type="checkbox" checked={enablePharmacy} onChange={(e) => setEnablePharmacy(e.target.checked)} /> Enable Pharmacy & Stock Inventory Module</label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={enableInpatient} onChange={(e) => setEnableInpatient(e.target.checked)} /> Enable Inpatient Beds & Cabins Module</label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#047857]" /> Security & Access Control
            </p>
            <p className="text-xs text-slate-500">
              Active authorized accounts: <strong className="font-mono text-slate-800 dark:text-slate-200">{org.authorizedUids.length} / 50</strong>
            </p>
          </div>
          {canSyncAccess && (
            <button
              type="button"
              onClick={handleSyncTeamAccess}
              disabled={syncingAccess}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:border-[#047857]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAccess ? 'animate-spin' : ''}`} />
              {syncingAccess ? 'Syncing...' : 'Sync Team Access Across Records'}
            </button>
          )}
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
          <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#047857] shrink-0" /> Strict multi-clinic database isolation</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#047857] shrink-0" /> Verified Google email staff invitations</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#047857] shrink-0" /> Owner role escalation protection</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#047857] shrink-0" /> Finalized Rx & verified lab result locks</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#047857] shrink-0" /> Append-only audit logs for sensitive actions</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#047857] shrink-0" /> Grace-period clinical data retention</li>
        </ul>

        {syncMsg && (
          <p className="text-xs text-[#047857] dark:text-emerald-400 font-medium">{syncMsg}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        {savedMsg ? (
          <span className="text-xs text-teal-700 dark:text-teal-400 inline-flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Clinic settings persisted to Firestore.
          </span>
        ) : <span />}
        <button type="submit" disabled={saving} className="px-5 py-2.5 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
          {saving ? 'Saving...' : 'Save Clinic Settings'}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// SUPER ADMIN SAAS CONSOLE (ISOLATED FROM CLINICAL PATIENT DATA)
// ============================================================================
export function SuperAdminConsole() {
  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [txs, setTxs] = useState<PlatformTransaction[]>([]);
  const [tab, setTab] = useState<'clinics' | 'plans' | 'payments' | 'platform'>('clinics');
  const [platformName, setPlatformName] = useState('Pravaclin');
  const [contactEmail, setContactEmail] = useState('support@pravaclin.example');
  const [smsMode, setSmsMode] = useState<'disabled' | 'test_mode' | 'configured'>('test_mode');
  const [waMode, setWaMode] = useState<'disabled' | 'test_mode' | 'configured'>('test_mode');
  const [payMode, setPayMode] = useState<'manual' | 'test_mode' | 'configured'>('manual');
  const [maintenance, setMaintenance] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanMonthly, setNewPlanMonthly] = useState('49');
  const [newPlanDoctors, setNewPlanDoctors] = useState('3');
  const [newPlanPatients, setNewPlanPatients] = useState('2000');

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'organizations'),
      (snap) => setAllOrgs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Organization, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'organizations')
    );
    const u2 = onSnapshot(
      collection(db, 'subscriptionPlans'),
      (snap) => setPlans(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionPlan, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptionPlans')
    );
    const u3 = onSnapshot(
      collection(db, 'transactions'),
      (snap) => setTxs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlatformTransaction, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const mrr = useMemo(() => {
    return allOrgs
      .filter((o) => o.status === 'active')
      .reduce((sum, o) => {
        const plan = plans.find((p) => p.id === o.planId || p.code === o.planId);
        return sum + (plan?.monthlyPrice || 0);
      }, 0);
  }, [allOrgs, plans]);

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    await saveSubscriptionPlan({
      name: newPlanName.trim(),
      code: 'custom',
      audience: 'Custom SaaS tier',
      monthlyPrice: Number(newPlanMonthly || 0),
      yearlyPrice: Number(newPlanMonthly || 0) * 10,
      currency: 'USD',
      trialDays: 14,
      doctorLimit: Number(newPlanDoctors || 1),
      patientLimit: Number(newPlanPatients || 500),
      userLimit: 10,
      branchLimit: 2,
      storageGb: 20,
      modules: ['patients', 'appointments', 'prescriptions', 'laboratory', 'billing'],
      isPublic: true,
    });
    setNewPlanName('');
  };

  return (
    <div className="space-y-6">
      {/* Clinical Privacy Notice */}
      <div className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-900 rounded-xl p-4 flex items-center gap-3 text-xs text-teal-800 dark:text-teal-300">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <span>
          <strong>Super Admin Clinical Privacy Boundary Active:</strong> You manage tenant organizations, subscription plans, and platform billing. Access to sensitive clinic patient records, prescriptions, and lab results is strictly blocked by Firestore security rules unless explicitly authorized as a clinic member.
        </span>
      </div>

      {/* SaaS KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Registered Clinics</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">{allOrgs.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Active / Suspended</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {allOrgs.filter((o) => o.status === 'active').length} / {allOrgs.filter((o) => o.status === 'suspended').length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Estimated MRR</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">{formatMoney(mrr, 'USD')}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Subscription Plans</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">{plans.length}</p>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg">
        {(['clinics', 'plans', 'payments', 'platform'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize ${tab === k ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
            {k}
          </button>
        ))}
      </div>

      {tab === 'clinics' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Organization</th>
                  <th className="py-3 px-4 font-medium">Type & Slug</th>
                  <th className="py-3 px-4 font-medium">Plan</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {allOrgs.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">{o.name}</p>
                      <p className="text-xs font-mono text-slate-500">{o.id}</p>
                    </td>
                    <td className="py-3 px-4 text-xs capitalize text-slate-600 dark:text-slate-400">{o.type} · {o.slug}</td>
                    <td className="py-3 px-4 text-xs">
                      <select
                        value={o.planId}
                        onChange={(e) => updateOrganizationSettings(o.id, { planId: e.target.value })}
                        className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                        {plans.filter((p) => p.code === 'custom').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-xs capitalize font-medium">
                      <span className={o.status === 'suspended' ? 'text-red-600' : 'text-teal-700 dark:text-teal-400'}>{o.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => updateOrganizationSettings(o.id, { status: o.status === 'suspended' ? 'active' : 'suspended' })}
                        className="px-3 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:border-emerald-500"
                      >
                        {o.status === 'suspended' ? 'Activate Clinic' : 'Suspend Clinic'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">Define monthly/yearly pricing and resource limits per SaaS tier.</p>
            <button type="button" onClick={() => seedDefaultSubscriptionPlans()} className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
              Initialize Default Tiers
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
                <p className="text-xs text-slate-500">{p.audience || p.code}</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{p.name}</h3>
                <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatMoney(p.monthlyPrice, p.currency || 'USD')}<span className="text-xs font-normal text-slate-500">/mo</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                  Doctors: {p.doctorLimit} · Patients: {p.patientLimit} · Branches: {p.branchLimit || 1}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddPlan} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div><label className="block text-xs mb-1">Custom Plan Name</label><input required value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="Diagnostic Pro" className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            <div><label className="block text-xs mb-1">Monthly Price (USD)</label><input type="number" value={newPlanMonthly} onChange={(e) => setNewPlanMonthly(e.target.value)} className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            <div><label className="block text-xs mb-1">Doctor Limit</label><input type="number" value={newPlanDoctors} onChange={(e) => setNewPlanDoctors(e.target.value)} className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            <div><label className="block text-xs mb-1">Patient Limit</label><input type="number" value={newPlanPatients} onChange={(e) => setNewPlanPatients(e.target.value)} className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            <button type="submit" className="inline-flex items-center justify-center gap-1 px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Plan</button>
          </form>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {txs.length === 0 ? (
            <p className="p-10 text-center text-xs text-slate-500">No SaaS subscription transactions logged yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Clinic</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {txs.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3 px-4 font-medium">{tx.organizationName}</td>
                    <td className="py-3 px-4">{tx.planName} ({tx.billingCycle})</td>
                    <td className="py-3 px-4 text-right font-mono">{formatMoney(tx.amount, tx.currency)}</td>
                    <td className="py-3 px-4 capitalize">{tx.status}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {tx.status !== 'approved' && <button type="button" onClick={() => updateTransactionStatus(tx.id, 'approved')} className="text-teal-700 hover:underline">Approve</button>}
                      {tx.status !== 'refunded' && <button type="button" onClick={() => updateTransactionStatus(tx.id, 'refunded')} className="text-red-600 hover:underline">Refund</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'platform' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await savePlatformSettings({
              platformName,
              contactEmail,
              contactPhone: '+1-800-555-0199',
              defaultCurrency: 'USD',
              defaultLanguage: 'en',
              smsProviderMode: smsMode,
              whatsappProviderMode: waMode,
              paymentGatewayMode: payMode,
              maintenanceMode: maintenance,
            });
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-2xl space-y-4"
        >
          <h3 className="text-sm font-semibold">Global Platform & Gateway Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div><label className="block mb-1">Platform Name</label><input value={platformName} onChange={(e) => setPlatformName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            <div><label className="block mb-1">Support Email</label><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            <div><label className="block mb-1">SMS Gateway Mode</label><select value={smsMode} onChange={(e) => setSmsMode(e.target.value as 'disabled' | 'test_mode' | 'configured')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"><option value="disabled">Disabled</option><option value="test_mode">Test Mode</option><option value="configured">Configured</option></select></div>
            <div><label className="block mb-1">WhatsApp Gateway Mode</label><select value={waMode} onChange={(e) => setWaMode(e.target.value as 'disabled' | 'test_mode' | 'configured')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"><option value="disabled">Disabled</option><option value="test_mode">Test Mode</option><option value="configured">Configured</option></select></div>
            <div><label className="block mb-1">Payment Gateway Mode</label><select value={payMode} onChange={(e) => setPayMode(e.target.value as 'manual' | 'test_mode' | 'configured')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"><option value="manual">Manual Approval</option><option value="test_mode">Test Mode</option><option value="configured">Configured</option></select></div>
            <label className="flex items-center gap-2 pt-5"><input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} /> Maintenance Mode</label>
          </div>
          <button type="submit" className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">Save Platform Settings</button>
        </form>
      )}
    </div>
  );
}

// ============================================================================
// SELF-SERVICE PATIENT PORTAL (STRICTLY OWN RECORDS, READ-ONLY CLINICAL DATA)
// ============================================================================
export function PatientPortalView({
  org,
  actor,
  patients,
  doctors,
  appointments,
  prescriptions,
  labOrders,
  invoices,
}: {
  org: Organization;
  actor: TenantActor;
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  invoices: Invoice[];
}) {
  const myPatient = useMemo(
    () => patients.find((p) => p.patientAuthUid === actor.uid) || patients[0] || null,
    [patients, actor.uid]
  );

  const [reqDocId, setReqDocId] = useState(doctors[0]?.id || '');
  const [reqDate, setReqDate] = useState(todayISO());
  const [reqSlot, setReqSlot] = useState('10:00 AM');
  const [reqNotes, setReqNotes] = useState('');
  const [phoneEdit, setPhoneEdit] = useState(myPatient?.phone || '');
  const [msg, setMsg] = useState<string | null>(null);

  if (!myPatient) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
        <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto" />
        <h2 className="text-base font-semibold">No Patient Profile Linked</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Ask your clinic receptionist to link your Firebase User UID (<span className="font-mono">{actor.uid}</span>) to your patient profile, or register a patient in Patients first.
        </p>
      </div>
    );
  }

  const myAppts = appointments.filter((a) => a.patientId === myPatient.id);
  const myRx = prescriptions.filter((r) => r.patientId === myPatient.id);
  const myLabs = labOrders.filter((l) => l.patientId === myPatient.id);
  const myInvs = invoices.filter((i) => i.patientId === myPatient.id);

  const handleRequestAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const docObj = doctors.find((d) => d.id === reqDocId);
    if (!docObj) return;
    await createAppointment(
      org,
      actor,
      {
        patientId: myPatient.id,
        patientName: myPatient.name,
        patientPhone: myPatient.phone,
        patientAuthUid: myPatient.patientAuthUid || actor.uid,
        doctorId: docObj.id,
        doctorName: docObj.name,
        date: reqDate,
        timeSlot: reqSlot,
        type: 'follow_up',
        consultationFee: docObj.followUpFee || docObj.consultationFee,
        status: 'pending',
        paymentStatus: 'unpaid',
        notes: reqNotes || 'Patient Portal appointment request',
        queueToken: appointments.length + 1,
      },
      appointments.length + 1
    );
    setReqNotes('');
    setMsg('Appointment request submitted for clinic confirmation.');
  };

  const handleContactUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePatient(org, actor, { ...myPatient, phone: phoneEdit });
    setMsg('Permitted contact information updated.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-teal-700 dark:text-teal-400 font-medium inline-flex items-center gap-1.5">
            <UserCheck className="w-4 h-4" /> Patient Self-Service Portal · {org.name}
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{myPatient.name}</h2>
          <p className="text-xs font-mono text-slate-500">{myPatient.patientCode} · Blood {myPatient.bloodGroup || '—'} · Read-only clinical records</p>
        </div>
        <form onSubmit={handleContactUpdate} className="flex items-center gap-2">
          <input value={phoneEdit} onChange={(e) => setPhoneEdit(e.target.value)} className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" />
          <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-[#047857] text-white rounded-lg whitespace-nowrap">Update Phone</button>
        </form>
      </div>

      {msg && <p className="text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 p-3 rounded-lg">{msg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">Request Appointment / Follow-Up</h3>
          <form onSubmit={handleRequestAppointment} className="space-y-3 text-xs">
            <div>
              <label className="block mb-1">Doctor</label>
              <select value={reqDocId} onChange={(e) => setReqDocId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block mb-1">Preferred Date</label><input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
              <div><label className="block mb-1">Preferred Slot</label><input value={reqSlot} onChange={(e) => setReqSlot(e.target.value)} className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            </div>
            <div><label className="block mb-1">Reason / Symptoms</label><input value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Follow-up consultation" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950" /></div>
            <button type="submit" className="w-full py-2 font-medium bg-[#047857] text-white rounded-lg">Submit Appointment Request</button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-2">My Appointments ({myAppts.length})</h3>
            {myAppts.length === 0 ? <p className="text-xs text-slate-500">None yet.</p> : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {myAppts.map((a) => (
                  <div key={a.id} className="py-2 flex justify-between">
                    <span><strong>{a.doctorName}</strong> · <span className="font-mono">{a.date} {a.timeSlot}</span></span>
                    <span className="capitalize text-emerald-700 dark:text-emerald-400">{a.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-2">My Prescriptions ({myRx.length}) & Lab Reports ({myLabs.length})</h3>
            <div className="space-y-2 text-xs">
              {myRx.map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                  <div>
                    <p className="font-medium">{r.diagnosis || 'Prescription'} · <span className="font-mono">{r.rxNumber}</span></p>
                    <p className="text-slate-500">{r.doctorName} · {r.medicines.map((m) => m.name).join(', ')}</p>
                  </div>
                  <span className="capitalize text-teal-700">{r.status}</span>
                </div>
              ))}
              {myLabs.map((l) => (
                <div key={l.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                  <div>
                    <p className="font-medium">Lab Report · <span className="font-mono">{l.orderNumber}</span></p>
                    <p className="text-slate-500">{l.tests.map((t) => `${t.name}: ${t.resultValue || 'Pending'} ${t.unit}`).join(' · ')}</p>
                  </div>
                  <span className="capitalize text-emerald-700">{l.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-2">My Billing & Payments ({myInvs.length})</h3>
            {myInvs.length === 0 ? <p className="text-xs text-slate-500">No invoices yet.</p> : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {myInvs.map((inv) => (
                  <div key={inv.id} className="py-2 flex justify-between font-mono">
                    <span>{inv.invoiceNumber}</span>
                    <span>Total {formatMoney(inv.totalAmount, org.currency)} · Due {formatMoney(inv.dueAmount, org.currency)} ({inv.status})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
