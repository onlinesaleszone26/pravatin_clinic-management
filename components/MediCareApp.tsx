'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarClock,
  FileText,
  FlaskConical,
  Receipt,
  Pill,
  BedDouble,
  ShieldCheck,
  Building2,
  Bell,
  BarChart3,
  Settings,
  UserCircle2,
  Crown,
  Search,
  Sun,
  Moon,
  LogOut,
  Plus,
  Menu,
  X,
  ArrowLeft,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import {
  auth,
  db,
  testFirestoreConnection,
  signOutUser,
  handleFirestoreError,
  OperationType,
  SUPER_ADMIN_EMAIL,
} from '@/lib/firebase';
import { ensureUserProfile, updateUserPrefs, acceptStaffInvite, TenantActor } from '@/lib/firestore-service';
import { t, Lang } from '@/lib/i18n';
import {
  DEFAULT_ROLE_MODULES,
  ROLE_LABELS,
  type Organization,
  type OrganizationMember,
  type CustomRole,
  type Branch,
  type Patient,
  type Doctor,
  type Appointment,
  type Prescription,
  type LabTest,
  type LabOrder,
  type Invoice,
  type Expense,
  type PharmacyItem,
  type Bed,
  type NotificationRecord,
  type AuditLog,
  type StaffInvite,
  type ModuleKey,
  type StaffRole,
} from '@/lib/types';
import { AuthScreen, ClinicRegistrationModal } from './AuthOnboarding';
import { PravaclinLoader } from './PravaclinLoader';
import { ClinicDashboard } from './ClinicDashboard';
import { PatientsModule } from './PatientsModule';
import { DoctorsModule } from './DoctorsModule';
import { AppointmentsModule } from './AppointmentsModule';
import { PrescriptionsModule } from './PrescriptionsModule';
import { LabModule } from './LabModule';
import { BillingModule } from './BillingModule';
import { PharmacyModule } from './PharmacyModule';
import {
  BedsModule,
  StaffAndRbacModule,
  BranchesModule,
  NotificationsModule,
} from './OperationsModule';
import {
  ReportsModule,
  ClinicSettingsModule,
  SuperAdminConsole,
  PatientPortalView,
} from './ReportsAndSettings';

interface NavItem {
  key: ModuleKey;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'clinical' | 'operations' | 'admin';
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, group: 'clinical' },
  { key: 'patients', labelKey: 'patients', icon: Users, group: 'clinical' },
  { key: 'doctors', labelKey: 'doctors', icon: Stethoscope, group: 'clinical' },
  { key: 'appointments', labelKey: 'appointments', icon: CalendarClock, group: 'clinical' },
  { key: 'prescriptions', labelKey: 'prescriptions', icon: FileText, group: 'clinical' },
  { key: 'laboratory', labelKey: 'laboratory', icon: FlaskConical, group: 'clinical' },
  { key: 'billing', labelKey: 'billing', icon: Receipt, group: 'operations' },
  { key: 'pharmacy', labelKey: 'pharmacy', icon: Pill, group: 'operations' },
  { key: 'beds', labelKey: 'beds', icon: BedDouble, group: 'operations' },
  { key: 'notifications', labelKey: 'notifications', icon: Bell, group: 'operations' },
  { key: 'staff', labelKey: 'staff', icon: ShieldCheck, group: 'admin' },
  { key: 'branches', labelKey: 'branches', icon: Building2, group: 'admin' },
  { key: 'reports', labelKey: 'reports', icon: BarChart3, group: 'admin' },
  { key: 'settings', labelKey: 'settings', icon: Settings, group: 'admin' },
  { key: 'patient_portal', labelKey: 'patientPortal', icon: UserCircle2, group: 'admin' },
];

