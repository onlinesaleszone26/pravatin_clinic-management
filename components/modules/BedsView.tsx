'use client';

import React, { useState } from 'react';
import { BedDouble, Plus, X } from 'lucide-react';
import type { Bed, CurrencyCode, Doctor, Patient } from '@/lib/types';
import { formatCurrency, getTodayIsoDate } from '@/lib/utils';

interface BedsViewProps {
  beds: Bed[];
  patients: Patient[];
  doctors: Doctor[];
  currency: CurrencyCode;
  onCreateBed: (
    bed: Omit<
      Bed,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
  onUpdateBed: (bedId: string, patch: Partial<Bed>) => void;
}

export function BedsView({
  beds,
  patients,
  doctors,
  currency,
  onCreateBed,
  onUpdateBed,
}: BedsViewProps) {
  const [admittingBed, setAdmittingBed] = useState<Bed | null>(null);
  const [addBedOpen, setAddBedOpen] = useState(false);

  const [admitForm, setAdmitForm] = useState({
    patientId: patients[0]?.id || '',
    doctorName: doctors[0]?.name || '',
    nursingNotes: '',
  });

  const [bedForm, setBedForm] = useState({
    wardName: 'General Ward',
    roomNumber: 'W-105',
    bedNumber: `B-0${beds.length + 1}`,
    type: 'general_ward' as Bed['type'],
    dailyRate: 75,
  });

  const handleAdmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admittingBed) return;
    const pat = patients.find((p) => p.id === admitForm.patientId);
    if (!pat) return;
    onUpdateBed(admittingBed.id, {
      status: 'occupied',
      currentPatientId: pat.id,
      currentPatientName: pat.name,
      admittedAt: getTodayIsoDate(),
      attendingDoctorName: admitForm.doctorName,
      nursingNotes: admitForm.nursingNotes.trim() || undefined,
    });
    setAdmittingBed(null);
  };

  const handleDischarge = (bed: Bed) => {
    onUpdateBed(bed.id, {
      status: 'available',
      currentPatientId: '',
      currentPatientName: '',
      admittedAt: '',
      attendingDoctorName: '',
      nursingNotes: '',
    });
  };

  const handleCreateBed = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateBed({
      wardName: bedForm.wardName.trim(),
      roomNumber: bedForm.roomNumber.trim() || undefined,
      bedNumber: bedForm.bedNumber.trim(),
      type: bedForm.type,
      dailyRate: Number(bedForm.dailyRate) || 0,
      status: 'available',
    });
    setAddBedOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Inpatient Beds &amp; Cabins
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ward/cabin occupancy, patient admission, nursing notes, and discharge management.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddBedOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bed / Cabin</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {beds.map((bed) => (
          <div
            key={bed.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {bed.wardName} · {bed.bedNumber}
                  </h3>
                  <p className="text-xs text-slate-500 capitalize">
                    {bed.type.replace('_', ' ')} · Room {bed.roomNumber || '—'} ·{' '}
                    <span className="font-mono tabular-nums">
                      {formatCurrency(bed.dailyRate, currency)}/day
                    </span>
                  </p>
                </div>
                <BedDouble className="w-4 h-4 text-slate-400" />
              </div>

              {bed.status === 'occupied' ? (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Admitted: {bed.currentPatientName}
                  </p>
                  <p className="text-slate-500">
                    Since {bed.admittedAt} · {bed.attendingDoctorName}
                  </p>
                  {bed.nursingNotes && (
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                      {bed.nursingNotes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 capitalize">
                  Status: {bed.status}
                  {bed.nursingNotes ? ` — ${bed.nursingNotes}` : ''}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span
                className={`font-medium capitalize ${
                  bed.status === 'available'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : bed.status === 'occupied'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-500'
                }`}
              >
                {bed.status}
              </span>
              {bed.status === 'available' && (
                <button
                  type="button"
                  onClick={() => setAdmittingBed(bed)}
                  className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Admit Patient
                </button>
              )}
              {bed.status === 'occupied' && (
                <button
                  type="button"
                  onClick={() => handleDischarge(bed)}
                  className="font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Discharge
                </button>
              )}
              {bed.status === 'maintenance' && (
                <button
                  type="button"
                  onClick={() => onUpdateBed(bed.id, { status: 'available', nursingNotes: '' })}
                  className="font-medium text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Mark Available
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Admit Modal */}
      {admittingBed && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAdmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">
                Admit to {admittingBed.wardName} ({admittingBed.bedNumber})
              </h2>
              <button type="button" onClick={() => setAdmittingBed(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <select
                required
                value={admitForm.patientId}
                onChange={(e) => setAdmitForm({ ...admitForm, patientId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.patientCode})
                  </option>
                ))}
              </select>
              <select
                value={admitForm.doctorName}
                onChange={(e) => setAdmitForm({ ...admitForm, doctorName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <textarea
                rows={3}
                placeholder="Initial admission & nursing notes..."
                value={admitForm.nursingNotes}
                onChange={(e) => setAdmitForm({ ...admitForm, nursingNotes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAdmittingBed(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Confirm Admission
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Bed Modal */}
      {addBedOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateBed}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Add Ward Bed or Cabin</h2>
              <button type="button" onClick={() => setAddBedOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <input
                required
                placeholder="Ward / Cabin Name"
                value={bedForm.wardName}
                onChange={(e) => setBedForm({ ...bedForm, wardName: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                placeholder="Room No."
                value={bedForm.roomNumber}
                onChange={(e) => setBedForm({ ...bedForm, roomNumber: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                required
                placeholder="Bed No."
                value={bedForm.bedNumber}
                onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <select
                value={bedForm.type}
                onChange={(e) => setBedForm({ ...bedForm, type: e.target.value as Bed['type'] })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="general_ward">General Ward</option>
                <option value="semi_cabin">Semi Cabin</option>
                <option value="vip_cabin">VIP Cabin</option>
                <option value="icu">ICU</option>
              </select>
              <input
                type="number"
                min={0}
                required
                placeholder="Daily Rate"
                value={bedForm.dailyRate}
                onChange={(e) => setBedForm({ ...bedForm, dailyRate: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAddBedOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Add Bed
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
