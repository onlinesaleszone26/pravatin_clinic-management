'use client';

import React, { useState } from 'react';
import { CheckCircle2, Lock, Plus, Printer, X } from 'lucide-react';
import type {
  CurrencyCode,
  Doctor,
  LabOrder,
  LabOrderTestItem,
  LabTest,
  Patient,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface LabViewProps {
  labTests: LabTest[];
  labOrders: LabOrder[];
  patients: Patient[];
  doctors: Doctor[];
  currency: CurrencyCode;
  onCreateTest: (
    test: Omit<
      LabTest,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
  onCreateOrder: (
    order: Omit<
      LabOrder,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
  onUpdateOrderResults: (
    orderId: string,
    tests: LabOrderTestItem[],
    nextStatus: LabOrder['status']
  ) => void;
}

export function LabView({
  labTests,
  labOrders,
  patients,
  doctors,
  currency,
  onCreateTest,
  onCreateOrder,
  onUpdateOrderResults,
}: LabViewProps) {
  const [tab, setTab] = useState<'orders' | 'catalog'>('orders');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<LabOrder | null>(null);
  const [draftResults, setDraftResults] = useState<LabOrderTestItem[]>([]);

  const [orderForm, setOrderForm] = useState({
    patientId: patients[0]?.id || '',
    doctorId: doctors[0]?.id || '',
    selectedTestIds: [] as string[],
  });

  const [testForm, setTestForm] = useState({
    code: '',
    name: '',
    category: 'Biochemistry',
    price: 30,
    sampleType: 'Serum',
    referenceRange: '',
    unit: '',
  });

  const openResultEditor = (order: LabOrder) => {
    setEditingOrder(order);
    setDraftResults(order.tests.map((t) => ({ ...t })));
  };

  const handleSaveResults = (verifyNow: boolean) => {
    if (!editingOrder) return;
    onUpdateOrderResults(editingOrder.id, draftResults, verifyNow ? 'verified' : 'completed');
    setEditingOrder(null);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === orderForm.patientId);
    const doc = doctors.find((d) => d.id === orderForm.doctorId);
    const chosen = labTests.filter((t) => orderForm.selectedTestIds.includes(t.id));
    if (!pat || chosen.length === 0) return;

    const tests: LabOrderTestItem[] = chosen.map((t) => ({
      testId: t.id,
      code: t.code,
      name: t.name,
      price: t.price,
      unit: t.unit,
      referenceRange: t.referenceRange,
      resultValue: '',
      flag: 'normal',
    }));

    onCreateOrder({
      orderNumber: `LAB-${8001 + labOrders.length}`,
      patientId: pat.id,
      patientName: pat.name,
      patientCode: pat.patientCode,
      referringDoctorId: doc?.id,
      referringDoctorName: doc?.name,
      tests,
      totalPrice: tests.reduce((s, t) => s + t.price, 0),
      status: 'ordered',
      history: [{ action: 'Order created', by: 'Clinic Staff', at: new Date().toISOString() }],
    });
    setOrderModalOpen(false);
    setOrderForm({ patientId: patients[0]?.id || '', doctorId: doctors[0]?.id || '', selectedTestIds: [] });
  };

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateTest({
      code: testForm.code.trim().toUpperCase(),
      name: testForm.name.trim(),
      category: testForm.category.trim(),
      price: Number(testForm.price) || 0,
      sampleType: testForm.sampleType.trim(),
      referenceRange: testForm.referenceRange.trim() || undefined,
      unit: testForm.unit.trim() || undefined,
      status: 'active',
    });
    setTestModalOpen(false);
    setTestForm({
      code: '',
      name: '',
      category: 'Biochemistry',
      price: 30,
      sampleType: 'Serum',
      referenceRange: '',
      unit: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Laboratory &amp; Diagnostics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Test catalog, diagnostic orders, abnormal result flags, and immutable verification lock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Catalog Test</span>
          </button>
          <button
            type="button"
            onClick={() => setOrderModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Lab Order</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-fit no-print">
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'orders'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Lab Orders ({labOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('catalog')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'catalog'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Test Catalog ({labTests.length})
        </button>
      </div>

      {tab === 'orders' ? (
        <div className="space-y-4">
          {labOrders.map((order) => {
            const isLocked = order.status === 'verified' || order.status === 'delivered';
            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 mr-2">
                        {order.orderNumber}
                      </span>
                      {order.patientName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Ref: {order.referringDoctorName || 'Self'} · Total:{' '}
                      <span className="font-mono tabular-nums">
                        {formatCurrency(order.totalPrice, currency)}
                      </span>{' '}
                      · Status: <span className="capitalize font-medium">{order.status.replace('_', ' ')}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 no-print">
                    {!isLocked ? (
                      <button
                        type="button"
                        onClick={() => openResultEditor(order)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                      >
                        Enter &amp; Verify Results
                      </button>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Verified Locked</span>
                        </span>
                        {order.status === 'verified' && (
                          <button
                            type="button"
                            onClick={() => onUpdateOrderResults(order.id, order.tests, 'delivered')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Delivered</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print A4</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        <th className="py-2 pr-4">Test</th>
                        <th className="py-2 pr-4">Result</th>
                        <th className="py-2 pr-4">Reference Range</th>
                        <th className="py-2">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {order.tests.map((t) => (
                        <tr key={t.testId}>
                          <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200">
                            {t.code} — {t.name}
                          </td>
                          <td className="py-2 pr-4 font-mono tabular-nums font-semibold">
                            {t.resultValue ? `${t.resultValue} ${t.unit || ''}` : 'Pending'}
                          </td>
                          <td className="py-2 pr-4 text-slate-500 font-mono">
                            {t.referenceRange || '—'}
                          </td>
                          <td className="py-2 capitalize font-medium">
                            <span
                              className={
                                t.flag === 'high' || t.flag === 'critical'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : t.flag === 'low'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                              }
                            >
                              {t.resultValue ? t.flag || 'normal' : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-3 px-4">Code &amp; Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Sample</th>
                <th className="py-3 px-4">Reference Range</th>
                <th className="py-3 px-4 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {labTests.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 mr-2">
                      {t.code}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{t.category}</td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">{t.sampleType}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-500">
                    {t.referenceRange || '—'} {t.unit || ''}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                    {formatCurrency(t.price, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Result Entry Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">
                Lab Results — {editingOrder.orderNumber} ({editingOrder.patientName})
              </h2>
              <button type="button" onClick={() => setEditingOrder(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              {draftResults.map((item, idx) => (
                <div key={item.testId} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <div className="col-span-5">
                    <p className="font-semibold">{item.code} · {item.name}</p>
                    <p className="text-slate-500">Ref: {item.referenceRange || '—'}</p>
                  </div>
                  <input
                    value={item.resultValue || ''}
                    onChange={(e) =>
                      setDraftResults((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, resultValue: e.target.value } : r))
                      )
                    }
                    placeholder={`Value (${item.unit || 'unit'})`}
                    className="col-span-4 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                  <select
                    value={item.flag || 'normal'}
                    onChange={(e) =>
                      setDraftResults((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? { ...r, flag: e.target.value as LabOrderTestItem['flag'] }
                            : r
                        )
                      )
                    }
                    className="col-span-3 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSaveResults(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Save Completed
              </button>
              <button
                type="button"
                onClick={() => handleSaveResults(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Verify &amp; Lock Results</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Lab Order Modal */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleCreateOrder}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Create Lab Order</h2>
              <button type="button" onClick={() => setOrderModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <select
                required
                value={orderForm.patientId}
                onChange={(e) => setOrderForm({ ...orderForm, patientId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.patientCode})
                  </option>
                ))}
              </select>
              <select
                value={orderForm.doctorId}
                onChange={(e) => setOrderForm({ ...orderForm, doctorId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500">Select Diagnostic Tests</p>
                {labTests.map((t) => {
                  const checked = orderForm.selectedTestIds.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setOrderForm((prev) => ({
                              ...prev,
                              selectedTestIds: checked
                                ? prev.selectedTestIds.filter((id) => id !== t.id)
                                : [...prev.selectedTestIds, t.id],
                            }))
                          }
                        />
                        <span>{t.code} — {t.name}</span>
                      </span>
                      <span className="font-mono tabular-nums">{formatCurrency(t.price, currency)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOrderModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={orderForm.selectedTestIds.length === 0}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
              >
                Create Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Catalog Test Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleCreateTest}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Add Diagnostic Test</h2>
              <button type="button" onClick={() => setTestModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <input
                required
                placeholder="Code (e.g. LFT)"
                value={testForm.code}
                onChange={(e) => setTestForm({ ...testForm, code: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
              />
              <input
                type="number"
                min={0}
                required
                placeholder="Price"
                value={testForm.price}
                onChange={(e) => setTestForm({ ...testForm, price: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                required
                placeholder="Test Name"
                value={testForm.name}
                onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                required
                placeholder="Category"
                value={testForm.category}
                onChange={(e) => setTestForm({ ...testForm, category: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                required
                placeholder="Sample Type"
                value={testForm.sampleType}
                onChange={(e) => setTestForm({ ...testForm, sampleType: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                placeholder="Reference Range"
                value={testForm.referenceRange}
                onChange={(e) => setTestForm({ ...testForm, referenceRange: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                placeholder="Unit (mg/dL)"
                value={testForm.unit}
                onChange={(e) => setTestForm({ ...testForm, unit: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Save Test
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
