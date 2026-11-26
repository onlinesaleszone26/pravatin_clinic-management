'use client';

import React, { useMemo, useState } from 'react';
import { Stethoscope, Plus, Edit3, Trash2, CalendarClock, X } from 'lucide-react';
import { saveDoctor, removeDoctor, TenantActor } from '@/lib/firestore-service';
import {
  formatMoney,
  generateDoctorSlots,
  MEDICAL_SPECIALTIES,
  REGISTRATION_LABELS,
  todayISO,
} from '@/lib/clinic-utils';
import type { Organization, Doctor, Branch, Appointment } from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  doctors: Doctor[];
  branches: Branch[];
  appointments: Appointment[];
}

const ALL_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function DoctorsModule({ org, actor, doctors, branches, appointments }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [selectedScheduleDoc, setSelectedScheduleDoc] = useState<Doctor | null>(null);
  const [previewDate, setPreviewDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [discipline, setDiscipline] = useState('Allopathic');
  const [qualifications, setQualifications] = useState('');
  const [registrationLabel, setRegistrationLabel] = useState('BMDC Reg. No.');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [chamberInfo, setChamberInfo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [consultationFee, setConsultationFee] = useState('800');
  const [followUpFee, setFollowUpFee] = useState('500');
  const [experienceYears, setExperienceYears] = useState('5');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('15');
  const [availableDays, setAvailableDays] = useState<string[]>(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']);
  const [morningShift, setMorningShift] = useState('09:00-13:00');
  const [eveningShift, setEveningShift] = useState('17:00-21:00');
  const [breakTime, setBreakTime] = useState('13:00-14:00');
  const [leaveDatesText, setLeaveDatesText] = useState('');
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [status, setStatus] = useState<'active' | 'on_leave' | 'inactive'>('active');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setSpecialization('General Medicine');
    setDiscipline('Allopathic');
    setQualifications('MBBS, FCPS');
    setRegistrationLabel('BMDC Reg. No.');
    setRegistrationNumber('');
    setPhone('');
    setEmail('');
    setChamberInfo('');
    setBranchId(branches[0]?.id || '');
    setConsultationFee('800');
    setFollowUpFee('500');
    setExperienceYears('5');
    setSlotDurationMinutes('15');
    setAvailableDays(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']);
    setMorningShift('09:00-13:00');
    setEveningShift('17:00-21:00');
    setBreakTime('13:00-14:00');
    setLeaveDatesText('');
    setEmergencyAvailable(false);
    setStatus('active');
    setError(null);
    setShowModal(true);
  };

  const openEdit = (d: Doctor) => {
    setEditing(d);
    setName(d.name);
    setSpecialization(d.specialization);
    setDiscipline(d.discipline || 'Allopathic');
    setQualifications(d.qualifications || '');
    setRegistrationLabel(d.registrationLabel || 'BMDC Reg. No.');
    setRegistrationNumber(d.registrationNumber || '');
    setPhone(d.phone || '');
    setEmail(d.email || '');
    setChamberInfo(d.chamberInfo || '');
    setBranchId(d.branchId || '');
    setConsultationFee(String(d.consultationFee));
    setFollowUpFee(String(d.followUpFee ?? 0));
    setExperienceYears(String(d.experienceYears ?? 0));
    setSlotDurationMinutes(String(d.slotDurationMinutes || 15));
    setAvailableDays(d.availableDays || ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']);
    setMorningShift(d.morningShift || '09:00-13:00');
    setEveningShift(d.eveningShift || '17:00-21:00');
    setBreakTime(d.breakTime || '13:00-14:00');
    setLeaveDatesText((d.leaveDates || []).join(', '));
    setEmergencyAvailable(Boolean(d.emergencyAvailable));
    setStatus(d.status);
    setError(null);
    setShowModal(true);
  };

  const toggleDay = (day: string) => {
    setAvailableDays((prev) => (prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day]));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Doctor full name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const leaveDates = leaveDatesText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

      await saveDoctor(
        org,
        actor,
        {
          id: editing?.id,
          doctorCode: editing?.doctorCode,
          name: name.trim(),
          specialization,
          discipline,
          qualifications: qualifications.trim(),
          registrationLabel,
          registrationNumber: registrationNumber.trim(),
          phone: phone.trim(),
          email: email.trim(),
          chamberInfo: chamberInfo.trim(),
          branchId,
          consultationFee: Number(consultationFee || 0),
          followUpFee: Number(followUpFee || 0),
          experienceYears: Number(experienceYears || 0),
          slotDurationMinutes: Number(slotDurationMinutes || 15),
          availableDays,
          morningShift: morningShift.trim(),
          eveningShift: eveningShift.trim(),
          breakTime: breakTime.trim(),
          leaveDates,
          emergencyAvailable,
          status,
        },
        doctors.length + 1
      );
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save doctor.');
    } finally {
      setSaving(false);
    }
  };

  const activePreviewDoc = selectedScheduleDoc || doctors[0] || null;
  const slotPreview = useMemo(
    () => generateDoctorSlots(activePreviewDoc || undefined, previewDate, appointments),
    [activePreviewDoc, previewDate, appointments]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Doctors & Schedule Matrix ({doctors.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Supports Allopathic, Dental, Homeopathic & specialist registration systems with automatic slot generation.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> Add Doctor
        </button>
      </div>

      {/* Doctors List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {doctors.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Stethoscope className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400">No doctors registered in this clinic yet.</p>
            <button type="button" onClick={openCreate} className="px-4 py-2 text-xs font-medium text-white bg-[#047857] rounded-lg">
              Add First Doctor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Doctor</th>
                  <th className="py-3 px-4 font-medium">Specialty & Credentials</th>
                  <th className="py-3 px-4 font-medium">Schedule & Shifts</th>
                  <th className="py-3 px-4 font-medium text-right">Fees</th>
                  <th className="py-3 px-4 font-medium text-right">Visits</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {doctors.map((d) => {
                  const visitCount = appointments.filter((a) => a.doctorId === d.id).length;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">{d.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{d.doctorCode} · {d.chamberInfo || 'Main Chamber'}</p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{d.specialization}</p>
                        <p className="text-slate-500 dark:text-slate-400">
                          {d.qualifications || '—'} {d.registrationNumber ? `· ${d.registrationLabel || 'Reg'}: ${d.registrationNumber}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                        <p>{(d.availableDays || []).join(', ')}</p>
                        <p className="font-mono text-xs">
                          AM {d.morningShift || '—'} · PM {d.eveningShift || '—'} ({d.slotDurationMinutes}m)
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                        <p className="font-semibold text-slate-900 dark:text-white">{formatMoney(d.consultationFee, org.currency)}</p>
                        <p className="text-slate-500">Follow-up: {formatMoney(d.followUpFee || 0, org.currency)}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                        {visitCount}
                      </td>
                      <td className="py-3 px-4 text-xs capitalize">
                        <span className={d.status === 'active' ? 'text-teal-700 dark:text-teal-400 font-medium' : d.status === 'on_leave' ? 'text-amber-600' : 'text-slate-500'}>
                          {d.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => setSelectedScheduleDoc(d)} title="Inspect Slots" className="p-1.5 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400">
                            <CalendarClock className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => openEdit(d)} title="Edit Doctor & Schedule" className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {(actor.role === 'clinic_owner' || actor.role === 'clinic_admin') && (
                            <button type="button" onClick={() => removeDoctor(org, actor, d.id, d.name)} title="Remove" className="p-1.5 text-slate-500 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Auto-Generated Slot Inspector */}
      {activePreviewDoc && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Live Slot Generator — {activePreviewDoc.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically computed from shifts ({activePreviewDoc.morningShift || '—'} / {activePreviewDoc.eveningShift || '—'}), break ({activePreviewDoc.breakTime || 'None'}), and {activePreviewDoc.slotDurationMinutes}-min slot duration.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={activePreviewDoc.id}
                onChange={(e) => setSelectedScheduleDoc(doctors.find((d) => d.id === e.target.value) || null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {slotPreview.unavailableReason ? (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg">
              {slotPreview.unavailableReason}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {slotPreview.slots.map((slot) => (
                <div
                  key={slot.label}
                  className={`px-2.5 py-2 rounded-lg border text-center text-xs font-mono tabular-nums ${
                    slot.booked
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                  title={slot.booked ? `Booked by ${slot.bookedBy}` : 'Available'}
                >
                  {slot.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Doctor & Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editing ? `Edit Doctor & Schedule — ${editing.name}` : 'Register New Doctor'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <p className="mb-4 text-xs text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Farzana Rahman" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'on_leave' | 'inactive')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Specialization *</label>
                  <select value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    {MEDICAL_SPECIALTIES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Medical Discipline</label>
                  <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="Allopathic">Allopathic / Modern Medicine</option>
                    <option value="Homeopathic">Homeopathy</option>
                    <option value="Dental">Dentistry</option>
                    <option value="Diagnostics">Pathology / Diagnostics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Qualifications</label>
                  <input value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="MBBS, FCPS / BHMS" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Registration Authority</label>
                  <select value={registrationLabel} onChange={(e) => setRegistrationLabel(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    {REGISTRATION_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Registration Number</label>
                  <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="A-48291" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Chamber / Room</label>
                  <input value={chamberInfo} onChange={(e) => setChamberInfo(e.target.value)} placeholder="Room 201, Level 2" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Consultation Fee ({org.currency}) *</label>
                  <input type="number" min={0} required value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Follow-up Fee ({org.currency})</label>
                  <input type="number" min={0} value={followUpFee} onChange={(e) => setFollowUpFee(e.target.value)} className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Slot Duration (min)</label>
                  <select value={slotDurationMinutes} onChange={(e) => setSlotDurationMinutes(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                    <option value="10">10 min</option>
                    <option value="15">15 min</option>
                    <option value="20">20 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Morning Shift (24h)</label>
                  <input value={morningShift} onChange={(e) => setMorningShift(e.target.value)} placeholder="09:00-13:00" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Evening Shift (24h)</label>
                  <input value={eveningShift} onChange={(e) => setEveningShift(e.target.value)} placeholder="17:00-21:00" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Break Time</label>
                  <input value={breakTime} onChange={(e) => setBreakTime(e.target.value)} placeholder="13:00-14:00" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Available Weekly Days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          availableDays.includes(day)
                            ? 'bg-[#047857] text-white border-[#047857]'
                            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Leave Dates (YYYY-MM-DD, comma separated)</label>
                  <input value={leaveDatesText} onChange={(e) => setLeaveDatesText(e.target.value)} placeholder="2026-12-01, 2026-12-02" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={emergencyAvailable} onChange={(e) => setEmergencyAvailable(e.target.checked)} className="rounded border-slate-300 text-emerald-700" />
                    <span>Emergency On-Call</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg disabled:opacity-60">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
