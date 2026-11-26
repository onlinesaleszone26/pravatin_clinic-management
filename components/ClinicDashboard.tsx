'use client';

import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  CalendarPlus,
  FilePlus2,
  FlaskConical,
  Receipt,
  Stethoscope,
  Database,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatMoney, todayISO } from '@/lib/clinic-utils';
import { t, Lang } from '@/lib/i18n';
import { seedSampleClinicData, TenantActor } from '@/lib/firestore-service';
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
  ModuleKey,
} from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  lang: Lang;
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  invoices: Invoice[];
  expenses: Expense[];
  pharmacy: PharmacyItem[];
  onNavigate: (mod: ModuleKey) => void;
}

const CHART_COLORS = ['#047857', '#0D9488', '#10B981', '#D97706', '#64748B'];

export function ClinicDashboard({
  org,
  actor,
  lang,
  patients,
  doctors,
  appointments,
  prescriptions,
  labOrders,
  invoices,
  expenses,
  pharmacy,
  onNavigate,
}: Props) {
  const [seeding, setSeeding] = useState(false);
  const [seedErr, setSeedErr] = useState<string | null>(null);
  const [hideFinancials, setHideFinancials] = useState(false);
  const today = todayISO();

  const stats = useMemo(() => {
    const todayAppts = appointments.filter((a) => a.date === today);
    const completedToday = todayAppts.filter((a) => a.status === 'completed').length;
    const pendingToday = todayAppts.filter((a) => ['pending', 'confirmed', 'checked_in', 'in_consultation'].includes(a.status)).length;
    const cancelledToday = todayAppts.filter((a) => a.status === 'cancelled' || a.status === 'no_show').length;
    const activeDoctors = doctors.filter((d) => d.status === 'active').length;

    // Only confirmed payments count as collected revenue
    const totalCollected = invoices
      .filter((inv) => inv.status !== 'refunded')
      .reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalDue = invoices
      .filter((inv) => inv.status !== 'refunded')
      .reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const lowOrExpiringStock = pharmacy.filter((item) => {
      const low = item.stockQty <= item.reorderLevel;
      const expiringSoon = item.expiryDate && item.expiryDate <= today;
      return low || expiringSoon;
    }).length;

    const pendingLab = labOrders.filter((o) => !['verified', 'delivered', 'cancelled'].includes(o.status)).length;

    return {
      totalPatients: patients.filter((p) => p.status === 'active').length,
      todayApptsCount: todayAppts.length,
      completedToday,
      pendingToday,
      cancelledToday,
      totalDoctors: doctors.length,
      activeDoctors,
      totalCollected,
      totalDue,
      totalExpenses,
      netCashflow: totalCollected - totalExpenses,
      totalLabOrders: labOrders.length,
      pendingLab,
      totalPrescriptions: prescriptions.length,
      lowOrExpiringStock,
      todayAppts,
    };
  }, [patients, doctors, appointments, prescriptions, labOrders, invoices, expenses, pharmacy, today]);

  // Weekly 7-day appointment & patient trend computed from real records
  const weeklyTrend = useMemo(() => {
    const days: { label: string; iso: string; appointments: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayAppts = appointments.filter((a) => a.date === iso);
      days.push({
        label,
        iso,
        appointments: dayAppts.length,
        completed: dayAppts.filter((a) => a.status === 'completed').length,
      });
    }
    return days;
  }, [appointments]);

  // Service-wise revenue breakdown from real invoice items
  const serviceRevenue = useMemo(() => {
    const buckets: Record<string, number> = {
      Consultation: 0,
      Laboratory: 0,
      Pharmacy: 0,
      Procedures: 0,
      'Bed / Other': 0,
    };
    invoices
      .filter((inv) => inv.status !== 'refunded')
      .forEach((inv) => {
        inv.items.forEach((item) => {
          if (item.category === 'consultation') buckets.Consultation += item.total;
          else if (item.category === 'lab') buckets.Laboratory += item.total;
          else if (item.category === 'pharmacy') buckets.Pharmacy += item.total;
          else if (item.category === 'procedure') buckets.Procedures += item.total;
          else buckets['Bed / Other'] += item.total;
        });
      });
    return Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [invoices]);

  // Doctor performance from real appointments
  const doctorPerformance = useMemo(() => {
    return doctors.map((doc) => {
      const docAppts = appointments.filter((a) => a.doctorId === doc.id);
      const completed = docAppts.filter((a) => a.status === 'completed').length;
      const revenue = docAppts
        .filter((a) => a.paymentStatus === 'paid')
        .reduce((s, a) => s + (a.consultationFee || 0), 0);
      return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        total: docAppts.length,
        completed,
        revenue,
      };
    });
  }, [doctors, appointments]);

  const upcomingFollowUps = useMemo(
    () =>
      appointments
        .filter((a) => a.followUpDate && a.followUpDate >= today)
        .sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''))
        .slice(0, 6),
    [appointments, today]
  );

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedErr(null);
    try {
      await seedSampleClinicData(org, actor);
    } catch (err) {
      setSeedErr(err instanceof Error ? err.message : 'Failed to load sample data.');
    } finally {
      setSeeding(false);
    }
  };

  const isEmptyClinic = patients.length === 0 && doctors.length === 0 && appointments.length === 0;

  return (
    <div className="space-y-6">
      {/* Empty Clinic Quick Sample Data Banner (Explicit Test Mode) */}
      {isEmptyClinic && (
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/70 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Your isolated clinic workspace is ready
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Start registering real doctors and patients below, or load realistic test-mode sample records to explore appointments, A4 prescriptions, lab reports, and financial charts immediately.
            </p>
            {seedErr && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{seedErr}</p>}
          </div>
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <Database className="w-4 h-4" />
            <span>{seeding ? 'Populating Firestore...' : t(lang, 'loadDemo')}</span>
          </button>
        </div>
      )}

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => onNavigate('patients')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{t(lang, 'registerPatient')}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('appointments')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>{t(lang, 'bookAppointment')}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('prescriptions')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
          <span>{t(lang, 'newPrescription')}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('laboratory')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>{t(lang, 'addLabOrder')}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('billing')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>{t(lang, 'createInvoice')}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('doctors')}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>{t(lang, 'addDoctor')}</span>
        </button>
      </div>

      {/* KPI Metrics Strip (Single-Elevation, Clean Dividers, Tabular Figures) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t(lang, 'todayAppointments')}</span>
            <button type="button" onClick={() => onNavigate('appointments')} className="text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5">
              View <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {stats.todayApptsCount}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.completedToday} completed · {stats.pendingToday} active · {stats.cancelledToday} cancelled
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t(lang, 'collectedRevenue')}</span>
            <div className="inline-flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setHideFinancials((prev) => !prev)}
                title={hideFinancials ? 'Show financial figures' : 'Hide financial figures'}
                aria-label={hideFinancials ? 'Show financial figures' : 'Hide financial figures'}
                className="p-1 rounded-md text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {hideFinancials ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => onNavigate('billing')} className="text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5">
                Ledger <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {hideFinancials ? '••••••' : formatMoney(stats.totalCollected, org.currency)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Due: {hideFinancials ? '••••' : formatMoney(stats.totalDue, org.currency)} · Net:{' '}
            <span className={!hideFinancials && stats.netCashflow < 0 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
              {hideFinancials ? '••••' : formatMoney(stats.netCashflow, org.currency)}
            </span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Registered Patients & Doctors</span>
            <button type="button" onClick={() => onNavigate('patients')} className="text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5">
              Registry <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {stats.totalPatients}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.activeDoctors} / {stats.totalDoctors} active doctors · {stats.totalPrescriptions} Rx issued
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Diagnostics & Pharmacy</span>
            <button type="button" onClick={() => onNavigate('laboratory')} className="text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5">
              Lab <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {stats.totalLabOrders}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.pendingLab} lab orders pending · {stats.lowOrExpiringStock} stock alerts
          </p>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                7-Day Appointment Volume
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scheduled vs completed consultations from live clinic appointments
              </p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="appointments" name="Booked" stroke="#047857" fill="#047857" fillOpacity={0.16} strokeWidth={2} />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#0D9488" fill="#0D9488" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Service-Wise Billed Breakdown
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Revenue distribution across consultation, lab, pharmacy, and procedures
            </p>
          </div>
          {serviceRevenue.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Create patient invoices to visualize service-wise revenue.
            </div>
          ) : (
            <div className="h-60 w-full grid grid-cols-1 sm:grid-cols-2 items-center gap-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={serviceRevenue} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
                    {serviceRevenue.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => (hideFinancials ? '••••' : formatMoney(Number(val ?? 0), org.currency))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-xs">
                {serviceRevenue.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      <span className="text-slate-700 dark:text-slate-300 truncate">{entry.name}</span>
                    </div>
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                      {hideFinancials ? '••••' : formatMoney(entry.value, org.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Operational Tables: Today's Queue + Doctor Performance + Follow-Ups */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Today&apos;s Live Queue ({today})</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ordered by queue token and slot time</p>
            </div>
            <button type="button" onClick={() => onNavigate('appointments')} className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
              Manage Queue
            </button>
          </div>
          {stats.todayAppts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No appointments scheduled for today yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Token</th>
                    <th className="py-2.5 px-4 font-medium">Patient</th>
                    <th className="py-2.5 px-4 font-medium">Doctor</th>
                    <th className="py-2.5 px-4 font-medium">Time</th>
                    <th className="py-2.5 px-4 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {stats.todayAppts
                    .slice()
                    .sort((a, b) => a.queueToken - b.queueToken)
                    .map((apt) => (
                      <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          #{apt.queueToken}
                        </td>
                        <td className="py-2.5 px-4">
                          <p className="font-medium text-slate-900 dark:text-white">{apt.patientName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{apt.appointmentNumber}</p>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{apt.doctorName}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {apt.timeSlot}
                        </td>
                        <td className="py-2.5 px-4 text-right text-xs font-medium capitalize text-slate-700 dark:text-slate-300">
                          {apt.status.replace('_', ' ')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Doctor Performance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Doctor Performance
            </h3>
            {doctorPerformance.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Add doctors to track consultations and revenue.</p>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={doctorPerformance} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => String(v).split(' ').slice(0, 2).join(' ')} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip />
                    <Bar dataKey="total" name="Appointments" fill="#047857" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#0D9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Upcoming Follow-Ups */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pending Patient Follow-Ups
              </h3>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            {upcomingFollowUps.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No upcoming follow-up reminders scheduled.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingFollowUps.map((f) => (
                  <div key={f.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{f.patientName}</p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">
                        {f.doctorName} · {f.followUpReason || 'Follow-up review'}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                      {f.followUpDate}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {stats.lowOrExpiringStock > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stats.lowOrExpiringStock} pharmacy item(s) below reorder level or expired.</span>
              </div>
              <button type="button" onClick={() => onNavigate('pharmacy')} className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline shrink-0">
                Review Stock
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
