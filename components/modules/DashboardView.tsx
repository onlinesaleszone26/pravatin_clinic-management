'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Eye,
  EyeOff,
  FlaskConical,
  Pill,
  Receipt,
  Users,
} from 'lucide-react';
import type {
  ActiveModule,
  Appointment,
  Bed,
  CurrencyCode,
  Expense,
  Invoice,
  LabOrder,
  Patient,
  PharmacyItem,
  PharmacySale,
} from '@/lib/types';
import { daysUntilDate, formatCurrency } from '@/lib/utils';

interface DashboardViewProps {
  currency: CurrencyCode;
  hideFinancials: boolean;
  onToggleFinancials: () => void;
  patients: Patient[];
  appointments: Appointment[];
  invoices: Invoice[];
  expenses: Expense[];
  labOrders: LabOrder[];
  pharmacyItems: PharmacyItem[];
  pharmacySales: PharmacySale[];
  beds: Bed[];
  onNavigate: (module: ActiveModule) => void;
}

export function DashboardView({
  currency,
  hideFinancials,
  onToggleFinancials,
  patients,
  appointments,
  invoices,
  expenses,
  labOrders,
  pharmacyItems,
  pharmacySales,
  beds,
  onNavigate,
}: DashboardViewProps) {
  const consultationRevenue = invoices.reduce(
    (sum, inv) =>
      sum +
      inv.items
        .filter((i) => i.category === 'consultation')
        .reduce((s, i) => s + i.total, 0),
    0
  );
  const labRevenue = invoices.reduce(
    (sum, inv) =>
      sum + inv.items.filter((i) => i.category === 'lab').reduce((s, i) => s + i.total, 0),
    0
  );
  const pharmacyRevenue =
    pharmacySales.reduce((sum, s) => sum + s.total, 0) +
    invoices.reduce(
      (sum, inv) =>
        sum +
        inv.items
          .filter((i) => i.category === 'pharmacy')
          .reduce((s, i) => s + i.total, 0),
      0
    );

  const totalCollected =
    invoices.reduce((sum, inv) => sum + inv.paidAmount, 0) +
    pharmacySales.reduce((sum, s) => sum + s.total, 0);
  const totalDue = invoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const activeQueue = appointments.filter(
    (a) => !['completed', 'cancelled', 'no_show'].includes(a.status)
  );
  const lowStockItems = pharmacyItems.filter((item) => item.stockQty <= item.reorderLevel);
  const expiringItems = pharmacyItems.filter((item) => {
    const d = daysUntilDate(item.expiryDate);
    return d >= 0 && d <= 90;
  });
  const occupiedBeds = beds.filter((b) => b.status === 'occupied').length;

  const serviceRevenueData = [
    { name: 'Consultation', amount: Math.round(consultationRevenue) },
    { name: 'Laboratory', amount: Math.round(labRevenue) },
    { name: 'Pharmacy POS', amount: Math.round(pharmacyRevenue) },
    { name: 'Expenses', amount: Math.round(totalExpenses) },
  ];

  const queueDistribution = [
    { status: 'Pending', count: appointments.filter((a) => a.status === 'pending').length },
    { status: 'Confirmed', count: appointments.filter((a) => a.status === 'confirmed').length },
    { status: 'Checked In', count: appointments.filter((a) => a.status === 'checked_in').length },
    { status: 'In Room', count: appointments.filter((a) => a.status === 'in_consultation').length },
    { status: 'Completed', count: appointments.filter((a) => a.status === 'completed').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Executive Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time clinic queue, diagnostics throughput, and service revenue overview.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleFinancials}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hideFinancials ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
          <span>{hideFinancials ? 'Show Financial Totals' : 'Hide Financial Totals'}</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Collected Revenue</span>
            <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {formatCurrency(totalCollected, currency, hideFinancials)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Outstanding due: {formatCurrency(totalDue, currency, hideFinancials)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Active Queue</span>
            <CalendarClock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {activeQueue.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {appointments.length} total scheduled · {appointments.filter((a) => a.status === 'completed').length} completed
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Registered Patients</span>
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {patients.filter((p) => p.status === 'active').length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Inpatient occupancy: {occupiedBeds} / {beds.length} beds
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Diagnostics &amp; Pharmacy</span>
            <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {labOrders.filter((l) => !['verified', 'delivered', 'cancelled'].includes(l.status)).length}{' '}
            <span className="text-sm font-sans font-normal text-slate-500">pending lab</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {lowStockItems.length} low stock · {expiringItems.length} expiring ≤ 90d
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Service-Wise Revenue vs Expenses
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Breakdown across consultation, lab diagnostics, pharmacy POS, and ledger expenses.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('billing')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Billing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {hideFinancials ? (
            <div className="h-60 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-center p-6">
              <EyeOff className="w-6 h-6 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Financial privacy mode is active
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Revenue chart values are hidden for front-desk screen privacy.
              </p>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceRevenueData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip
                    formatter={(val) => formatCurrency(Number(val ?? 0), currency, false)}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Appointment Queue Pipeline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current patient flow across check-in, consultation, and completion stages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Live Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={queueDistribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Operational Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Queue Snapshot */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Upcoming &amp; In-Room Queue
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs text-emerald-700 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
            >
              Manage all
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeQueue.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No active appointments in queue.</p>
            ) : (
              activeQueue.slice(0, 5).map((apt) => (
                <div key={apt.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 mr-2">
                        #{apt.queueToken}
                      </span>
                      {apt.patientName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {apt.doctorName} · {apt.timeSlot} · {apt.type.replace('_', ' ')}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize whitespace-nowrap shrink-0">
                    {apt.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pharmacy Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Pill className="w-4 h-4 text-emerald-600" />
              <span>Pharmacy Inventory Alerts</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('pharmacy')}
              className="text-xs text-emerald-700 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
            >
              Open Pharmacy
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...lowStockItems, ...expiringItems.filter((e) => !lowStockItems.some((l) => l.id === e.id))].length === 0 ? (
              <p className="p-5 text-sm text-slate-500">All pharmacy batches healthy and stocked.</p>
            ) : (
              [
                ...lowStockItems,
                ...expiringItems.filter((e) => !lowStockItems.some((l) => l.id === e.id)),
              ]
                .slice(0, 5)
                .map((item) => {
                  const daysLeft = daysUntilDate(item.expiryDate);
                  const isLow = item.stockQty <= item.reorderLevel;
                  return (
                    <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.brandName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.genericName} · Batch {item.batchNumber || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right text-xs whitespace-nowrap shrink-0">
                        {isLow && (
                          <p className="text-rose-600 dark:text-rose-400 font-medium flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="font-mono tabular-nums">{item.stockQty} left</span>
                          </p>
                        )}
                        {daysLeft <= 90 && (
                          <p className="text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                            Exp in {daysLeft}d
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
