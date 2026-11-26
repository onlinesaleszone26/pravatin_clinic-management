'use client';

import React, { useMemo, useState } from 'react';
import { Receipt, Plus, Printer, CreditCard, Trash2, X, Download } from 'lucide-react';
import {
  createInvoice,
  recordInvoicePayment,
  createExpense,
  deleteExpense,
  TenantActor,
} from '@/lib/firestore-service';
import { exportRowsToCsv, formatMoney, makeDocId, todayISO } from '@/lib/clinic-utils';
import type {
  Organization,
  Patient,
  Appointment,
  Invoice,
  Expense,
  InvoiceLineItem,
  InvoicePayment,
} from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  patients: Patient[];
  invoices: Invoice[];
  expenses: Expense[];
  prefillAppointment?: Appointment | null;
  onClearPrefill?: () => void;
}

export function BillingModule({
  org,
  actor,
  patients,
  invoices,
  expenses,
  prefillAppointment,
  onClearPrefill,
}: Props) {
  const [tab, setTab] = useState<'invoices' | 'expenses' | 'pnl'>('invoices');
  const [showInvoiceModal, setShowInvoiceModal] = useState(Boolean(prefillAppointment));
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);

  // Invoice modal state
  const [patientId, setPatientId] = useState(prefillAppointment?.patientId || patients[0]?.id || '');
  const [items, setItems] = useState<InvoiceLineItem[]>(
    prefillAppointment
      ? [
          {
            category: 'consultation',
            description: `Consultation — ${prefillAppointment.doctorName}`,
            qty: 1,
            unitPrice: prefillAppointment.consultationFee,
            total: prefillAppointment.consultationFee,
          },
        ]
      : [{ category: 'consultation', description: 'Doctor Consultation Fee', qty: 1, unitPrice: 800, total: 800 }]
  );
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [initPayAmount, setInitPayAmount] = useState('');
  const [initPayMethod, setInitPayMethod] = useState<InvoicePayment['method']>('cash');
  const [initPayRef, setInitPayRef] = useState('');

  // Follow-up payment state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<InvoicePayment['method']>('bkash');
  const [payRef, setPayRef] = useState('');

  // Expense form state
  const [expTitle, setExpTitle] = useState('');
  const [expCat, setExpCat] = useState('Clinic Supplies');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(todayISO());
  const [expMethod, setExpMethod] = useState('cash');
  const [expVendor, setExpVendor] = useState('');

  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const discNum = Math.max(0, Number(discount || 0));
  const taxNum = Math.max(0, ((subtotal - discNum) * Number(taxRate || 0)) / 100);
  const grandTotal = Math.max(0, subtotal - discNum + taxNum);

  const financials = useMemo(() => {
    const activeInvs = invoices.filter((i) => i.status !== 'refunded');
    const totalBilled = activeInvs.reduce((s, i) => s + i.totalAmount, 0);
    // Strict accounting rule: Only confirmed payment transactions count as received revenue
    const cashReceived = activeInvs.reduce((s, i) => s + i.paidAmount, 0);
    const totalDue = activeInvs.reduce((s, i) => s + i.dueAmount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const byMethod: Record<string, number> = {};
    activeInvs.forEach((inv) => {
      inv.payments.forEach((p) => {
        byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      });
    });
    return { totalBilled, cashReceived, totalDue, totalExpenses, netProfit: cashReceived - totalExpenses, byMethod };
  }, [invoices, expenses]);

  const updateItem = (idx: number, patch: Partial<InvoiceLineItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.total = Math.max(0, Number(next.qty || 0) * Number(next.unitPrice || 0));
        return next;
      })
    );
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === patientId);
    if (!pat || items.length === 0) return;
    setSaving(true);
    try {
      const paidNow = Number(initPayAmount || 0);
      await createInvoice(
        org,
        actor,
        {
          patientId: pat.id,
          patientName: pat.name,
          patientCode: pat.patientCode,
          patientAuthUid: pat.patientAuthUid,
          items,
          discount: discNum,
          taxRate: Number(taxRate || 0),
          initialPayment:
            paidNow > 0
              ? {
                  id: makeDocId('pay'),
                  amount: paidNow,
                  method: initPayMethod,
                  reference: initPayRef || 'RCV',
                  paidAt: new Date().toISOString(),
                  recordedBy: actor.name,
                }
              : undefined,
        },
        invoices.length + 1
      );
      setShowInvoiceModal(false);
      onClearPrefill?.();
    } finally {
      setSaving(false);
    }
  };

  const handleRecordDuePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    const amt = Number(payAmount || 0);
    if (amt <= 0) return;
    setSaving(true);
    try {
      await recordInvoicePayment(org, actor, payTarget.id, payTarget.totalAmount, payTarget.payments, {
        id: makeDocId('pay'),
        amount: amt,
        method: payMethod,
        reference: payRef || 'DUE-PAY',
        paidAt: new Date().toISOString(),
        recordedBy: actor.name,
      });
      setPayTarget(null);
      setPayAmount('');
      setPayRef('');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createExpense(org, actor, {
        title: expTitle,
        category: expCat,
        amount: Number(expAmount || 0),
        date: expDate,
        paymentMethod: expMethod,
        vendor: expVendor,
      });
      setExpTitle('');
      setExpAmount('');
      setExpVendor('');
      setShowExpenseModal(false);
    } finally {
      setSaving(false);
    }
  };

  // Printable Receipt View
  if (printInvoice) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <button type="button" onClick={() => setPrintInvoice(null)} className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
            ← Back to Invoices
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF Receipt
          </button>
        </div>

        <div className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto print-sheet space-y-6">
          <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
            <div>
              <h1 className="text-xl font-bold">{org.name}</h1>
              <p className="text-xs text-slate-600">{org.address}</p>
              <p className="text-xs text-slate-600 font-mono">{org.phone}</p>
            </div>
            <div className="text-right text-xs font-mono">
              <p className="font-bold text-sm">INVOICE #{printInvoice.invoiceNumber}</p>
              <p className="uppercase font-semibold text-emerald-800">{printInvoice.status}</p>
            </div>
          </div>

          <div className="flex justify-between text-xs">
            <div>
              <p className="text-slate-500">Billed To</p>
              <p className="font-semibold text-sm">{printInvoice.patientName}</p>
              <p className="font-mono text-slate-600">{printInvoice.patientCode}</p>
            </div>
            <div className="text-right font-mono">
              <p className="text-slate-500">Issue Date</p>
              <p>{printInvoice.createdAt?.toDate ? printInvoice.createdAt.toDate().toLocaleDateString() : todayISO()}</p>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Service Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {printInvoice.items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-2.5">{it.description}</td>
                  <td className="py-2.5 text-right font-mono">{it.qty}</td>
                  <td className="py-2.5 text-right font-mono">{formatMoney(it.unitPrice, org.currency)}</td>
                  <td className="py-2.5 text-right font-mono font-medium">{formatMoney(it.total, org.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto max-w-xs space-y-1.5 text-xs font-mono pt-3 border-t border-slate-200">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(printInvoice.subtotal, org.currency)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-{formatMoney(printInvoice.discount, org.currency)}</span></div>
            {printInvoice.taxAmount > 0 && <div className="flex justify-between"><span>Tax ({printInvoice.taxRate}%)</span><span>{formatMoney(printInvoice.taxAmount, org.currency)}</span></div>}
            <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-slate-300"><span>Grand Total</span><span>{formatMoney(printInvoice.totalAmount, org.currency)}</span></div>
            <div className="flex justify-between text-teal-700"><span>Paid Confirmed</span><span>{formatMoney(printInvoice.paidAmount, org.currency)}</span></div>
            <div className="flex justify-between font-semibold text-red-700"><span>Due Balance</span><span>{formatMoney(printInvoice.dueAmount, org.currency)}</span></div>
          </div>

          {printInvoice.payments.length > 0 && (
            <div className="pt-4 border-t border-slate-200 text-xs">
              <p className="font-semibold mb-1.5">Confirmed Payment Transactions</p>
              {printInvoice.payments.map((p) => (
                <p key={p.id} className="font-mono text-slate-600">
                  {new Date(p.paidAt).toLocaleDateString()} · {p.method.toUpperCase()} · Ref: {p.reference} · {formatMoney(p.amount, org.currency)}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 pt-4 border-t border-slate-200 text-center">
            {org.invoiceFooter || 'Computer-generated official clinic receipt.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg">
          <button type="button" onClick={() => setTab('invoices')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'invoices' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
            Invoices & Payments ({invoices.length})
          </button>
          <button type="button" onClick={() => setTab('expenses')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'expenses' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
            Expenses ({expenses.length})
          </button>
          <button type="button" onClick={() => setTab('pnl')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'pnl' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
            Cash & Profit/Loss
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportRowsToCsv(
                `${org.slug}-invoices.csv`,
                ['Invoice #', 'Patient', 'Total', 'Paid', 'Due', 'Status'],
                invoices.map((i) => [i.invoiceNumber, i.patientName, i.totalAmount, i.paidAmount, i.dueAmount, i.status])
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button type="button" onClick={() => setShowExpenseModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200">
            <Plus className="w-3.5 h-3.5" /> Record Expense
          </button>
          <button
            type="button"
            onClick={() => {
              setPatientId(patients[0]?.id || '');
              setItems([{ category: 'consultation', description: 'Doctor Consultation Fee', qty: 1, unitPrice: 800, total: 800 }]);
              setDiscount('0');
              setTaxRate('0');
              setInitPayAmount('');
              setShowInvoiceModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
          >
            <Receipt className="w-3.5 h-3.5" /> New Invoice
          </button>
        </div>
      </div>

      {/* Tab 1: Invoices */}
      {tab === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No invoices generated yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-medium">Invoice #</th>
                    <th className="py-3 px-4 font-medium">Patient</th>
                    <th className="py-3 px-4 font-medium text-right">Total</th>
                    <th className="py-3 px-4 font-medium text-right">Confirmed Paid</th>
                    <th className="py-3 px-4 font-medium text-right">Due</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">{inv.patientName}</p>
                        <p className="text-xs text-slate-500">{inv.items.length} line item(s)</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">{formatMoney(inv.totalAmount, org.currency)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-teal-700 dark:text-teal-400 font-medium">{formatMoney(inv.paidAmount, org.currency)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-red-600 dark:text-red-400 font-medium">{formatMoney(inv.dueAmount, org.currency)}</td>
                      <td className="py-3 px-4 text-xs capitalize font-medium text-slate-700 dark:text-slate-300">{inv.status}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {inv.dueAmount > 0 && inv.status !== 'refunded' && (
                            <button
                              type="button"
                              onClick={() => { setPayTarget(inv); setPayAmount(String(inv.dueAmount)); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-400 border border-slate-200 dark:border-slate-700 rounded-md hover:border-teal-500"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Collect
                            </button>
                          )}
                          {inv.status !== 'refunded' && inv.paidAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => recordInvoicePayment(org, actor, inv.id, inv.totalAmount, inv.payments, null, true)}
                              className="px-2 py-1 text-xs text-slate-500 hover:text-red-600"
                            >
                              Refund
                            </button>
                          )}
                          <button type="button" onClick={() => setPrintInvoice(inv)} className="p-1.5 text-slate-500 hover:text-emerald-700">
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Expenses */}
      {tab === 'expenses' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No expenses logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Title & Vendor</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Method</th>
                    <th className="py-3 px-4 font-medium text-right">Amount</th>
                    <th className="py-3 px-4 font-medium text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">{exp.date}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">{exp.title}</p>
                        {exp.vendor && <p className="text-xs text-slate-500">{exp.vendor}</p>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{exp.category}</td>
                      <td className="py-3 px-4 text-xs capitalize text-slate-600 dark:text-slate-400">{exp.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">{formatMoney(exp.amount, org.currency)}</td>
                      <td className="py-3 px-4 text-right">
                        <button type="button" onClick={() => deleteExpense(org, actor, exp.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Cash & Profit/Loss Summary */}
      {tab === 'pnl' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500">Confirmed Cash Received</p>
              <p className="text-xl font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400 mt-1">{formatMoney(financials.cashReceived, org.currency)}</p>
              <p className="text-xs text-slate-400 mt-1">Excludes unpaid & refunded bills</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Billed / Receivable</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">{formatMoney(financials.totalBilled, org.currency)}</p>
              <p className="text-xs text-amber-600 mt-1">Due: {formatMoney(financials.totalDue, org.currency)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Clinic Expenses</p>
              <p className="text-xl font-bold font-mono tabular-nums text-red-600 dark:text-red-400 mt-1">{formatMoney(financials.totalExpenses, org.currency)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-500">Net Cash Profit / Loss</p>
              <p className={`text-xl font-bold font-mono tabular-nums mt-1 ${financials.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                {formatMoney(financials.netProfit, org.currency)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Confirmed Collection by Payment Channel</h3>
            {Object.keys(financials.byMethod).length === 0 ? (
              <p className="text-xs text-slate-500">No confirmed payment transactions recorded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {Object.entries(financials.byMethod).map(([method, amount]) => (
                  <div key={method} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <p className="uppercase text-slate-500 font-medium">{method.replace('_', ' ')}</p>
                    <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">{formatMoney(amount, org.currency)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Patient Invoice</h2>
              <button type="button" onClick={() => setShowInvoiceModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Patient *</label>
                <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                  <option value="">Select Patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.patientCode})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium">Service Line Items</label>
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select value={it.category} onChange={(e) => updateItem(idx, { category: e.target.value as InvoiceLineItem['category'] })} className="col-span-3 px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                      <option value="consultation">Consultation</option>
                      <option value="lab">Lab Test</option>
                      <option value="procedure">Procedure</option>
                      <option value="pharmacy">Pharmacy</option>
                      <option value="bed">Bed / Cabin</option>
                      <option value="other">Other</option>
                    </select>
                    <input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Description" className="col-span-5 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                    <input type="number" min={1} value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} className="col-span-1 px-2 py-1.5 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                    <input type="number" min={0} value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} className="col-span-2 px-2 py-1.5 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                    <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="col-span-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4 mx-auto" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setItems((prev) => [...prev, { category: 'lab', description: '', qty: 1, unitPrice: 0, total: 0 }])} className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
                  + Add Line Item
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Discount ({org.currency})</label>
                  <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tax (%)</label>
                  <input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Grand Total</label>
                  <p className="px-3 py-1.5 text-sm font-mono font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                    {formatMoney(grandTotal, org.currency)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Initial Paid Amount</label>
                  <input type="number" min={0} max={grandTotal} value={initPayAmount} onChange={(e) => setInitPayAmount(e.target.value)} placeholder="0 for unpaid" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
                  <select value={initPayMethod} onChange={(e) => setInitPayMethod(e.target.value as InvoicePayment['method'])} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="cash">Cash</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mobile_banking">Other Mobile Banking</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">TrxID / Reference</label>
                  <input value={initPayRef} onChange={(e) => setInitPayRef(e.target.value)} placeholder="BKS-12345" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">{saving ? 'Issuing...' : 'Issue Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Due Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Collect Payment — {payTarget.invoiceNumber}</h2>
              <button type="button" onClick={() => setPayTarget(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleRecordDuePayment} className="space-y-3.5">
              <p className="text-xs text-slate-500">Remaining Due: <strong className="font-mono text-slate-900 dark:text-white">{formatMoney(payTarget.dueAmount, org.currency)}</strong></p>
              <div>
                <label className="block text-xs font-medium mb-1">Amount Received *</label>
                <input type="number" required min={1} max={payTarget.dueAmount} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as InvoicePayment['method'])} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                  <option value="cash">Cash</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Transaction Reference</label>
                <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="TrxID / Receipt #" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPayTarget(null)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg">Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Record Operational Expense</h2>
              <button type="button" onClick={() => setShowExpenseModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium mb-1">Expense Title *</label>
                <input required value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="Lab Reagent Kit / Electricity Bill" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <select value={expCat} onChange={(e) => setExpCat(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option>Clinic Supplies</option>
                    <option>Lab Supplies</option>
                    <option>Pharmacy Purchase</option>
                    <option>Staff Payroll</option>
                    <option>Rent & Utilities</option>
                    <option>Equipment Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Amount ({org.currency}) *</label>
                  <input type="number" min={1} required value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Date</label>
                  <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Method</label>
                  <select value={expMethod} onChange={(e) => setExpMethod(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="bkash">bKash</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vendor / Payee</label>
                <input value={expVendor} onChange={(e) => setExpVendor(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
