'use client';

import React, { useState } from 'react';
import { CreditCard, Plus, Printer, RotateCcw, X } from 'lucide-react';
import type {
  CurrencyCode,
  Expense,
  Invoice,
  InvoicePayment,
  Patient,
} from '@/lib/types';
import { formatCurrency, getTodayIsoDate } from '@/lib/utils';

interface BillingViewProps {
  invoices: Invoice[];
  expenses: Expense[];
  patients: Patient[];
  currency: CurrencyCode;
  hideFinancials: boolean;
  prefill?: { patientId: string; description: string; amount: number } | null;
  onClearPrefill: () => void;
  onCreateInvoice: (
    inv: Omit<
      Invoice,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
  onRecordPayment: (invoiceId: string, payment: InvoicePayment) => void;
  onRefundInvoice: (invoiceId: string) => void;
  onCreateExpense: (
    exp: Omit<
      Expense,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
}

export function BillingView({
  invoices,
  expenses,
  patients,
  currency,
  hideFinancials,
  prefill,
  onClearPrefill,
  onCreateInvoice,
  onRecordPayment,
  onRefundInvoice,
  onCreateExpense,
}: BillingViewProps) {
  const [tab, setTab] = useState<'invoices' | 'expenses'>('invoices');
  const [invoiceModal, setInvoiceModal] = useState(Boolean(prefill));
  const [expenseModal, setExpenseModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const [invForm, setInvForm] = useState({
    patientId: prefill?.patientId || patients[0]?.id || '',
    description: prefill?.description || 'Consultation Service',
    category: 'consultation' as Invoice['items'][number]['category'],
    unitPrice: prefill?.amount ?? 80,
    discount: 0,
    paidNow: prefill?.amount ?? 80,
    method: 'Cash' as InvoicePayment['method'],
  });

  const [payForm, setPayForm] = useState({
    amount: 0,
    method: 'Cash' as InvoicePayment['method'],
    reference: '',
  });

  const [expForm, setExpForm] = useState({
    title: '',
    category: 'Medical Supplies',
    amount: 0,
    date: getTodayIsoDate(),
    paymentMethod: 'Bank',
    vendor: '',
  });

  const handleInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === invForm.patientId);
    if (!pat) return;
    const subtotal = Math.max(0, Number(invForm.unitPrice) || 0);
    const discount = Math.max(0, Math.min(subtotal, Number(invForm.discount) || 0));
    const totalAmount = subtotal - discount;
    const paidAmount = Math.max(0, Math.min(totalAmount, Number(invForm.paidNow) || 0));
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const status: Invoice['status'] =
      paidAmount === 0 ? 'unpaid' : dueAmount === 0 ? 'paid' : 'partial';

    onCreateInvoice({
      invoiceNumber: `INV-${9001 + invoices.length}`,
      patientId: pat.id,
      patientName: pat.name,
      patientCode: pat.patientCode,
      items: [
        {
          description: invForm.description.trim(),
          category: invForm.category,
          quantity: 1,
          unitPrice: subtotal,
          total: subtotal,
        },
      ],
      subtotal,
      discount,
      taxRate: 0,
      taxAmount: 0,
      totalAmount,
      paidAmount,
      dueAmount,
      status,
      payments:
        paidAmount > 0
          ? [{ amount: paidAmount, method: invForm.method, paidAt: new Date().toISOString() }]
          : [],
    });
    onClearPrefill();
    setInvoiceModal(false);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    const amt = Math.min(payingInvoice.dueAmount, Math.max(0.01, Number(payForm.amount) || 0));
    onRecordPayment(payingInvoice.id, {
      amount: amt,
      method: payForm.method,
      reference: payForm.reference.trim() || undefined,
      paidAt: new Date().toISOString(),
    });
    setPayingInvoice(null);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateExpense({
      title: expForm.title.trim(),
      category: expForm.category.trim(),
      amount: Math.max(0, Number(expForm.amount) || 0),
      date: expForm.date,
      paymentMethod: expForm.paymentMethod,
      vendor: expForm.vendor.trim() || undefined,
    });
    setExpenseModal(false);
    setExpForm({
      title: '',
      category: 'Medical Supplies',
      amount: 0,
      date: getTodayIsoDate(),
      paymentMethod: 'Bank',
      vendor: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Billing, Invoices &amp; Expenses
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Multi-method payments (Cash, bKash, Nagad, Card, Bank), partial settlements, refunds, and expense ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpenseModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Expense</span>
          </button>
          <button
            type="button"
            onClick={() => setInvoiceModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-fit no-print">
        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'invoices'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Invoices ({invoices.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('expenses')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'expenses'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Clinic Expenses ({expenses.length})
        </button>
      </div>

      {tab === 'invoices' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-3 px-4">Invoice &amp; Patient</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid / Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {inv.invoiceNumber}
                    </p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{inv.patientName}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                    {inv.items.map((i) => i.description).join(' · ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                    {formatCurrency(inv.totalAmount, currency, hideFinancials)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                    <p className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(inv.paidAmount, currency, hideFinancials)}
                    </p>
                    {inv.dueAmount > 0 && (
                      <p className="text-rose-600 dark:text-rose-400">
                        Due {formatCurrency(inv.dueAmount, currency, hideFinancials)}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs capitalize font-medium">{inv.status}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-2 no-print">
                    {inv.dueAmount > 0 && inv.status !== 'refunded' && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayingInvoice(inv);
                          setPayForm({ amount: inv.dueAmount, method: 'Cash', reference: '' });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Collect</span>
                      </button>
                    )}
                    {inv.status !== 'refunded' && inv.paidAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => onRefundInvoice(inv.id)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Refund</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center text-slate-400 hover:text-slate-700 cursor-pointer align-middle"
                      aria-label="Print Invoice"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Title &amp; Vendor</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{exp.date}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{exp.title}</p>
                    <p className="text-xs text-slate-500">{exp.vendor || 'General vendor'}</p>
                  </td>
                  <td className="py-3 px-4 text-xs">{exp.category}</td>
                  <td className="py-3 px-4 text-xs">{exp.paymentMethod}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-rose-600 dark:text-rose-400">
                    {formatCurrency(exp.amount, currency, hideFinancials)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Collect Due Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handlePaymentSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Collect Payment · {payingInvoice.invoiceNumber}</h2>
              <button type="button" onClick={() => setPayingInvoice(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs text-slate-500">
                  Amount (Due: {formatCurrency(payingInvoice.dueAmount, currency)})
                </span>
                <input
                  type="number"
                  step="0.01"
                  max={payingInvoice.dueAmount}
                  min={0.01}
                  required
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500">Payment Method</span>
                <select
                  value={payForm.method}
                  onChange={(e) =>
                    setPayForm({ ...payForm, method: e.target.value as InvoicePayment['method'] })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="Cash">Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Card">Card</option>
                  <option value="Bank">Bank</option>
                </select>
              </label>
              <input
                placeholder="Transaction Reference (Optional)"
                value={payForm.reference}
                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Record Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Invoice Modal */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleInvoiceSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Create Patient Invoice</h2>
              <button
                type="button"
                onClick={() => {
                  onClearPrefill();
                  setInvoiceModal(false);
                }}
                className="cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <select
                required
                value={invForm.patientId}
                onChange={(e) => setInvForm({ ...invForm, patientId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.patientCode})
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Line Item Description"
                value={invForm.description}
                onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Category</span>
                  <select
                    value={invForm.category}
                    onChange={(e) =>
                      setInvForm({
                        ...invForm,
                        category: e.target.value as Invoice['items'][number]['category'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="lab">Laboratory</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="bed">Inpatient Bed</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Amount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={invForm.unitPrice}
                    onChange={(e) => setInvForm({ ...invForm, unitPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Discount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={invForm.discount}
                    onChange={(e) => setInvForm({ ...invForm, discount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-500">Paid Now</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={invForm.paidNow}
                    onChange={(e) => setInvForm({ ...invForm, paidNow: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                </label>
              </div>
              <select
                value={invForm.method}
                onChange={(e) =>
                  setInvForm({ ...invForm, method: e.target.value as InvoicePayment['method'] })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="Cash">Cash</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Card">Card</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onClearPrefill();
                  setInvoiceModal(false);
                }}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Issue Invoice
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Expense Modal */}
      {expenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleExpenseSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Record Clinic Expense</h2>
              <button type="button" onClick={() => setExpenseModal(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <input
                required
                placeholder="Expense Title"
                value={expForm.title}
                onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Category"
                  value={expForm.category}
                  onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  placeholder="Amount"
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
                <input
                  type="date"
                  required
                  value={expForm.date}
                  onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <select
                  value={expForm.paymentMethod}
                  onChange={(e) => setExpForm({ ...expForm, paymentMethod: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="Bank">Bank</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              <input
                placeholder="Vendor (Optional)"
                value={expForm.vendor}
                onChange={(e) => setExpForm({ ...expForm, vendor: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setExpenseModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Save Expense
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
