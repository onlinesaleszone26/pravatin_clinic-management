'use client';

import React, { useState } from 'react';
import { Download, FileText, Plus, Receipt, Trash2, X } from 'lucide-react';
import type {
  Appointment,
  AppointmentStatus,
  CurrencyCode,
  Doctor,
  Patient,
} from '@/lib/types';
import { downloadFile, formatCurrency, getTodayIsoDate, toCsv } from '@/lib/utils';

interface AppointmentsViewProps {
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  currency: CurrencyCode;
  onCreateAppointment: (
    apt: Omit<
      Appointment,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
  onDeleteAppointment: (id: string) => void;
  onHandoffToRx: (apt: Appointment) => void;
  onHandoffToBilling: (apt: Appointment) => void;
}

const NEXT_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  pending: 'confirmed',
  confirmed: 'checked_in',
  checked_in: 'in_consultation',
  in_consultation: 'completed',
};

export function AppointmentsView({
  appointments,
  patients,
  doctors,
  currency,
  onCreateAppointment,
  onUpdateStatus,
  onDeleteAppointment,
  onHandoffToRx,
  onHandoffToBilling,
}: AppointmentsViewProps) {
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [form, setForm] = useState({
    patientId: patients[0]?.id || '',
    doctorId: doctors[0]?.id || '',
    date: getTodayIsoDate(),
    timeSlot: '10:30',
    type: 'new' as Appointment['type'],
    notes: '',
  });

  const filtered = appointments.filter((a) => {
    if (filter === 'active') return !['completed', 'cancelled', 'no_show'].includes(a.status);
    if (filter === 'completed') return a.status === 'completed';
    return true;
  });

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);
    const conflict = appointments.find(
      (a) =>
        a.doctorId === form.doctorId &&
        a.date === form.date &&
        a.timeSlot === form.timeSlot &&
        !['cancelled', 'no_show'].includes(a.status)
    );
    if (conflict) {
      setConflictError(
        `Slot conflict: ${conflict.doctorName} already has ${conflict.patientName} booked at ${form.timeSlot} on ${form.date}.`
      );
      return;
    }

    const pat = patients.find((p) => p.id === form.patientId);
    const doc = doctors.find((d) => d.id === form.doctorId);
    if (!pat || !doc) return;

    const sameDayCount = appointments.filter((a) => a.date === form.date).length;
    onCreateAppointment({
      appointmentNumber: `APT-${2401 + appointments.length}`,
      queueToken: sameDayCount + 1,
      patientId: pat.id,
      patientName: pat.name,
      patientPhone: pat.phone,
      doctorId: doc.id,
      doctorName: doc.name,
      date: form.date,
      timeSlot: form.timeSlot,
      type: form.type,
      consultationFee:
        form.type === 'follow_up' ? doc.followUpFee ?? doc.consultationFee : doc.consultationFee,
      status: 'confirmed',
      paymentStatus: 'unpaid',
      notes: form.notes.trim() || undefined,
    });
    setModalOpen(false);
  };

  const handleExportCsv = () => {
    const csv = toCsv(
      ['Number', 'Token', 'Date', 'Slot', 'Patient', 'Doctor', 'Type', 'Fee', 'Status', 'Payment'],
      appointments.map((a) => [
        a.appointmentNumber,
        a.queueToken,
        a.date,
        a.timeSlot,
        a.patientName,
        a.doctorName,
        a.type,
        a.consultationFee,
        a.status,
        a.paymentStatus,
      ])
    );
    downloadFile(csv, `pravaclin-appointments-${getTodayIsoDate()}.csv`, 'text/csv;charset=utf-8;');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Appointments &amp; Live Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Token-based queue progression with slot conflict prevention and clinical handoff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setConflictError(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-fit">
        {[
          { id: 'active', label: 'Active Queue' },
          { id: 'completed', label: 'Completed Visits' },
          { id: 'all', label: 'All Appointments' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filter === tab.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Token &amp; Slot</th>
              <th className="py-3 px-4">Patient</th>
              <th className="py-3 px-4">Doctor</th>
              <th className="py-3 px-4">Fee &amp; Status</th>
              <th className="py-3 px-4 text-right">Workflow Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  No appointments in this queue view.
                </td>
              </tr>
            ) : (
              filtered.map((apt) => {
                const next = NEXT_STATUS[apt.status];
                return (
                  <tr
                    key={apt.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Token #{apt.queueToken} · {apt.timeSlot}
                      </p>
                      <p className="text-slate-500">
                        {apt.date} · {apt.appointmentNumber}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {apt.patientName}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {apt.type.replace('_', ' ')} {apt.notes ? `· ${apt.notes}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {apt.doctorName}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(apt.consultationFee, currency)} ·{' '}
                        <span className="capitalize">{apt.paymentStatus}</span>
                      </p>
                      <p className="capitalize text-slate-500">{apt.status.replace('_', ' ')}</p>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      {next && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(apt.id, next)}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer capitalize"
                        >
                          → {next.replace('_', ' ')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onHandoffToRx(apt)}
                        title="Create Prescription"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Rx</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onHandoffToBilling(apt)}
                        title="Create Invoice"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Bill</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAppointment(apt.id)}
                        aria-label="Remove appointment"
                        className="inline-flex text-slate-400 hover:text-rose-600 cursor-pointer align-middle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Book Appointment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleBook}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Book New Appointment</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {conflictError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-3">
                {conflictError}
              </p>
            )}

            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Patient</span>
                <select
                  required
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.patientCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Doctor</span>
                <select
                  required
                  value={form.doctorId}
                  onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialization}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Date</span>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Time Slot</span>
                  <input
                    type="time"
                    required
                    value={form.timeSlot}
                    onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Visit Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Appointment['type'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="new">New Consultation</option>
                  <option value="follow_up">Follow-Up</option>
                  <option value="emergency">Emergency</option>
                  <option value="teleconsult">Teleconsult</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Notes</span>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Chief reason for visit..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
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
                Confirm Booking
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
