'use client';

import React, { useState } from 'react';
import {
  FlaskConical,
  Plus,
  Printer,
  CheckCircle2,
  Lock,
  ClipboardList,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  saveLabTest,
  createLabOrder,
  updateLabOrderResults,
  TenantActor,
} from '@/lib/firestore-service';
import { formatMoney } from '@/lib/clinic-utils';
import type {
  Organization,
  Patient,
  Doctor,
  LabTest,
  LabOrder,
  LabOrderStatus,
  LabOrderTestItem,
} from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  patients: Patient[];
  doctors: Doctor[];
  labTests: LabTest[];
  labOrders: LabOrder[];
}

export function LabModule({ org, actor, patients, doctors, labTests, labOrders }: Props) {
  const [tab, setTab] = useState<'orders' | 'catalog'>('orders');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [activeResultOrder, setActiveResultOrder] = useState<LabOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<LabOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Order creation state
  const [patientId, setPatientId] = useState('');
  const [referringDoctorId, setReferringDoctorId] = useState('');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  // Test catalog form state
  const [editingTest, setEditingTest] = useState<LabTest | null>(null);
  const [tCode, setTCode] = useState('');
  const [tName, setTName] = useState('');
  const [tCategory, setTCategory] = useState('Hematology');
  const [tPrice, setTPrice] = useState('500');
  const [tSampleType, setTSampleType] = useState('Whole Blood');
  const [tPrep, setTPrep] = useState('No fasting required');
  const [tRef, setTRef] = useState('');
  const [tUnit, setTUnit] = useState('');

  // Result editor state
  const [resultItems, setResultItems] = useState<LabOrderTestItem[]>([]);
  const [resultStatus, setResultStatus] = useState<LabOrderStatus>('processing');
  const [techName, setTechName] = useState('');
  const [verifierName, setVerifierName] = useState('');

  const openNewOrder = () => {
    setPatientId(patients[0]?.id || '');
    setReferringDoctorId(doctors[0]?.id || '');
    setSelectedTestIds([]);
    setError(null);
    setShowOrderModal(true);
  };

  const toggleTestSelection = (id: string) => {
    setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === patientId);
    const chosen = labTests.filter((t) => selectedTestIds.includes(t.id));
    if (!pat || chosen.length === 0) {
      setError('Select a patient and at least one laboratory test.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const refDoc = doctors.find((d) => d.id === referringDoctorId);
      const items: LabOrderTestItem[] = chosen.map((t) => ({
        testId: t.id,
        code: t.code,
        name: t.name,
        price: t.price,
        referenceRange: t.referenceRange || '',
        unit: t.unit || '',
        resultValue: '',
        isAbnormal: false,
        remarks: '',
      }));
      await createLabOrder(
        org,
        actor,
        {
          patientId: pat.id,
          patientName: pat.name,
          patientCode: pat.patientCode,
          patientAuthUid: pat.patientAuthUid,
          referringDoctorId: refDoc?.id || '',
          referringDoctorName: refDoc?.name || '',
          tests: items,
          totalPrice: items.reduce((s, x) => s + x.price, 0),
        },
        labOrders.length + 1
      );
      setShowOrderModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lab order.');
    } finally {
      setSaving(false);
    }
  };

  const openResultModal = (order: LabOrder) => {
    setActiveResultOrder(order);
    setResultItems(order.tests.map((t) => ({ ...t })));
    setResultStatus(order.status === 'ordered' ? 'sample_collected' : order.status);
    setTechName(order.technicianName || actor.name);
    setVerifierName(order.verifiedByName || '');
    setError(null);
  };

  const handleSaveResults = async (targetStatus: LabOrderStatus) => {
    if (!activeResultOrder) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const newHistory = [
        ...activeResultOrder.history,
        {
          action: `Status → ${targetStatus.replace('_', ' ')}`,
          by: targetStatus === 'verified' ? verifierName || actor.name : techName || actor.name,
          at: now,
        },
      ];

      await updateLabOrderResults(org, actor, activeResultOrder.id, {
        tests: targetStatus === 'delivered' ? undefined : resultItems,
        status: targetStatus,
        technicianName: techName,
        verifiedByName: targetStatus === 'verified' ? verifierName || actor.name : activeResultOrder.verifiedByName,
        verifiedAt: targetStatus === 'verified' ? now : activeResultOrder.verifiedAt,
        deliveredAt: targetStatus === 'delivered' ? now : undefined,
        history: newHistory,
      });
      setActiveResultOrder(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lab order.');
    } finally {
      setSaving(false);
    }
  };

  const openTestForm = (test?: LabTest) => {
    setEditingTest(test || null);
    setTCode(test?.code || '');
    setTName(test?.name || '');
    setTCategory(test?.category || 'Hematology');
    setTPrice(String(test?.price ?? 500));
    setTSampleType(test?.sampleType || 'Whole Blood');
    setTPrep(test?.preparation || 'No fasting required');
    setTRef(test?.referenceRange || '');
    setTUnit(test?.unit || '');
    setShowTestModal(true);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveLabTest(org, actor, {
        id: editingTest?.id,
        code: tCode.trim().toUpperCase(),
        name: tName.trim(),
        category: tCategory,
        price: Number(tPrice || 0),
        sampleType: tSampleType,
        preparation: tPrep,
        referenceRange: tRef,
        unit: tUnit,
        status: 'active',
      });
      setShowTestModal(false);
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // PRINTABLE LAB REPORT VIEW
  // =========================================================================
  if (printOrder) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <button type="button" onClick={() => setPrintOrder(null)} className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
            ← Back to Lab Orders
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF Report
          </button>
        </div>

        <div className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 max-w-4xl mx-auto print-sheet space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
            <div>
              <h1 className="text-xl font-bold">{org.name}</h1>
              <p className="text-xs text-slate-600">Department of Pathology & Diagnostics</p>
              <p className="text-xs text-slate-600">{org.address} · {org.phone}</p>
            </div>
            <div className="sm:text-right text-xs font-mono">
              <p className="font-bold text-sm text-emerald-800">Report #{printOrder.orderNumber}</p>
              <p className="capitalize">Status: {printOrder.status.replace('_', ' ')}</p>
              {printOrder.verifiedAt && <p>Verified: {new Date(printOrder.verifiedAt).toLocaleString()}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-slate-200 pb-4">
            <div><span className="text-slate-500 block">Patient</span><strong>{printOrder.patientName}</strong></div>
            <div><span className="text-slate-500 block">Patient ID</span><strong className="font-mono">{printOrder.patientCode || '—'}</strong></div>
            <div><span className="text-slate-500 block">Referred By</span><strong>{printOrder.referringDoctorName || 'Self'}</strong></div>
            <div><span className="text-slate-500 block">Lab Technician</span><strong>{printOrder.technicianName || '—'}</strong></div>
          </div>

          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-xs text-slate-600">
                <th className="py-2 pr-3 font-semibold">Test Name</th>
                <th className="py-2 px-3 font-semibold">Result</th>
                <th className="py-2 px-3 font-semibold">Unit</th>
                <th className="py-2 px-3 font-semibold">Reference Range</th>
                <th className="py-2 pl-3 font-semibold">Flag / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {printOrder.tests.map((t, idx) => (
                <tr key={idx}>
                  <td className="py-3 pr-3 font-medium">
                    {t.name} <span className="text-xs font-mono text-slate-500">({t.code})</span>
                  </td>
                  <td className={`py-3 px-3 font-mono font-bold ${t.isAbnormal ? 'text-red-700' : 'text-slate-900'}`}>
                    {t.resultValue || 'Pending'}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600">{t.unit || '—'}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600">{t.referenceRange || '—'}</td>
                  <td className="py-3 pl-3 text-xs">
                    {t.isAbnormal && <span className="font-semibold text-red-700 mr-1.5">[ABNORMAL]</span>}
                    <span className="text-slate-600">{t.remarks || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-8 border-t border-slate-200 flex items-end justify-between text-xs">
            <div>
              <p className="font-semibold text-slate-900">{printOrder.technicianName || 'Lab Technologist'}</p>
              <p className="text-slate-500">Prepared & Processed By</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{printOrder.verifiedByName || 'Pending Verification'}</p>
              <p className="text-slate-500">Authorized Pathologist / Approver</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'orders' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Lab Orders & Results ({labOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'catalog' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Test Catalog ({labTests.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openTestForm()} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200">
            <Plus className="w-3.5 h-3.5" /> Add Test to Catalog
          </button>
          <button type="button" onClick={openNewOrder} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
            <FlaskConical className="w-3.5 h-3.5" /> New Lab Order
          </button>
        </div>
      </div>

      {tab === 'orders' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {labOrders.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">No laboratory orders yet.</p>
              <button type="button" onClick={openNewOrder} className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">
                Create First Lab Order
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-medium">Order ID</th>
                    <th className="py-3 px-4 font-medium">Patient & Referrer</th>
                    <th className="py-3 px-4 font-medium">Tests Ordered</th>
                    <th className="py-3 px-4 font-medium text-right">Total</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {labOrders.map((order) => {
                    const isLocked = order.status === 'verified' || order.status === 'delivered';
                    const hasAbnormal = order.tests.some((t) => t.isAbnormal);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {order.orderNumber}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900 dark:text-white">{order.patientName}</p>
                          <p className="text-xs text-slate-500">Ref: {order.referringDoctorName || 'Self'}</p>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="text-slate-800 dark:text-slate-200">{order.tests.map((t) => t.name).join(', ')}</p>
                          {hasAbnormal && (
                            <p className="text-red-600 dark:text-red-400 font-medium inline-flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" /> Abnormal result flagged
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white">
                          {formatMoney(order.totalPrice, org.currency)}
                        </td>
                        <td className="py-3 px-4 text-xs capitalize">
                          <span className={isLocked ? 'inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium' : 'text-amber-600 font-medium'}>
                            {isLocked && <Lock className="w-3 h-3" />}
                            {order.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openResultModal(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 hover:border-emerald-500"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              {isLocked ? 'Audit / Deliver' : 'Enter Results'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintOrder(order)}
                              title="Print Report"
                              className="p-1.5 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {labTests.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No diagnostic tests configured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Test Name</th>
                    <th className="py-3 px-4 font-medium">Category & Sample</th>
                    <th className="py-3 px-4 font-medium">Reference Range</th>
                    <th className="py-3 px-4 font-medium text-right">Price</th>
                    <th className="py-3 px-4 font-medium text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {labTests.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t.code}</td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{t.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{t.category} · {t.sampleType}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">{t.referenceRange || '—'} {t.unit || ''}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white">{formatMoney(t.price, org.currency)}</td>
                      <td className="py-3 px-4 text-right">
                        <button type="button" onClick={() => openTestForm(t)} className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Lab Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Diagnostic Lab Order</h2>
              <button type="button" onClick={() => setShowOrderModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            {error && <p className="mb-3 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">{error}</p>}
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient *</label>
                  <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="">Select Patient</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.patientCode})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Referring Doctor</label>
                  <select value={referringDoctorId} onChange={(e) => setReferringDoctorId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="">Self / Walk-in</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Select Tests *</label>
                {labTests.length === 0 ? (
                  <p className="text-xs text-amber-600">Add at least one test to the Test Catalog first.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    {labTests.map((t) => (
                      <label key={t.id} className="flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" checked={selectedTestIds.includes(t.id)} onChange={() => toggleTestSelection(t.id)} className="rounded border-slate-300 text-emerald-700" />
                          <span className="font-medium text-slate-900 dark:text-white">{t.name}</span>
                          <span className="font-mono text-slate-500">({t.code})</span>
                        </div>
                        <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">{formatMoney(t.price, org.currency)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">{saving ? 'Creating...' : 'Create Lab Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Result Entry & Verification Modal */}
      {activeResultOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Lab Workflow — {activeResultOrder.orderNumber} ({activeResultOrder.patientName})
                </h2>
                <p className="text-xs text-slate-500">
                  Verified lab results are permanently locked by Firestore security rules to maintain clinical integrity.
                </p>
              </div>
              <button type="button" onClick={() => setActiveResultOrder(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">{error}</p>}

            {(() => {
              const locked = activeResultOrder.status === 'verified' || activeResultOrder.status === 'delivered';
              return (
                <>
                  <div className="space-y-2.5">
                    {resultItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="sm:col-span-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-slate-500 font-mono">Ref: {item.referenceRange || '—'} {item.unit}</p>
                        </div>
                        <input
                          disabled={locked}
                          value={item.resultValue}
                          onChange={(e) => setResultItems((prev) => prev.map((x, i) => (i === idx ? { ...x, resultValue: e.target.value } : x)))}
                          placeholder="Result value"
                          className="sm:col-span-3 px-2.5 py-1.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-60"
                        />
                        <label className="sm:col-span-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
                          <input
                            type="checkbox"
                            disabled={locked}
                            checked={item.isAbnormal}
                            onChange={(e) => setResultItems((prev) => prev.map((x, i) => (i === idx ? { ...x, isAbnormal: e.target.checked } : x)))}
                          />
                          <span>Abnormal</span>
                        </label>
                        <input
                          disabled={locked}
                          value={item.remarks}
                          onChange={(e) => setResultItems((prev) => prev.map((x, i) => (i === idx ? { ...x, remarks: e.target.value } : x)))}
                          placeholder="Remarks"
                          className="sm:col-span-3 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-60"
                        />
                      </div>
                    ))}
                  </div>

                  {!locked && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Lab Technician</label>
                        <input value={techName} onChange={(e) => setTechName(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Authorized Approver</label>
                        <input value={verifierName} onChange={(e) => setVerifierName(e.target.value)} placeholder="Dr. Pathologist Name" className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Workflow Stage</label>
                        <select value={resultStatus} onChange={(e) => setResultStatus(e.target.value as LabOrderStatus)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                          <option value="sample_pending">Sample Pending</option>
                          <option value="sample_collected">Sample Collected</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Result Entry Completed</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Audit Trail */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Auditable Modification & Approval History</h4>
                    <div className="space-y-1 max-h-28 overflow-y-auto text-xs font-mono text-slate-500">
                      {activeResultOrder.history.map((h, i) => (
                        <p key={i}>{new Date(h.at).toLocaleString()} · {h.action} · by {h.by}</p>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button type="button" onClick={() => setActiveResultOrder(null)} className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg">Close</button>
                    {!locked && (
                      <>
                        <button type="button" disabled={saving} onClick={() => handleSaveResults(resultStatus)} className="px-4 py-2 text-xs font-medium border border-emerald-600 text-emerald-700 dark:text-emerald-400 rounded-lg">
                          Save Progress
                        </button>
                        <button type="button" disabled={saving} onClick={() => handleSaveResults('verified')} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verify & Lock Report
                        </button>
                      </>
                    )}
                    {activeResultOrder.status === 'verified' && (
                      <button type="button" disabled={saving} onClick={() => handleSaveResults('delivered')} className="px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
                        Mark Report Delivered
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add/Edit Test Catalog Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingTest ? 'Edit Lab Test' : 'Add Diagnostic Test'}</h2>
              <button type="button" onClick={() => setShowTestModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveTest} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Test Code *</label>
                  <input required value={tCode} onChange={(e) => setTCode(e.target.value)} placeholder="CBC" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Price ({org.currency}) *</label>
                  <input type="number" min={0} required value={tPrice} onChange={(e) => setTPrice(e.target.value)} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1">Test Name *</label>
                  <input required value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Complete Blood Count" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <input value={tCategory} onChange={(e) => setTCategory(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Sample Type</label>
                  <input value={tSampleType} onChange={(e) => setTSampleType(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Reference Range</label>
                  <input value={tRef} onChange={(e) => setTRef(e.target.value)} placeholder="4.0 - 5.6" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Unit</label>
                  <input value={tUnit} onChange={(e) => setTUnit(e.target.value)} placeholder="mg/dL" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">Save Test</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