export function MediCareApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [activeOrgId, setActiveOrgId] = useState<string>('');
  const [showNewClinic, setShowNewClinic] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [navHistory, setNavHistory] = useState<ModuleKey[]>([]);
  const [previewRole, setPreviewRole] = useState<StaffRole | null>(null);
  const lang: Lang = 'en';
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');

  // Cross-module handoff prefill
  const [prefillRxApt, setPrefillRxApt] = useState<Appointment | null>(null);
  const [prefillInvApt, setPrefillInvApt] = useState<Appointment | null>(null);

  // Tenant-scoped live Firestore collections
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pharmacy, setPharmacy] = useState<PharmacyItem[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [myPendingInvites, setMyPendingInvites] = useState<StaffInvite[]>([]);
  const [orgInvites, setOrgInvites] = useState<StaffInvite[]>([]);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [inviteBannerMsg, setInviteBannerMsg] = useState<string | null>(null);

  const isSuperAdmin = Boolean(user?.email === SUPER_ADMIN_EMAIL && user?.emailVerified);

  // 1. Test Firestore connectivity and subscribe to Auth state
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await ensureUserProfile(u);
      } else {
        setOrgs([]);
        setOrgsLoaded(false);
        setActiveOrgId('');
        setMyPendingInvites([]);
        setOrgInvites([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 2. Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // 3. Subscribe to organizations accessible to this authenticated user
  useEffect(() => {
    if (!authReady || !user) return;
    const q = query(collection(db, 'organizations'), where('authorizedUids', 'array-contains', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Organization, 'id'>) }));
        setOrgs(list);
        setOrgsLoaded(true);
        setActiveOrgId((prev) => {
          if (prev && list.some((o) => o.id === prev)) return prev;
          return list[0]?.id || '';
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'organizations')
    );
    return () => unsub();
  }, [authReady, user]);

  const activeOrg = useMemo(() => orgs.find((o) => o.id === activeOrgId) || null, [orgs, activeOrgId]);

  // 4. Subscribe to ALL tenant-scoped subcollections for the active organization
  useEffect(() => {
    if (!authReady || !user || !activeOrgId) return;

    const sub = <T,>(subcol: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      const path = `organizations/${activeOrgId}/${subcol}`;
      const q = query(collection(db, 'organizations', activeOrgId, subcol), where('authorizedUids', 'array-contains', user.uid));
      return onSnapshot(
        q,
        (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, 'id'>) }) as T)),
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
    };

    const unsubs = [
      sub<OrganizationMember>('members', setMembers),
      sub<CustomRole>('roles', setCustomRoles),
      sub<Branch>('branches', setBranches),
      sub<Patient>('patients', setPatients),
      sub<Doctor>('doctors', setDoctors),
      sub<Appointment>('appointments', setAppointments),
      sub<Prescription>('prescriptions', setPrescriptions),
      sub<LabTest>('labTests', setLabTests),
      sub<LabOrder>('labOrders', setLabOrders),
      sub<Invoice>('invoices', setInvoices),
      sub<Expense>('expenses', setExpenses),
      sub<PharmacyItem>('pharmacyInventory', setPharmacy),
      sub<Bed>('beds', setBeds),
      sub<NotificationRecord>('notifications', setNotifications),
      sub<AuditLog>('auditLogs', setAuditLogs),
    ];

    // Single-field query avoids composite index errors while satisfying firestore.rules
    const invQ = query(collection(db, 'staffInvites'), where('authorizedUids', 'array-contains', user.uid));
    const unsubInvites = onSnapshot(
      invQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffInvite, 'id'>) }))
          .filter((inv) => inv.organizationId === activeOrgId);
        setOrgInvites(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'staffInvites')
    );

    return () => {
      unsubs.forEach((fn) => fn());
      unsubInvites();
    };
  }, [authReady, user, activeOrgId]);

  // 5. Subscribe to incoming verified staff invitations addressed to the signed-in user's email
  useEffect(() => {
    if (!authReady || !user?.email || !user.emailVerified) return;
    const emailNorm = user.email.toLowerCase();
    // Single-field query avoids composite index errors; filter status === 'pending' client-side
    const q = query(collection(db, 'staffInvites'), where('invitedEmail', '==', emailNorm));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const pending = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffInvite, 'id'>) }))
          .filter((inv) => inv.status === 'pending');
        setMyPendingInvites(pending);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'staffInvites')
    );
    return () => unsub();
  }, [authReady, user]);

  const myMember = useMemo(() => members.find((m) => m.uid === user?.uid), [members, user?.uid]);
  const actualRole: StaffRole = myMember?.role || (activeOrg?.ownerUid === user?.uid ? 'clinic_owner' : 'receptionist');
  const effectiveRole: StaffRole = previewRole || actualRole;

  const actor: TenantActor = useMemo(
    () => ({
      uid: user?.uid || '',
      name: user?.displayName || user?.email?.split('@')[0] || 'Clinic User',
      email: user?.email || '',
      role: actualRole,
    }),
    [user, actualRole]
  );

  // Permitted navigation items based on effective role + enabled optional modules
  const visibleNav = useMemo(() => {
    const allowed = DEFAULT_ROLE_MODULES[effectiveRole] || DEFAULT_ROLE_MODULES.receptionist;
    return NAV_ITEMS.filter((item) => {
      if (!allowed.includes(item.key)) return false;
      if (item.key === 'pharmacy' && activeOrg?.enablePharmacy === false) return false;
      if (item.key === 'beds' && activeOrg?.enableInpatient === false) return false;
      return true;
    });
  }, [effectiveRole, activeOrg]);

  // Tenant-scoped Global Search results
  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (q.length < 2) return null;
    return {
      patients: patients.filter((p) => p.name.toLowerCase().includes(q) || p.patientCode.toLowerCase().includes(q) || p.phone.includes(q)).slice(0, 4),
      doctors: doctors.filter((d) => d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q)).slice(0, 3),
      prescriptions: prescriptions.filter((r) => r.rxNumber.toLowerCase().includes(q) || r.patientName.toLowerCase().includes(q)).slice(0, 3),
      labOrders: labOrders.filter((l) => l.orderNumber.toLowerCase().includes(q) || l.patientName.toLowerCase().includes(q)).slice(0, 3),
      invoices: invoices.filter((i) => i.invoiceNumber.toLowerCase().includes(q) || i.patientName.toLowerCase().includes(q)).slice(0, 3),
    };
  }, [globalQuery, patients, doctors, prescriptions, labOrders, invoices]);

  // Loading Splash with Rotating Pravaclin Logo
  if (!authReady) {
    return <PravaclinLoader message="Connecting to Pravaclin..." />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!orgsLoaded) {
    return <PravaclinLoader message="Loading your clinics..." />;
  }

  const handleAcceptInvite = async (inv: StaffInvite) => {
    if (!user) return;
    setAcceptingInviteId(inv.id);
    setInviteBannerMsg(null);
    try {
      await acceptStaffInvite(inv, user);
      setActiveOrgId(inv.organizationId);
      setShowNewClinic(false);
      setActiveModule('dashboard');
      setInviteBannerMsg(`Joined ${inv.organizationName} as ${ROLE_LABELS[inv.role]?.en || inv.role}.`);
    } catch (err) {
      setInviteBannerMsg(err instanceof Error ? err.message : 'Unable to accept invitation.');
    } finally {
      setAcceptingInviteId(null);
    }
  };

  if (showNewClinic || orgs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {myPendingInvites.length > 0 && (
          <div className="max-w-2xl mx-auto pt-6 px-4 space-y-3">
            {myPendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="bg-white dark:bg-slate-900 border-2 border-[#047857] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#047857]/10 text-[#047857] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      You have a verified invitation to join {inv.organizationName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Role: <strong className="text-slate-800 dark:text-slate-200">{ROLE_LABELS[inv.role]?.en || inv.role}</strong> · Code:{' '}
                      <span className="font-mono">{inv.inviteCode}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={acceptingInviteId === inv.id}
                  onClick={() => handleAcceptInvite(inv)}
                  className="px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg whitespace-nowrap"
                >
                  {acceptingInviteId === inv.id ? 'Joining...' : 'Accept & Join Clinic'}
                </button>
              </div>
            ))}
          </div>
        )}
        <ClinicRegistrationModal
          actor={actor}
          onCreated={(newOrgId) => {
            setActiveOrgId(newOrgId);
            setShowNewClinic(false);
            setActiveModule('dashboard');
          }}
          onCancel={orgs.length > 0 ? () => setShowNewClinic(false) : undefined}
        />
      </div>
    );
  }

  if (!activeOrg) return null;

  const getModuleLabel = (key: ModuleKey) =>
    key === 'super_admin'
      ? t(lang, 'superAdmin')
      : t(lang, NAV_ITEMS.find((n) => n.key === key)?.labelKey || 'dashboard');

  const currentNavLabel = getModuleLabel(activeModule);

  const handleSelectNav = (key: ModuleKey) => {
    if (key !== activeModule) {
      setNavHistory((prev) => [...prev.slice(-19), activeModule]);
      setActiveModule(key);
    }
    setMobileMenuOpen(false);
    setGlobalQuery('');
  };

  const canGoBack = navHistory.length > 0 || activeModule !== 'dashboard';
  const previousModule: ModuleKey = navHistory.length > 0 ? navHistory[navHistory.length - 1] : 'dashboard';
  const previousLabel = getModuleLabel(previousModule);

  const handleGoBack = () => {
    if (navHistory.length > 0) {
      const target = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      setActiveModule(target);
    } else if (activeModule !== 'dashboard') {
      setActiveModule('dashboard');
    }
    setGlobalQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Left Desktop Sidebar (Collapsible on Mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#047857] dark:bg-[#022c22] border-r border-white/15 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand & Tenant Switcher */}
        <div className="p-4 border-b border-white/15 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm p-1">
                <Image
                  src="/assets/pravaclin-logo.jpg"
                  alt="Pravaclin Logo"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain rounded-full transition-transform duration-700 group-hover:rotate-180"
                  referrerPolicy="no-referrer"
                  priority
                />
              </div>
              <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
                Pravaclin
              </span>
            </div>
            <button type="button" onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-emerald-100 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              aria-label="Switch active clinic"
              value={activeOrg.id}
              onChange={(e) => {
                setActiveOrgId(e.target.value);
                setNavHistory([]);
                setActiveModule('dashboard');
                updateUserPrefs(user.uid, { activeOrgId: e.target.value });
              }}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-white/25 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/40 truncate"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id} className="bg-white text-slate-900">
                  {o.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewClinic(true)}
              title={t(lang, 'newClinic')}
              className="p-1.5 rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {(['clinical', 'operations', 'admin'] as const).map((group) => {
            const items = visibleNav.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-1">
                <p className="px-3 text-xs font-medium text-emerald-200/90">
                  {group === 'clinical' ? t(lang, 'clinicalGroup') : group === 'operations' ? t(lang, 'operationsGroup') : t(lang, 'adminGroup')}
                </p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectNav(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-white text-[#047857] font-semibold shadow-sm'
                          : 'text-emerald-50 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{t(lang, item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {isSuperAdmin && (
            <div className="pt-3 border-t border-white/15">
              <button
                type="button"
                onClick={() => handleSelectNav('super_admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  activeModule === 'super_admin'
                    ? 'bg-white text-[#047857] font-semibold shadow-sm'
                    : 'text-emerald-50 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Crown className={`w-4 h-4 shrink-0 ${activeModule === 'super_admin' ? 'text-amber-500' : 'text-amber-300'}`} />
                <span>{t(lang, 'superAdmin')}</span>
              </button>
            </div>
          )}
        </nav>

        {/* Role Perspective & User Footer */}
        <div className="p-3 border-t border-white/15 space-y-2.5">
          {actualRole === 'clinic_owner' && (
            <div>
              <label className="block text-xs text-emerald-200 mb-1">Role Workspace View</label>
              <select
                value={effectiveRole}
                onChange={(e) => {
                  const nextRole = e.target.value as StaffRole;
                  setPreviewRole(nextRole === actualRole ? null : nextRole);
                  setActiveModule(nextRole === 'patient' ? 'patient_portal' : 'dashboard');
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-white/25 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-white text-slate-900">
                    {v.en}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{actor.name}</p>
              <p className="text-xs text-emerald-200 truncate">{ROLE_LABELS[actualRole]?.en}</p>
            </div>
            <button
              type="button"
              onClick={() => signOutUser()}
              title={t(lang, 'signOut')}
              className="p-1.5 text-emerald-100 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden no-print" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar (Clean Breadcrumb + Global Search + Compact Controls) */}
        <header className="sticky top-0 z-20 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-1.5 text-slate-600 dark:text-slate-300">
              <Menu className="w-5 h-5" />
            </button>
            {canGoBack && (
              <button
                type="button"
                onClick={handleGoBack}
                title={`${t(lang, 'back')} (${previousLabel})`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#047857] hover:bg-[#065f46] text-white transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t(lang, 'back')}</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline truncate max-w-[180px]">{activeOrg.name}</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-white truncate">{currentNavLabel}</h1>
            </div>
          </div>

          {/* Tenant-Scoped Global Search */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder={t(lang, 'searchGlobal')}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {searchResults && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 space-y-2.5 z-50 text-xs">
                {searchResults.patients.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Patients</p>
                    {searchResults.patients.map((p) => (
                      <button key={p.id} type="button" onClick={() => handleSelectNav('patients')} className="w-full text-left py-1 hover:text-emerald-700 flex justify-between">
                        <span>{p.name}</span>
                        <span className="font-mono text-slate-500">{p.patientCode}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.doctors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Doctors</p>
                    {searchResults.doctors.map((d) => (
                      <button key={d.id} type="button" onClick={() => handleSelectNav('doctors')} className="w-full text-left py-1 hover:text-emerald-700 flex justify-between">
                        <span>{d.name}</span>
                        <span className="text-slate-500">{d.specialization}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.prescriptions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Prescriptions</p>
                    {searchResults.prescriptions.map((r) => (
                      <button key={r.id} type="button" onClick={() => handleSelectNav('prescriptions')} className="w-full text-left py-1 hover:text-emerald-700 flex justify-between">
                        <span>{r.patientName}</span>
                        <span className="font-mono text-slate-500">{r.rxNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.labOrders.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Lab Orders</p>
                    {searchResults.labOrders.map((l) => (
                      <button key={l.id} type="button" onClick={() => handleSelectNav('laboratory')} className="w-full text-left py-1 hover:text-emerald-700 flex justify-between">
                        <span>{l.patientName}</span>
                        <span className="font-mono text-slate-500">{l.orderNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.invoices.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">Invoices</p>
                    {searchResults.invoices.map((inv) => (
                      <button key={inv.id} type="button" onClick={() => handleSelectNav('billing')} className="w-full text-left py-1 hover:text-emerald-700 flex justify-between">
                        <span>{inv.patientName}</span>
                        <span className="font-mono text-slate-500">{inv.invoiceNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.patients.length === 0 &&
                  searchResults.doctors.length === 0 &&
                  searchResults.prescriptions.length === 0 &&
                  searchResults.labOrders.length === 0 &&
                  searchResults.invoices.length === 0 && (
                    <p className="text-slate-500 py-1">No matching records in {activeOrg.name}.</p>
                  )}
              </div>
            )}
          </div>

          {/* Theme Control */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label="Toggle color theme"
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-emerald-500"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {inviteBannerMsg && (
            <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2 no-print">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {inviteBannerMsg}
              </span>
              <button type="button" onClick={() => setInviteBannerMsg(null)} className="hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {myPendingInvites.length > 0 && (
            <div className="mb-4 space-y-2 no-print">
              {myPendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-slate-900 border border-[#047857]/40 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    <Mail className="w-4 h-4 text-[#047857] shrink-0" />
                    <span className="text-slate-700 dark:text-slate-200">
                      Invited to join <strong>{inv.organizationName}</strong> as{' '}
                      <strong>{ROLE_LABELS[inv.role]?.en || inv.role}</strong> (Code:{' '}
                      <span className="font-mono">{inv.inviteCode}</span>)
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={acceptingInviteId === inv.id}
                    onClick={() => handleAcceptInvite(inv)}
                    className="px-3.5 py-1.5 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg whitespace-nowrap"
                  >
                    {acceptingInviteId === inv.id ? 'Joining...' : 'Accept & Join Clinic'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {canGoBack && activeOrg.status !== 'suspended' && (
            <div className="mb-4 flex items-center justify-between gap-3 no-print">
              <button
                type="button"
                onClick={handleGoBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#047857] hover:text-[#047857] dark:hover:text-emerald-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  {t(lang, 'back')} · {previousLabel}
                </span>
              </button>
              {previousModule !== 'dashboard' && activeModule !== 'dashboard' && (
                <button
                  type="button"
                  onClick={() => {
                    setNavHistory([]);
                    setActiveModule('dashboard');
                  }}
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[#047857] dark:hover:text-emerald-400 hover:underline"
                >
                  {t(lang, 'backToDashboard')}
                </button>
              )}
            </div>
          )}
          {activeOrg.status === 'suspended' && activeModule !== 'super_admin' ? (
            <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl p-8 text-center space-y-2">
              <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Organization Access Suspended</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {activeOrg.name} is currently suspended. Your clinical data remains preserved under the grace period policy. Contact the platform Super Admin to reactivate.
              </p>
            </div>
          ) : (
            <>
              {activeModule === 'dashboard' && (
                <ClinicDashboard
                  org={activeOrg}
                  actor={actor}
                  lang={lang}
                  patients={patients}
                  doctors={doctors}
                  appointments={appointments}
                  prescriptions={prescriptions}
                  labOrders={labOrders}
                  invoices={invoices}
                  expenses={expenses}
                  pharmacy={pharmacy}
                  onNavigate={handleSelectNav}
                />
              )}

              {activeModule === 'patients' && (
                <PatientsModule
                  org={activeOrg}
                  actor={actor}
                  patients={patients}
                  doctors={doctors}
                  branches={branches}
                  appointments={appointments}
                  prescriptions={prescriptions}
                  labOrders={labOrders}
                  invoices={invoices}
                />
              )}

              {activeModule === 'doctors' && (
                <DoctorsModule
                  org={activeOrg}
                  actor={actor}
                  doctors={doctors}
                  branches={branches}
                  appointments={appointments}
                />
              )}

              {activeModule === 'appointments' && (
                <AppointmentsModule
                  org={activeOrg}
                  actor={actor}
                  patients={patients}
                  doctors={doctors}
                  branches={branches}
                  appointments={appointments}
                  onStartPrescription={(apt) => {
                    setPrefillRxApt(apt);
                    handleSelectNav('prescriptions');
                  }}
                  onStartInvoice={(apt) => {
                    setPrefillInvApt(apt);
                    handleSelectNav('billing');
                  }}
                />
              )}

              {activeModule === 'prescriptions' && (
                <PrescriptionsModule
                  org={activeOrg}
                  actor={actor}
                  patients={patients}
                  doctors={doctors}
                  prescriptions={prescriptions}
                  prefillAppointment={prefillRxApt}
                  onClearPrefill={() => setPrefillRxApt(null)}
                />
              )}

              {activeModule === 'laboratory' && (
                <LabModule
                  org={activeOrg}
                  actor={actor}
                  patients={patients}
                  doctors={doctors}
                  labTests={labTests}
                  labOrders={labOrders}
                />
              )}

              {activeModule === 'billing' && (
                <BillingModule
                  org={activeOrg}
                  actor={actor}
                  patients={patients}
                  invoices={invoices}
                  expenses={expenses}
                  prefillAppointment={prefillInvApt}
                  onClearPrefill={() => setPrefillInvApt(null)}
                />
              )}

              {activeModule === 'pharmacy' && (
                <PharmacyModule
                  org={activeOrg}
                  actor={actor}
                  items={pharmacy}
                  patients={patients}
                  prescriptions={prescriptions}
                  invoices={invoices}
                />
              )}

              {activeModule === 'beds' && (
                <BedsModule org={activeOrg} actor={actor} beds={beds} patients={patients} doctors={doctors} />
              )}

              {activeModule === 'staff' && (
                <StaffAndRbacModule
                  org={activeOrg}
                  actor={actor}
                  members={members}
                  customRoles={customRoles}
                  branches={branches}
                  invites={orgInvites}
                />
              )}

              {activeModule === 'branches' && (
                <BranchesModule org={activeOrg} actor={actor} branches={branches} />
              )}

              {activeModule === 'notifications' && (
                <NotificationsModule
                  org={activeOrg}
                  actor={actor}
                  notifications={notifications}
                  patients={patients}
                />
              )}

              {activeModule === 'reports' && (
                <ReportsModule
                  org={activeOrg}
                  patients={patients}
                  doctors={doctors}
                  appointments={appointments}
                  prescriptions={prescriptions}
                  labOrders={labOrders}
                  invoices={invoices}
                  expenses={expenses}
                  pharmacy={pharmacy}
                  auditLogs={auditLogs}
                />
              )}

              {activeModule === 'settings' && (
                <ClinicSettingsModule
                  key={activeOrg.id}
                  org={activeOrg}
                  actor={actor}
                  theme={theme}
                  onThemeChange={setTheme}
                />
              )}

              {activeModule === 'patient_portal' && (
                <PatientPortalView
                  org={activeOrg}
                  actor={actor}
                  patients={patients}
                  doctors={doctors}
                  appointments={appointments}
                  prescriptions={prescriptions}
                  labOrders={labOrders}
                  invoices={invoices}
                />
              )}

              {activeModule === 'super_admin' && isSuperAdmin && <SuperAdminConsole />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
