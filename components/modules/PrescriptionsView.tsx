'use client';

import React, { useState } from 'react';
import { Lock, Plus, Printer, Trash2, X } from 'lucide-react';
import type {
  Doctor,
  Organization,
  Patient,
  Prescription,
  PrescriptionMedicine,
} from '@/lib/types';

interface PrescriptionsViewProps {
  organization: Organization;
  prescriptions: Prescription[];
  patients: Patient[];
  doctors: Doctor[];
  prefill?: { patientId: string; doctorId: string; appointmentId?: string } | null;
  onClearPrefill: () => void;
  onCreatePrescription: (
    rx: Omit<
      Prescription,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
  onFinalizePrescription: (id: string) => void;
}

export function PrescriptionsView({
  organization,
  prescriptions,
  patients,
  doctors,
  prefill,
  onClearPrefill,
  onCreatePrescription,
  onFinalizePrescription,
}: PrescriptionsViewProps) {
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(prescriptions[0] ?? null);
  const [modalOpen, setModalOpen] = useState(Boolean(prefill));
  const [form, setForm] = useState({
    patientId: prefill?.patientId || patients[0]?.id || '',
    doctorId: prefill?.doctorId || doctors[0]?.id || '',
    templateType: 'general_a4' as Prescription['templateType'],
    bp: '120/80 mmHg',
    pulse: '74 bpm',
    temp: '98.4 °F',
    weight: '68 kg',
    chiefComplaints: '',
    diagnosis: '',
    investigationAdvice: '',
    treatmentPlan: '',
    followUpDate: '',
    status: 'draft' as Prescription['status'],
    medicines: [
      { name: '', dosage: '1 tablet', frequency: '1-0-1', duration: '7 days', instructions: 'After meal' },
    ] as PrescriptionMedicine[],
  });

  const openNew = () => {
    setForm({
      patientId: patients[0]?.id || '',
      doctorId: doctors[0]?.id || '',
      templateType: 'general_a4',
      bp: '120/80 mmHg',
      pulse: '74 bpm',
      temp: '98.4 °F',
      weight: '68 kg',
      chiefComplaints: '',
      diagnosis: '',
      investigationAdvice: '',
      treatmentPlan: '',
      followUpDate: '',
      status: 'draft',
      medicines: [
        { name: '', dosage: '1 tablet', frequency: '1-0-1', duration: '7 days', instructions: 'After meal' },
      ],
    });
    setModalOpen(true);
  };

  const addMedicineRow = () => {
    setForm((prev) => ({
      ...prev,
      medicines: [
        ...prev.medicines,
        { name: '', dosage: '1 tablet', frequency: '1-0-1', duration: '7 days', instructions: 'After meal' },
      ],
    }));
  };

  const updateMed = (idx: number, field: keyof PrescriptionMedicine, val: string) => {
    setForm((prev) => ({
      ...prev,
      medicines: prev.medicines.map((m, i) => (i === idx ? { ...m, [field]: val } : m)),
    }));
  };

  const removeMed = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === form.patientId);
    const doc = doctors.find((d) => d.id === form.doctorId);
    if (!pat || !doc) return;

