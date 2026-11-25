'use client';

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import {
  BedDouble,
  CalendarClock,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Pill,
  Receipt,
  Settings,
  Shield,
  Stethoscope,
  Sun,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  auth,
  isFirebaseConfigured,
  SUPER_ADMIN_EMAIL,
  testFirestoreConnection,
} from '@/lib/firebase';
import {
  createOrganizationWithOwner,
  createStaffInviteDoc,
  createTenantDoc,
  deleteTenantDoc,
  listTenantCollection,
  listUserOrganizations,
  updateOrganizationDoc,
  updateTenantDoc,
} from '@/lib/firestore-service';
import {
  DEMO_USER,
  INITIAL_APPOINTMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_BEDS,
  INITIAL_BRANCHES,
  INITIAL_DOCTORS,
  INITIAL_EXPENSES,
  INITIAL_INVITES,
  INITIAL_INVOICES,
  INITIAL_LAB_ORDERS,
  INITIAL_LAB_TESTS,
  INITIAL_MEMBERS,
  INITIAL_ORGANIZATION,
  INITIAL_PATIENTS,
  INITIAL_PHARMACY,
  INITIAL_PHARMACY_SALES,
  INITIAL_PLANS,
  INITIAL_PRESCRIPTIONS,
} from '@/lib/demo-data';
import type {
  ActiveModule,
  Appointment,
  AppointmentStatus,
  AuditLog,
  Bed,
  Branch,
  CurrencyCode,
  Doctor,
  Expense,
  Invoice,
  InvoicePayment,
  LabOrder,
  LabOrderTestItem,
  LabTest,
  Organization,
  OrganizationMember,
  Patient,
  PharmacyItem,
  PharmacySale,
  Prescription,
  StaffInvite,
  StaffRole,
} from '@/lib/types';
import { downloadFile, generateValidId, getTodayIsoDate } from '@/lib/utils';
import { AuthScreen } from './AuthScreen';
import { DashboardView } from './modules/DashboardView';
import { PatientsView } from './modules/PatientsView';
import { DoctorsView } from './modules/DoctorsView';
import { AppointmentsView } from './modules/AppointmentsView';
import { PrescriptionsView } from './modules/PrescriptionsView';
import { LabView } from './modules/LabView';
import { BillingView } from './modules/BillingView';
import { PharmacyView } from './modules/PharmacyView';
import { BedsView } from './modules/BedsView';
import {
  PatientPortalView,
  SettingsView,
  StaffView,
  SuperAdminView,
} from './modules/StaffAndAdminView';

