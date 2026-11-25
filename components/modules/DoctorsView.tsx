'use client';

import React, { useState } from 'react';
import { Clock, Plus, Stethoscope, X } from 'lucide-react';
import type { CurrencyCode, Doctor } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface DoctorsViewProps {
  doctors: Doctor[];
  currency: CurrencyCode;
  onSaveDoctor: (
    doctor: Omit<
      Doctor,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >,
    existingId?: string
  ) => void;
}

export function DoctorsView({ doctors, currency, onSaveDoctor }: DoctorsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [form, setForm] = useState({
    doctorCode: '',
    name: '',
    specialization: '',
    discipline: 'Allopathic',
    qualifications: '',
    registrationLabel: 'BMDC Reg',
    registrationNumber: '',
    phone: '',
    chamberInfo: '',
    consultationFee: 80,
    followUpFee: 40,
    slotDurationMinutes: 20,
    morningShift: '09:00 - 13:00',
    eveningShift: '16:00 - 20:00',
    status: 'active' as Doctor['status'],
  });

  const openNew = () => {
    setEditingId(undefined);
    setForm({
      doctorCode: `DOC-${101 + doctors.length}`,
      name: '',
      specialization: '',
      discipline: 'Allopathic',
      qualifications: '',
      registrationLabel: 'BMDC Reg',
      registrationNumber: '',
      phone: '',
      chamberInfo: '',
      consultationFee: 80,
      followUpFee: 40,
      slotDurationMinutes: 20,
      morningShift: '09:00 - 13:00',
      eveningShift: '16:00 - 20:00',
      status: 'active',
    });
    setModalOpen(true);
  };

  const openEdit = (d: Doctor) => {
    setEditingId(d.id);
    setForm({
      doctorCode: d.doctorCode,
      name: d.name,
      specialization: d.specialization,
      discipline: d.discipline || 'Allopathic',
      qualifications: d.qualifications || '',
      registrationLabel: d.registrationLabel || 'BMDC Reg',
      registrationNumber: d.registrationNumber || '',
      phone: d.phone || '',
      chamberInfo: d.chamberInfo || '',
      consultationFee: d.consultationFee,
      followUpFee: d.followUpFee ?? 0,
      slotDurationMinutes: d.slotDurationMinutes,
      morningShift: d.morningShift || '',
      eveningShift: d.eveningShift || '',
      status: d.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDoctor(
      {
        doctorCode: form.doctorCode.trim(),
        name: form.name.trim(),
        specialization: form.specialization.trim(),
        discipline: form.discipline,
        qualifications: form.qualifications.trim() || undefined,
        registrationLabel: form.registrationLabel.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        phone: form.phone.trim() || undefined,
        chamberInfo: form.chamberInfo.trim() || undefined,
        consultationFee: Number(form.consultationFee) || 0,
        followUpFee: Number(form.followUpFee) || 0,
        slotDurationMinutes: Math.max(5, Math.min(180, Number(form.slotDurationMinutes) || 20)),
        morningShift: form.morningShift.trim() || undefined,
        eveningShift: form.eveningShift.trim() || undefined,
        availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
        status: form.status,
      },
      editingId
    );
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Doctors &amp; Schedules
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Specialist credentials, registration numbers, consultation fees, and shift slots.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Doctor</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.map((docItem) => (
          <div
            key={docItem.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {docItem.name}
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    {docItem.specialization} · {docItem.discipline || 'Allopathic'}
                  </p>
                </div>
                <Stethoscope className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {docItem.qualifications || 'MBBS'} · {docItem.registrationLabel || 'Reg'}:{' '}
                <span className="font-mono">{docItem.registrationNumber || 'Pending'}</span>
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <p className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {docItem.morningShift || '—'} / {docItem.eveningShift || '—'} ({docItem.slotDurationMinutes}m slots)
                  </span>
                </p>
                <p className="font-mono tabular-nums">
                  Consult: {formatCurrency(docItem.consultationFee, currency)} · Follow-up:{' '}
                  {formatCurrency(docItem.followUpFee ?? 0, currency)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                Status: {docItem.status.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={() => openEdit(docItem)}
                className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Edit Schedule
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit Doctor Profile' : 'Add Doctor'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Code</span>
                <input
                  required
                  value={form.doctorCode}
                  onChange={(e) => setForm({ ...form, doctorCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Doctor Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Specialization</span>
                <input
                  required
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Discipline</span>
                <select
                  value={form.discipline}
                  onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="Allopathic">Allopathic</option>
                  <option value="Homeopathic">Homeopathic</option>
                  <option value="Dental">Dental</option>
                  <option value="Specialist">Specialist</option>
                </select>
              </label>
              <label className="space-y-1 col-span-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Qualifications</span>
                <input
                  value={form.qualifications}
                  onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                  placeholder="MBBS, MD, FCPS..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Registration No.</span>
                <input
                  value={form.registrationNumber}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Slot Minutes</span>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.slotDurationMinutes}
                  onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Consultation Fee</span>
                <input
                  type="number"
                  min={0}
                  value={form.consultationFee}
                  onChange={(e) => setForm({ ...form, consultationFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Follow-Up Fee</span>
                <input
                  type="number"
                  min={0}
                  value={form.followUpFee}
                  onChange={(e) => setForm({ ...form, followUpFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Morning Shift</span>
                <input
                  value={form.morningShift}
                  onChange={(e) => setForm({ ...form, morningShift: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Evening Shift</span>
                <input
                  value={form.eveningShift}
                  onChange={(e) => setForm({ ...form, eveningShift: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Save Doctor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