    const cleanMeds = form.medicines.filter((m) => m.name.trim().length > 0);
    onCreatePrescription({
      rxNumber: `RX-${5001 + prescriptions.length}`,
      appointmentId: prefill?.appointmentId,
      patientId: pat.id,
      patientName: pat.name,
      patientCode: pat.patientCode,
      patientAge: pat.age,
      patientGender: pat.gender,
      doctorId: doc.id,
      doctorName: doc.name,
      doctorQualifications: doc.qualifications,
      doctorRegistration: doc.registrationNumber
        ? `${doc.registrationLabel || 'Reg'}: ${doc.registrationNumber}`
        : undefined,
      templateType: form.templateType,
      vitals: { bp: form.bp, pulse: form.pulse, temp: form.temp, weight: form.weight },
      chiefComplaints: form.chiefComplaints.trim() || undefined,
      diagnosis: form.diagnosis.trim() || undefined,
      investigationAdvice: form.investigationAdvice.trim() || undefined,
      treatmentPlan: form.treatmentPlan.trim() || undefined,
      medicines: cleanMeds,
      followUpDate: form.followUpDate || undefined,
      digitalSignature: doc.name,
      status: form.status,
    });
    onClearPrefill();
    setModalOpen(false);
  };

  const activeRx = selectedRx
    ? prescriptions.find((p) => p.id === selectedRx.id) ?? prescriptions[0] ?? null
    : prescriptions[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Digital Prescriptions (A4 Printable)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Structured vitals, diagnosis, medications, 3 print templates, and immutable finalization lock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeRx && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Rx</span>
            </button>
          )}
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Prescription</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rx List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 no-print">
          {prescriptions.map((rx) => (
            <button
              key={rx.id}
              type="button"
              onClick={() => setSelectedRx(rx)}
              className={`w-full text-left p-4 transition-colors cursor-pointer ${
                activeRx?.id === rx.id
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {rx.rxNumber}
                </span>
                <span className="inline-flex items-center gap-1 capitalize text-slate-500">
                  {rx.status === 'finalized' && <Lock className="w-3 h-3" />}
                  {rx.status}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                {rx.patientName}
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {rx.doctorName} · {rx.diagnosis || 'General consultation'}
              </p>
            </button>
          ))}
        </div>

        {/* Printable A4 Preview */}
        <div className="lg:col-span-2">
          {activeRx ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {organization.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {organization.prescriptionHeader || organization.address}
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {activeRx.doctorName}
                  </p>
                  <p className="text-slate-500">{activeRx.doctorQualifications}</p>
                  <p className="font-mono text-slate-500">{activeRx.doctorRegistration}</p>
                </div>
              </div>

              {/* Patient & Meta Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-200/70 dark:border-slate-800">
                <div>
                  <span className="text-slate-500 block">Patient</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {activeRx.patientName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Age / Gender</span>
                  <span className="font-medium capitalize">
                    {activeRx.patientAge ?? '—'}y · {activeRx.patientGender ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Rx Number</span>
                  <span className="font-mono font-medium">{activeRx.rxNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Template</span>
                  <span className="capitalize font-medium">
                    {activeRx.templateType.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Vitals & Diagnosis */}
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="space-y-3 text-xs border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800 pb-4 sm:pb-0 sm:pr-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Vitals</p>
                    <p className="text-slate-600 dark:text-slate-300 font-mono">
                      BP: {activeRx.vitals?.bp || '—'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 font-mono">
                      Pulse: {activeRx.vitals?.pulse || '—'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 font-mono">
                      Temp: {activeRx.vitals?.temp || '—'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 font-mono">
                      Weight: {activeRx.vitals?.weight || '—'}
                    </p>
                  </div>
                  {activeRx.chiefComplaints && (
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                        Chief Complaints
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {activeRx.chiefComplaints}
                      </p>
                    </div>
                  )}
                  {activeRx.diagnosis && (
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                        Diagnosis
                      </p>
                      <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                        {activeRx.diagnosis}
                      </p>
                    </div>
                  )}
                  {activeRx.investigationAdvice && (
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                        Investigations
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {activeRx.investigationAdvice}
                      </p>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-4">
                  <p className="text-base font-bold font-serif text-slate-900 dark:text-slate-100">
                    Rx
                  </p>
                  <ol className="space-y-3">
                    {activeRx.medicines.map((med, index) => (
                      <li
                        key={`${med.name}-${index}`}
                        className="pb-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {index + 1}. {med.name}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          {med.dosage} · <span className="font-mono">{med.frequency}</span> ·{' '}
                          {med.duration} {med.instructions ? `· ${med.instructions}` : ''}
                        </p>
                      </li>
                    ))}
                  </ol>

                  {activeRx.treatmentPlan && (
                    <div className="pt-2 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        Clinical Advice
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                        {activeRx.treatmentPlan}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                <p className="text-slate-500">
                  {activeRx.followUpDate ? `Follow-up date: ${activeRx.followUpDate}` : organization.prescriptionFooter}
                </p>
                <div className="flex items-center gap-3">
                  {activeRx.status === 'draft' ? (
                    <button
                      type="button"
                      onClick={() => onFinalizePrescription(activeRx.id)}
                      className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Finalize &amp; Lock Rx</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Finalized · {activeRx.digitalSignature}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
              Select or create a prescription to preview and print.
            </div>
          )}
        </div>
      </div>

      {/* Create Prescription Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Write Digital Prescription</h2>
              <button
                type="button"
                onClick={() => {
                  onClearPrefill();
                  setModalOpen(false);
                }}
                className="cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Patient</span>
                <select
                  required
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Doctor</span>
                <select
                  required
                  value={form.doctorId}
                  onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Print Template</span>
                <select
                  value={form.templateType}
                  onChange={(e) =>
                    setForm({ ...form, templateType: e.target.value as Prescription['templateType'] })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="general_a4">General A4</option>
                  <option value="compact">Compact</option>
                  <option value="homeopathy">Homeopathy</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <input
                value={form.bp}
                onChange={(e) => setForm({ ...form, bp: e.target.value })}
                placeholder="BP (120/80)"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                value={form.pulse}
                onChange={(e) => setForm({ ...form, pulse: e.target.value })}
                placeholder="Pulse (74 bpm)"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                value={form.temp}
                onChange={(e) => setForm({ ...form, temp: e.target.value })}
                placeholder="Temp (98.4 °F)"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="Weight (68 kg)"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <textarea
                rows={2}
                value={form.chiefComplaints}
                onChange={(e) => setForm({ ...form, chiefComplaints: e.target.value })}
                placeholder="Chief complaints..."
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <textarea
                rows={2}
                required
                value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                placeholder="Primary diagnosis..."
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Medicines
                </span>
                <button
                  type="button"
                  onClick={addMedicineRow}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  + Add Medicine
                </button>
              </div>
              {form.medicines.map((med, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 text-xs">
                  <input
                    required
                    placeholder="Medicine name"
                    value={med.name}
                    onChange={(e) => updateMed(i, 'name', e.target.value)}
                    className="col-span-4 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <input
                    placeholder="Freq (1-0-1)"
                    value={med.frequency}
                    onChange={(e) => updateMed(i, 'frequency', e.target.value)}
                    className="col-span-3 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <input
                    placeholder="Duration"
                    value={med.duration}
                    onChange={(e) => updateMed(i, 'duration', e.target.value)}
                    className="col-span-2 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <input
                    placeholder="Instructions"
                    value={med.instructions}
                    onChange={(e) => updateMed(i, 'instructions', e.target.value)}
                    className="col-span-2 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => removeMed(i)}
                    className="col-span-1 flex items-center justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onClearPrefill();
                  setModalOpen(false);
                }}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Save Draft Rx
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