const NAV_ITEMS: { id: ActiveModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients & EMR', icon: Users },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
  { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
  { id: 'laboratory', label: 'Laboratory', icon: FlaskConical },
  { id: 'billing', label: 'Billing & Expenses', icon: Receipt },
  { id: 'pharmacy', label: 'Pharmacy & POS', icon: Pill },
  { id: 'beds', label: 'Inpatient Beds', icon: BedDouble },
  { id: 'staff', label: 'Staff & RBAC', icon: UserCog },
  { id: 'settings', label: 'Settings & Audit', icon: Settings },
  { id: 'patient_portal', label: 'Patient Portal', icon: UserCheck },
  { id: 'super_admin', label: 'Super Admin', icon: Shield },
];

export function PravaclinApp() {
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [demoMode, setDemoMode] = useState(!isFirebaseConfigured);

  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [hideFinancials, setHideFinancials] = useState(false);

  // Tenant Clinical State
  const [organization, setOrganization] = useState<Organization>(INITIAL_ORGANIZATION);
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [members, setMembers] = useState<OrganizationMember[]>(INITIAL_MEMBERS);
  const [invites, setInvites] = useState<StaffInvite[]>(INITIAL_INVITES);
  const [doctors, setDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(INITIAL_PRESCRIPTIONS);
  const [labTests, setLabTests] = useState<LabTest[]>(INITIAL_LAB_TESTS);
  const [labOrders, setLabOrders] = useState<LabOrder[]>(INITIAL_LAB_ORDERS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [pharmacyItems, setPharmacyItems] = useState<PharmacyItem[]>(INITIAL_PHARMACY);
  const [pharmacySales, setPharmacySales] = useState<PharmacySale[]>(INITIAL_PHARMACY_SALES);
  const [beds, setBeds] = useState<Bed[]>(INITIAL_BEDS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  const [rxPrefill, setRxPrefill] = useState<{
    patientId: string;
    doctorId: string;
    appointmentId?: string;
  } | null>(null);
  const [billPrefill, setBillPrefill] = useState<{
    patientId: string;
    description: string;
    amount: number;
  } | null>(null);

  const isLiveCloud = isFirebaseConfigured && Boolean(firebaseUser) && !demoMode;
  const activeUid = firebaseUser?.uid || DEMO_USER.uid;
  const activeActorName = firebaseUser?.displayName || firebaseUser?.email || DEMO_USER.displayName;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        setDemoMode(false);
        try {
          const orgs = await listUserOrganizations(user.uid);
          let activeOrg = orgs[0];
          if (!activeOrg) {
            const newOrgId = generateValidId('org');
            const createdOrg: Organization = {
              ...INITIAL_ORGANIZATION,
              id: newOrgId,
              name: `${user.displayName || 'Pravaclin'} Medical Clinic`,
              slug: `clinic-${newOrgId.slice(-6).toLowerCase()}`,
              ownerUid: user.uid,
              authorizedUids: [user.uid],
              email: user.email || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await createOrganizationWithOwner(
              createdOrg,
              user.displayName || 'Clinic Owner',
              user.email || ''
            );
            activeOrg = createdOrg;
          }
          setOrganization(activeOrg);
          const [p, d, a, rx, lt, lo, inv, exp, ph, bd, mem, br, aud] = await Promise.all([
            listTenantCollection<Patient>(activeOrg.id, 'patients', user.uid),
            listTenantCollection<Doctor>(activeOrg.id, 'doctors', user.uid),
            listTenantCollection<Appointment>(activeOrg.id, 'appointments', user.uid),
            listTenantCollection<Prescription>(activeOrg.id, 'prescriptions', user.uid),
            listTenantCollection<LabTest>(activeOrg.id, 'labTests', user.uid),
            listTenantCollection<LabOrder>(activeOrg.id, 'labOrders', user.uid),
            listTenantCollection<Invoice>(activeOrg.id, 'invoices', user.uid),
            listTenantCollection<Expense>(activeOrg.id, 'expenses', user.uid),
            listTenantCollection<PharmacyItem>(activeOrg.id, 'pharmacyInventory', user.uid),
            listTenantCollection<Bed>(activeOrg.id, 'beds', user.uid),
            listTenantCollection<OrganizationMember>(activeOrg.id, 'members', user.uid),
            listTenantCollection<Branch>(activeOrg.id, 'branches', user.uid),
            listTenantCollection<AuditLog>(activeOrg.id, 'auditLogs', user.uid),
          ]);
          setPatients(p);
          setDoctors(d);
          setAppointments(a);
          setPrescriptions(rx);
          setLabTests(lt);
          setLabOrders(lo);
          setInvoices(inv);
          setExpenses(exp);
          setPharmacyItems(ph);
          setBeds(bd);
          setMembers(mem);
          setBranches(br);
          setAuditLogs(aud);
        } catch (err) {
          console.error('Failed loading tenant workspace:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  const appendAudit = (action: string, moduleName: string, summary: string, entityId?: string) => {
    const id = generateValidId('aud');
    const entry: AuditLog = {
      id,
      organizationId: organization.id,
      ownerUid: organization.ownerUid,
      authorizedUids: organization.authorizedUids,
      action,
      module: moduleName,
      entityId,
      summary,
      actorUid: activeUid,
      actorName: activeActorName,
      actorRole: 'clinic_owner',
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [entry, ...prev]);
    if (isLiveCloud) {
      void createTenantDoc(organization.id, 'auditLogs', id, entry as unknown as Record<string, unknown>);
    }
  };

  const baseTenantFields = () => ({
    organizationId: organization.id,
    ownerUid: organization.ownerUid,
    authorizedUids: organization.authorizedUids,
    createdByUid: activeUid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Loading Pravaclin workspace...
      </div>
    );
  }

  if (!firebaseUser && !demoMode) {
    return <AuthScreen onEnterDemo={() => setDemoMode(true)} />;
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.id === 'pharmacy' && organization.enablePharmacy === false) return false;
    if (item.id === 'beds' && organization.enableInpatient === false) return false;
    if (
      item.id === 'super_admin' &&
      isLiveCloud &&
      firebaseUser?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeModule)?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight truncate">Pravaclin</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {organization.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {isLiveCloud ? 'Cloud Firestore Live' : 'Interactive Clinic Workspace'}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveModule(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeActorName}
            </p>
            <p className="text-xs text-slate-500 truncate">Clinic Owner</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (firebaseUser && auth) {
                void signOut(auth);
              } else {
                setDemoMode(false);
              }
            }}
            title="Sign out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Pravaclin</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Currency selector"
              value={organization.currency}
              onChange={(e) => {
                const nextCurrency = e.target.value as CurrencyCode;
                setOrganization((prev) => ({ ...prev, currency: nextCurrency }));
                if (isLiveCloud) {
                  void updateOrganizationDoc(organization.id, { currency: nextCurrency });
                }
              }}
              className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="BDT">BDT (৳)</option>
            </select>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Active Module Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeModule === 'dashboard' && (
            <DashboardView
              currency={organization.currency}
              hideFinancials={hideFinancials}
              onToggleFinancials={() => setHideFinancials((prev) => !prev)}
              patients={patients}
              appointments={appointments}
              invoices={invoices}
              expenses={expenses}
              labOrders={labOrders}
              pharmacyItems={pharmacyItems}
              pharmacySales={pharmacySales}
              beds={beds}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === 'patients' && (
            <PatientsView
              patients={patients}
              doctors={doctors}
              appointments={appointments}
              prescriptions={prescriptions}
              labOrders={labOrders}
              invoices={invoices}
              currency={organization.currency}
              hideFinancials={hideFinancials}
              onSavePatient={(data, existingId) => {
                if (existingId) {
                  setPatients((prev) =>
                    prev.map((p) =>
                      p.id === existingId ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
                    )
                  );
                  if (isLiveCloud) {
                    void updateTenantDoc(
                      organization.id,
                      'patients',
                      existingId,
                      data as unknown as Record<string, unknown>
                    );
                  }
                  appendAudit('UPDATE_PATIENT', 'patients', `Updated patient ${data.name}`, existingId);
                } else {
                  const id = generateValidId('pat');
                  const next: Patient = { id, ...baseTenantFields(), ...data };
                  setPatients((prev) => [next, ...prev]);
                  if (isLiveCloud) {
                    void createTenantDoc(
                      organization.id,
                      'patients',
                      id,
                      next as unknown as Record<string, unknown>
                    );
                  }
                  appendAudit('CREATE_PATIENT', 'patients', `Registered patient ${data.name}`, id);
                }
              }}
              onDeletePatient={(id) => {
                const target = patients.find((p) => p.id === id);
                setPatients((prev) => prev.filter((p) => p.id !== id));
                if (isLiveCloud) void deleteTenantDoc(organization.id, 'patients', id);
                if (target) appendAudit('DELETE_PATIENT', 'patients', `Removed patient ${target.name}`, id);
              }}
            />
          )}

          {activeModule === 'doctors' && (
            <DoctorsView
              doctors={doctors}
              currency={organization.currency}
              onSaveDoctor={(data, existingId) => {
                if (existingId) {
                  setDoctors((prev) =>
                    prev.map((d) =>
                      d.id === existingId ? { ...d, ...data, updatedAt: new Date().toISOString() } : d
                    )
                  );
                  if (isLiveCloud) {
                    void updateTenantDoc(
                      organization.id,
                      'doctors',
                      existingId,
                      data as unknown as Record<string, unknown>
                    );
                  }
                } else {
                  const id = generateValidId('doc');
                  const next: Doctor = { id, ...baseTenantFields(), ...data };
                  setDoctors((prev) => [next, ...prev]);
                  if (isLiveCloud) {
                    void createTenantDoc(
                      organization.id,
                      'doctors',
                      id,
                      next as unknown as Record<string, unknown>
                    );
                  }
                  appendAudit('CREATE_DOCTOR', 'doctors', `Added doctor ${data.name}`, id);
                }
              }}
            />
          )}

          {activeModule === 'appointments' && (
            <AppointmentsView
              appointments={appointments}
              patients={patients}
              doctors={doctors}
              currency={organization.currency}
              onCreateAppointment={(data) => {
                const id = generateValidId('apt');
                const next: Appointment = { id, ...baseTenantFields(), ...data };
                setAppointments((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'appointments',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
                appendAudit(
                  'CREATE_APPOINTMENT',
                  'appointments',
                  `Booked ${data.appointmentNumber} for ${data.patientName}`,
                  id
                );
              }}
              onUpdateStatus={(id: string, status: AppointmentStatus) => {
                setAppointments((prev) =>
                  prev.map((a) =>
                    a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a
                  )
                );
                if (isLiveCloud) void updateTenantDoc(organization.id, 'appointments', id, { status });
              }}
              onDeleteAppointment={(id) => {
                setAppointments((prev) => prev.filter((a) => a.id !== id));
                if (isLiveCloud) void deleteTenantDoc(organization.id, 'appointments', id);
              }}
              onHandoffToRx={(apt) => {
                setRxPrefill({
                  patientId: apt.patientId,
                  doctorId: apt.doctorId,
                  appointmentId: apt.id,
                });
                setActiveModule('prescriptions');
              }}
              onHandoffToBilling={(apt) => {
                setBillPrefill({
                  patientId: apt.patientId,
                  description: `Consultation (${apt.appointmentNumber}) — ${apt.doctorName}`,
                  amount: apt.consultationFee,
                });
                setActiveModule('billing');
              }}
            />
          )}

          {activeModule === 'prescriptions' && (
            <PrescriptionsView
              organization={organization}
              prescriptions={prescriptions}
              patients={patients}
              doctors={doctors}
              prefill={rxPrefill}
              onClearPrefill={() => setRxPrefill(null)}
              onCreatePrescription={(data) => {
                const id = generateValidId('rx');
                const next: Prescription = { id, ...baseTenantFields(), ...data };
                setPrescriptions((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'prescriptions',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
                appendAudit('CREATE_PRESCRIPTION', 'prescriptions', `Created ${data.rxNumber}`, id);
              }}
              onFinalizePrescription={(id) => {
                setPrescriptions((prev) =>
                  prev.map((r) =>
                    r.id === id ? { ...r, status: 'finalized', updatedAt: new Date().toISOString() } : r
                  )
                );
                if (isLiveCloud) {
                  void updateTenantDoc(organization.id, 'prescriptions', id, { status: 'finalized' });
                }
                appendAudit('FINALIZE_PRESCRIPTION', 'prescriptions', `Locked prescription ${id}`, id);
              }}
            />
          )}

          {activeModule === 'laboratory' && (
            <LabView
              labTests={labTests}
              labOrders={labOrders}
              patients={patients}
              doctors={doctors}
              currency={organization.currency}
              onCreateTest={(data) => {
                const id = generateValidId('lt');
                const next: LabTest = { id, ...baseTenantFields(), ...data };
                setLabTests((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'labTests',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
              }}
              onCreateOrder={(data) => {
                const id = generateValidId('lo');
                const next: LabOrder = { id, ...baseTenantFields(), ...data };
                setLabOrders((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'labOrders',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
                appendAudit('CREATE_LAB_ORDER', 'laboratory', `Created ${data.orderNumber}`, id);
              }}
              onUpdateOrderResults={(
                orderId: string,
                tests: LabOrderTestItem[],
                nextStatus: LabOrder['status']
              ) => {
                const nowIso = new Date().toISOString();
                setLabOrders((prev) =>
                  prev.map((o) =>
                    o.id === orderId
                      ? {
                          ...o,
                          tests,
                          status: nextStatus,
                          verifiedByName: nextStatus === 'verified' ? activeActorName : o.verifiedByName,
                          verifiedAt: nextStatus === 'verified' ? nowIso : o.verifiedAt,
                          deliveredAt: nextStatus === 'delivered' ? nowIso : o.deliveredAt,
                          history: [
                            ...o.history,
                            { action: `Marked ${nextStatus}`, by: activeActorName, at: nowIso },
                          ],
                          updatedAt: nowIso,
                        }
                      : o
                  )
                );
                if (isLiveCloud) {
                  const patch =
                    nextStatus === 'delivered'
                      ? { status: 'delivered', deliveredAt: nowIso }
                      : {
                          tests,
                          status: nextStatus,
                          verifiedByName: nextStatus === 'verified' ? activeActorName : undefined,
                          verifiedAt: nextStatus === 'verified' ? nowIso : undefined,
                        };
                  void updateTenantDoc(organization.id, 'labOrders', orderId, patch);
                }
                appendAudit('UPDATE_LAB_ORDER', 'laboratory', `Lab order ${orderId} → ${nextStatus}`, orderId);
              }}
            />
          )}

          {activeModule === 'billing' && (
            <BillingView
              invoices={invoices}
              expenses={expenses}
              patients={patients}
              currency={organization.currency}
              hideFinancials={hideFinancials}
              prefill={billPrefill}
              onClearPrefill={() => setBillPrefill(null)}
              onCreateInvoice={(data) => {
                const id = generateValidId('inv');
                const next: Invoice = { id, ...baseTenantFields(), ...data };
                setInvoices((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'invoices',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
                appendAudit('CREATE_INVOICE', 'billing', `Issued ${data.invoiceNumber}`, id);
              }}
              onRecordPayment={(invoiceId: string, payment: InvoicePayment) => {
                setInvoices((prev) =>
                  prev.map((inv) => {
                    if (inv.id !== invoiceId) return inv;
                    const paidAmount = Number((inv.paidAmount + payment.amount).toFixed(2));
                    const dueAmount = Math.max(0, Number((inv.totalAmount - paidAmount).toFixed(2)));
                    const status: Invoice['status'] = dueAmount === 0 ? 'paid' : 'partial';
                    const payments = [...inv.payments, payment];
                    if (isLiveCloud) {
                      void updateTenantDoc(organization.id, 'invoices', invoiceId, {
                        paidAmount,
                        dueAmount,
                        status,
                        payments,
                      });
                    }
                    return { ...inv, paidAmount, dueAmount, status, payments };
                  })
                );
                appendAudit('RECORD_PAYMENT', 'billing', `Collected payment on ${invoiceId}`, invoiceId);
              }}
              onRefundInvoice={(invoiceId) => {
                setInvoices((prev) =>
                  prev.map((inv) =>
                    inv.id === invoiceId
                      ? { ...inv, status: 'refunded', paidAmount: 0, dueAmount: 0 }
                      : inv
                  )
                );
                if (isLiveCloud) {
                  void updateTenantDoc(organization.id, 'invoices', invoiceId, {
                    status: 'refunded',
                    paidAmount: 0,
                    dueAmount: 0,
                  });
                }
                appendAudit('REFUND_INVOICE', 'billing', `Refunded invoice ${invoiceId}`, invoiceId);
              }}
              onCreateExpense={(data) => {
                const id = generateValidId('exp');
                const next: Expense = { id, ...baseTenantFields(), ...data };
                setExpenses((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'expenses',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
              }}
            />
          )}

          {activeModule === 'pharmacy' && (
            <PharmacyView
              items={pharmacyItems}
              sales={pharmacySales}
              patients={patients}
              prescriptions={prescriptions}
              currency={organization.currency}
              hideFinancials={hideFinancials}
              onSaveItem={(data) => {
                const id = generateValidId('ph');
                const next: PharmacyItem = { id, ...baseTenantFields(), ...data };
                setPharmacyItems((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'pharmacyInventory',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
              }}
              onCompleteSale={(sale) => {
                const id = generateValidId('ps');
                const receiptNumber = `POS-${3001 + pharmacySales.length}`;
                const nextSale: PharmacySale = {
                  ...sale,
                  id,
                  receiptNumber,
                  createdAt: new Date().toISOString(),
                };
                setPharmacySales((prev) => [nextSale, ...prev]);
                setPharmacyItems((prev) =>
                  prev.map((item) => {
                    const sold = sale.items.find((s) => s.itemId === item.id);
                    if (!sold) return item;
                    const nextQty = Math.max(0, item.stockQty - sold.qty);
                    if (isLiveCloud) {
                      void updateTenantDoc(organization.id, 'pharmacyInventory', item.id, {
                        stockQty: nextQty,
                      });
                    }
                    return { ...item, stockQty: nextQty };
                  })
                );
                appendAudit(
                  'PHARMACY_POS_DISPENSE',
                  'pharmacy',
                  `Dispensed ${receiptNumber} to ${sale.customerName}`,
                  id
                );
              }}
            />
          )}

          {activeModule === 'beds' && (
            <BedsView
              beds={beds}
              patients={patients}
              doctors={doctors}
              currency={organization.currency}
              onCreateBed={(data) => {
                const id = generateValidId('bed');
                const next: Bed = { id, ...baseTenantFields(), ...data };
                setBeds((prev) => [next, ...prev]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'beds',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
              }}
              onUpdateBed={(bedId, patch) => {
                setBeds((prev) => prev.map((b) => (b.id === bedId ? { ...b, ...patch } : b)));
                if (isLiveCloud) {
                  void updateTenantDoc(
                    organization.id,
                    'beds',
                    bedId,
                    patch as unknown as Record<string, unknown>
                  );
                }
              }}
            />
          )}

          {activeModule === 'staff' && (
            <StaffView
              members={members}
              invites={invites}
              branches={branches}
              onCreateInvite={(data) => {
                const id = generateValidId('inv');
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 14);
                const nextInvite: StaffInvite = {
                  id,
                  organizationId: organization.id,
                  organizationName: organization.name,
                  ownerUid: organization.ownerUid,
                  authorizedUids: organization.authorizedUids,
                  invitedEmail: data.invitedEmail,
                  invitedName: data.invitedName,
                  role: data.role as Exclude<StaffRole, 'clinic_owner'>,
                  department: data.department,
                  designation: data.designation,
                  branchId: data.branchId,
                  inviteCode: `PRV-${Math.floor(1000 + Math.random() * 9000)}-${data.role.slice(0, 3).toUpperCase()}`,
                  status: 'pending',
                  expiresAt: expiry.toISOString().slice(0, 10),
                  createdByUid: activeUid,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                setInvites((prev) => [nextInvite, ...prev]);
                if (isLiveCloud) void createStaffInviteDoc(nextInvite);
                appendAudit('CREATE_STAFF_INVITE', 'staff', `Invited ${data.invitedEmail} as ${data.role}`, id);
              }}
              onRevokeInvite={(inviteId) => {
                setInvites((prev) =>
                  prev.map((i) => (i.id === inviteId ? { ...i, status: 'revoked' } : i))
                );
              }}
              onToggleMemberStatus={(memberId) => {
                setMembers((prev) =>
                  prev.map((m) =>
                    m.id === memberId
                      ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' }
                      : m
                  )
                );
              }}
            />
          )}

          {activeModule === 'settings' && (
            <SettingsView
              organization={organization}
              branches={branches}
              auditLogs={auditLogs}
              onUpdateOrganization={(patch) => {
                setOrganization((prev) => ({ ...prev, ...patch }));
                if (isLiveCloud) {
                  void updateOrganizationDoc(
                    organization.id,
                    patch as unknown as Record<string, unknown>
                  );
                }
                appendAudit('UPDATE_CLINIC_SETTINGS', 'settings', 'Updated clinic configuration');
              }}
              onAddBranch={(data) => {
                const id = generateValidId('br');
                const next: Branch = {
                  id,
                  ...baseTenantFields(),
                  ...data,
                  isMain: false,
                  status: 'active',
                };
                setBranches((prev) => [...prev, next]);
                if (isLiveCloud) {
                  void createTenantDoc(
                    organization.id,
                    'branches',
                    id,
                    next as unknown as Record<string, unknown>
                  );
                }
              }}
              onExportBackup={() => {
                const backup = {
                  exportedAt: new Date().toISOString(),
                  organization,
                  branches,
                  members,
                  doctors,
                  patients,
                  appointments,
                  prescriptions,
                  labTests,
                  labOrders,
                  invoices,
                  expenses,
                  pharmacyItems,
                  pharmacySales,
                  beds,
                  auditLogs,
                };
                downloadFile(
                  JSON.stringify(backup, null, 2),
                  `pravaclin-backup-${getTodayIsoDate()}.json`,
                  'application/json'
                );
              }}
            />
          )}

          {activeModule === 'patient_portal' && (
            <PatientPortalView
              patients={patients}
              appointments={appointments}
              prescriptions={prescriptions}
              labOrders={labOrders}
              invoices={invoices}
              currency={organization.currency}
            />
          )}

          {activeModule === 'super_admin' && (
            <SuperAdminView
              organization={organization}
              plans={INITIAL_PLANS}
              onSwitchPlan={(planId) => {
                setOrganization((prev) => ({ ...prev, planId }));
                if (isLiveCloud) void updateOrganizationDoc(organization.id, { planId });
                appendAudit('UPDATE_SUBSCRIPTION_PLAN', 'super_admin', `Assigned plan ${planId}`);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
