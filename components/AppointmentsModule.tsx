'use client';

import React, { useMemo, useState } from 'react';
import { CalendarPlus, Search, X, FilePlus2, Receipt, AlertCircle, Trash2 } from 'lucide-react';
import {
  createAppointment,
  updateAppointment,
  removeAppointment,
  removeCompletedAppointments,
  TenantActor,
} from '@/lib/firestore-service';
import { formatMoney, generateDoctorSlots, todayISO } from '@/lib/clinic-utils';
import type {
  Organization,
  Patient,
  Doctor,
  Appointment,
  AppointmentStatus,
  Branch,
} from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  patients: Patient[];
  doctors: Doctor[];
  branches: Branch[];
  appointments: Appointment[];
  onStartPrescription: (apt: Appointment) => void;
  onStartInvoice: (apt: Appointment) => void;
}

const STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
];

export function AppointmentsModule({
  org,
  actor,
  patients,
  doctors,
  branches,
  appointments,
  onStartPrescription,
  onStartInvoice,
}: Props) {
  const [view, setView] = useState<'list' | 'daily' | 'followups'>('list');
  const [filterDate, setFilterDate] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dailyDate, setDailyDate] = useState(todayISO());

  // Booking Modal state
  const [showModal, setShowModal] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [timeSlot, setTimeSlot] = useState('');
  const [type, setType] = useState<'new' | 'follow_up' | 'emergency' | 'teleconsult'>('new');
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteApt, setConfirmDeleteApt] = useState<Appointment | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = actor.role === 'clinic_owner' || actor.role === 'clinic_admin';

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId), [doctors, doctorId]);

  const slotInfo = useMemo(
    () => generateDoctorSlots(selectedDoctor, date, appointments),
    [selectedDoctor, date, appointments]
  );

  const consultationFee = useMemo(() => {
    if (!selectedDoctor) return 0;
    return type === 'follow_up' ? selectedDoctor.followUpFee || selectedDoctor.consultationFee : selectedDoctor.consultationFee;
  }, [selectedDoctor, type]);

  const openBook = () => {
    setPatientId(patients[0]?.id || '');
    setDoctorId(doctors[0]?.id || '');
    setDate(todayISO());
    setTimeSlot('');
    setType('new');
    setPaymentStatus('unpaid');
    setBranchId(branches[0]?.id || '');
    setNotes('');
    setFollowUpDate('');
    setFollowUpReason('');
    setError(null);
    setShowModal(true);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === patientId);
    const docObj = doctors.find((d) => d.id === doctorId);
    if (!pat || !docObj) {
      setError('Please select both a patient and a doctor.');
      return;
    }
    if (!timeSlot) {
      setError('Please pick an available time slot.');
      return;
    }
    // Double-booking prevention check
    const clash = appointments.find(
      (a) =>
        a.doctorId === docObj.id &&
        a.date === date &&
        a.timeSlot === timeSlot &&
        a.status !== 'cancelled' &&
        a.status !== 'no_show'
    );
    if (clash) {
      setError(`Slot ${timeSlot} is already booked by ${clash.patientName}. Choose another slot.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const sameDayCount = appointments.filter((a) => a.doctorId === docObj.id && a.date === date).length;
      await createAppointment(
        org,
        actor,
        {
          patientId: pat.id,
          patientName: pat.name,
          patientPhone: pat.phone,
          patientAuthUid: pat.patientAuthUid,
          doctorId: docObj.id,
          doctorName: docObj.name,
          branchId,
          date,
          timeSlot,
          type,
          consultationFee,
          status: 'confirmed',
          paymentStatus,
          notes,
          followUpDate,
          followUpReason,
          queueToken: sameDayCount + 1,
        },
        appointments.length + 1
      );
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments
      .filter((a) => {
        if (view === 'daily' && a.date !== dailyDate) return false;
        if (view === 'followups' && !a.followUpDate) return false;
        if (view === 'list' && filterDate && a.date !== filterDate) return false;
        if (filterDoctor !== 'all' && a.doctorId !== filterDoctor) return false;
        if (filterStatus !== 'all' && a.status !== filterStatus) return false;
        if (!q) return true;
        return (
          a.patientName.toLowerCase().includes(q) ||
          a.doctorName.toLowerCase().includes(q) ||
          a.appointmentNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.queueToken - b.queueToken);
  }, [appointments, view, dailyDate, filterDate, filterDoctor, filterStatus, search]);

  const completedInView = useMemo(
    () => filtered.filter((a) => a.status === 'completed'),
    [filtered]
  );

  const handleConfirmDeleteSingle = async () => {
    if (!confirmDeleteApt) return;
    setDeleting(true);
    try {
      await removeAppointment(
        org,
        actor,
        confirmDeleteApt.id,
        `${confirmDeleteApt.appointmentNumber} (${confirmDeleteApt.patientName})`
      );
      setConfirmDeleteApt(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (completedInView.length === 0) return;
    setDeleting(true);
    try {
      await removeCompletedAppointments(
        org,
        actor,
        completedInView.map((a) => ({ id: a.id, patientName: a.patientName }))
      );
      setConfirmBulkDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* View Tabs & Primary CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'list' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Appointments ({appointments.length})
          </button>
          <button
            type="button"
            onClick={() => setView('daily')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'daily' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Daily Queue
          </button>
          <button
            type="button"
            onClick={() => setView('followups')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === 'followups' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Follow-Ups ({appointments.filter((a) => a.followUpDate).length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {canDelete && completedInView.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmBulkDelete(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Completed ({completedInView.length})
            </button>
          )}
          <button
            type="button"
            onClick={openBook}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg whitespace-nowrap"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Book Appointment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, doctor, or APT ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        </div>
        {view === 'daily' ? (
          <input
            type="date"
            value={dailyDate}
            onChange={(e) => setDailyDate(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        ) : (
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        )}
        <select
          value={filterDoctor}
          onChange={(e) => setFilterDoctor(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        >
          <option value="all">All Doctors</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Appointments Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">No appointments found for the selected filter.</p>
            <button type="button" onClick={openBook} className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">
              Book New Appointment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Token / Ref</th>
                  <th className="py-3 px-4 font-medium">Patient</th>
                  <th className="py-3 px-4 font-medium">Doctor</th>
                  <th className="py-3 px-4 font-medium">Date & Slot</th>
                  <th className="py-3 px-4 font-medium text-right">Fee</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filtered.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">#{apt.queueToken}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600 dark:text-slate-400">{apt.appointmentNumber}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">{apt.patientName}</p>
                      <p className="text-xs text-slate-500 font-mono">{apt.patientPhone || '—'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{apt.doctorName}</p>
                      <p className="text-slate-500 capitalize">{apt.type.replace('_', ' ')}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <p>{apt.date} · {apt.timeSlot}</p>
                      {apt.followUpDate && (
                        <p className="text-xs text-teal-700 dark:text-teal-400">Follow-up: {apt.followUpDate}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      <p className="font-semibold text-slate-900 dark:text-white">{formatMoney(apt.consultationFee, org.currency)}</p>
                      <p className={apt.paymentStatus === 'paid' ? 'text-teal-600' : 'text-amber-600'}>{apt.paymentStatus}</p>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={apt.status}
                        onChange={(e) =>
                          updateAppointment(org, actor, apt.id, { status: e.target.value as AppointmentStatus })
                        }
                        className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 capitalize"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onStartPrescription(apt)}
                          title="Write Digital Prescription"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-400 border border-slate-200 dark:border-slate-700 hover:border-teal-500 rounded-md"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" /> Rx
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartInvoice(apt)}
                          title="Generate Invoice"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-md"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Bill
                        </button>
                        {canDelete && (apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show') && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteApt(apt)}
                            title="Delete Completed / Closed Visit"
                            aria-label={`Delete appointment for ${apt.patientName}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Book New Appointment</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleBook} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient *</label>
                  <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="">Select Patient</option>
                    {patients.filter((p) => p.status === 'active').map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.patientCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Doctor *</label>
                  <select required value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setTimeSlot(''); }} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="">Select Doctor</option>
                    {doctors.filter((d) => d.status !== 'inactive').map((d) => (
                      <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Appointment Date *</label>
                  <input type="date" required value={date} onChange={(e) => { setDate(e.target.value); setTimeSlot(''); }} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Appointment Type & Fee</label>
                  <div className="flex items-center gap-2">
                    <select value={type} onChange={(e) => setType(e.target.value as 'new' | 'follow_up' | 'emergency' | 'teleconsult')} className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                      <option value="new">New Visit</option>
                      <option value="follow_up">Follow-Up</option>
                      <option value="emergency">Emergency</option>
                      <option value="teleconsult">Teleconsult</option>
                    </select>
                    <span className="px-3 py-2 text-sm font-mono font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white">
                      {formatMoney(consultationFee, org.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Slot Picker with Double-Booking Prevention */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Available Time Slot * (Occupied slots are locked)
                </label>
                {slotInfo.unavailableReason ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg">
                    {slotInfo.unavailableReason}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-44 overflow-y-auto p-1">
                    {slotInfo.slots.map((slot) => (
                      <button
                        key={slot.label}
                        type="button"
                        disabled={slot.booked}
                        onClick={() => setTimeSlot(slot.label)}
                        className={`px-2 py-2 text-xs font-mono rounded-lg border transition-colors ${
                          slot.booked
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through cursor-not-allowed'
                            : timeSlot === slot.label
                              ? 'bg-[#047857] text-white border-[#047857]'
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500'
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Status</label>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'unpaid' | 'partial' | 'paid')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Follow-Up Date</label>
                  <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Follow-Up Reason</label>
                  <input value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)} placeholder="Lab review" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes / Chief Reason</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional booking notes..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !timeSlot} className="px-4 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg disabled:opacity-50">
                  {saving ? 'Booking...' : 'Confirm Booking & Issue Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Single Appointment Delete Modal */}
      {confirmDeleteApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 sm:p-6 my-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Visit Record</h3>
                  <p className="text-xs text-slate-500">Remove this completed/closed appointment from the list.</p>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmDeleteApt(null)} disabled={deleting}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                {confirmDeleteApt.patientName} <span className="font-mono text-slate-500">({confirmDeleteApt.appointmentNumber})</span>
              </p>
              <p className="text-slate-500">
                {confirmDeleteApt.doctorName} · {confirmDeleteApt.date} {confirmDeleteApt.timeSlot} ·{' '}
                <span className="capitalize">{confirmDeleteApt.status.replace('_', ' ')}</span>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDeleteApt(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting...' : 'Delete Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Bulk Delete Completed Visits Modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 sm:p-6 my-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete All Completed Visits</h3>
                  <p className="text-xs text-slate-500">
                    Permanently remove {completedInView.length} completed appointment(s) shown in the current view.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmBulkDelete(false)} disabled={deleting}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Patient profile records, prescriptions, lab reports, and invoices will remain safely preserved in their respective modules.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting...' : `Delete ${completedInView.length} Completed`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
