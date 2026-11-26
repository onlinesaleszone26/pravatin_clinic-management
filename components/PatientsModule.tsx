'use client';

import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  Search,
  Printer,
  Edit3,
  Archive,
  Trash2,
  X,
  Download,
  Eye,
} from 'lucide-react';
import { savePatient, removePatient, removeCompletedAppointments, TenantActor } from '@/lib/firestore-service';
import { exportRowsToCsv, formatMoney } from '@/lib/clinic-utils';
import type {
  Organization,
  Patient,
  Doctor,
  Branch,
  Appointment,
  Prescription,
  LabOrder,
  Invoice,
} from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  patients: Patient[];
  doctors: Doctor[];
  branches: Branch[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  invoices: Invoice[];
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function PatientsModule({
  org,
  actor,
  patients,
  doctors,
  branches,
  appointments,
  prescriptions,
  labOrders,
  invoices,
}: Props) {
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'other'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'archived' | 'all'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [viewing, setViewing] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeletePatient, setConfirmDeletePatient] = useState<Patient | null>(null);
  const [alsoDeleteCompletedAppts, setAlsoDeleteCompletedAppts] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const canDelete = actor.role === 'clinic_owner' || actor.role === 'clinic_admin';

  // Form state
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('');
  const [existingDiseases, setExistingDiseases] = useState('');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [patientAuthUid, setPatientAuthUid] = useState('');
  const [notes, setNotes] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setGender('male');
    setDob('');
    setAge('');
    setBloodGroup('');
    setPhone('');
    setEmail('');
    setAddress('');
    setEmergencyContact('');
    setGuardianName('');
    setMedicalHistory('');
    setAllergies('');
    setExistingDiseases('');
    setAssignedDoctorId(doctors[0]?.id || '');
    setBranchId(branches[0]?.id || '');
    setPatientAuthUid('');
    setNotes('');
    setError(null);
    setShowModal(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setName(p.name);
    setGender(p.gender);
    setDob(p.dob || '');
    setAge(p.age ? String(p.age) : '');
    setBloodGroup(p.bloodGroup || '');
    setPhone(p.phone);
    setEmail(p.email || '');
    setAddress(p.address || '');
    setEmergencyContact(p.emergencyContact || '');
    setGuardianName(p.guardianName || '');
    setMedicalHistory(p.medicalHistory || '');
    setAllergies(p.allergies || '');
    setExistingDiseases(p.existingDiseases || '');
    setAssignedDoctorId(p.assignedDoctorId || '');
    setBranchId(p.branchId || '');
    setPatientAuthUid(p.patientAuthUid || '');
    setNotes(p.notes || '');
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.trim().length < 4) {
      setError('Patient name and valid phone number are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const docObj = doctors.find((d) => d.id === assignedDoctorId);
      await savePatient(
        org,
        actor,
        {
          id: editing?.id,
          patientCode: editing?.patientCode,
          patientAuthUid: patientAuthUid.trim(),
          name: name.trim(),
          gender,
          dob,
          age: age ? Number(age) : 0,
          bloodGroup,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          emergencyContact: emergencyContact.trim(),
          guardianName: guardianName.trim(),
          medicalHistory: medicalHistory.trim(),
          allergies: allergies.trim(),
          existingDiseases: existingDiseases.trim(),
          assignedDoctorId,
          assignedDoctorName: docObj?.name || '',
          branchId,
          notes: notes.trim(),
          status: editing?.status || 'active',
        },
        patients.length + 1
      );
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save patient.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (p: Patient) => {
    await savePatient(org, actor, {
      ...p,
      status: p.status === 'active' ? 'archived' : 'active',
    });
  };

  const completedPatientIds = useMemo(() => {
    const byPatient = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const list = byPatient.get(a.patientId) || [];
      list.push(a);
      byPatient.set(a.patientId, list);
    });
    const set = new Set<string>();
    byPatient.forEach((list, pid) => {
      const hasCompleted = list.some((a) => a.status === 'completed');
      const hasOpen = list.some((a) =>
        a.status === 'pending' ||
        a.status === 'confirmed' ||
        a.status === 'checked_in' ||
        a.status === 'in_consultation'
      );
      if (hasCompleted && !hasOpen) set.add(pid);
    });
    return set;
  }, [appointments]);

  const requestDelete = (p: Patient) => {
    setAlsoDeleteCompletedAppts(true);
    setConfirmDeletePatient(p);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeletePatient) return;
    setDeleting(true);
    try {
      if (alsoDeleteCompletedAppts) {
        const completedAppts = appointments.filter(
          (a) => a.patientId === confirmDeletePatient.id && a.status === 'completed'
        );
        if (completedAppts.length > 0) {
          await removeCompletedAppointments(
            org,
            actor,
            completedAppts.map((a) => ({ id: a.id, patientName: a.patientName }))
          );
        }
      }
      await removePatient(org, actor, confirmDeletePatient.id, confirmDeletePatient.name);
      if (viewing?.id === confirmDeletePatient.id) setViewing(null);
      setConfirmDeletePatient(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      if (statusFilter === 'completed') {
        if (!completedPatientIds.has(p.id)) return false;
      } else if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      if (genderFilter !== 'all' && p.gender !== genderFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.patientCode.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    });
  }, [patients, search, genderFilter, statusFilter, completedPatientIds]);

  const confirmDeleteCompletedCount = confirmDeletePatient
    ? appointments.filter((a) => a.patientId === confirmDeletePatient.id && a.status === 'completed').length
    : 0;

  const deleteConfirmModal = confirmDeletePatient ? (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 sm:p-6 my-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Patient Record</h3>
              <p className="text-xs text-slate-500">This permanently removes the patient from your clinic registry.</p>
            </div>
          </div>
          <button type="button" onClick={() => setConfirmDeletePatient(null)} disabled={deleting}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <p className="font-semibold text-slate-900 dark:text-white">
            {confirmDeletePatient.name} <span className="font-mono text-slate-500">({confirmDeletePatient.patientCode})</span>
          </p>
          <p className="text-slate-500 font-mono">{confirmDeletePatient.phone}</p>
        </div>
        {confirmDeleteCompletedCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={alsoDeleteCompletedAppts}
              onChange={(e) => setAlsoDeleteCompletedAppts(e.target.checked)}
              className="rounded border-slate-300 text-red-600 focus:ring-red-600"
            />
            <span>Also remove {confirmDeleteCompletedCount} completed appointment(s) for this patient</span>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setConfirmDeletePatient(null)}
            disabled={deleting}
            className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting...' : 'Delete Patient'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const handleExport = () => {
    exportRowsToCsv(
      `${org.slug}-patients.csv`,
      ['Patient ID', 'Name', 'Gender', 'Age', 'Blood Group', 'Phone', 'Email', 'Assigned Doctor', 'Allergies', 'Status'],
      filtered.map((p) => [
        p.patientCode,
        p.name,
        p.gender,
        p.age || '',
        p.bloodGroup || '',
        p.phone,
        p.email || '',
        p.assignedDoctorName || '',
        p.allergies || '',
        p.status,
      ])
    );
  };

  // Viewing single patient profile (Printable)
  if (viewing) {
    const pAppts = appointments.filter((a) => a.patientId === viewing.id);
    const pRx = prescriptions.filter((r) => r.patientId === viewing.id);
    const pLabs = labOrders.filter((l) => l.patientId === viewing.id);
    const pInvs = invoices.filter((i) => i.patientId === viewing.id);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            ← Back to Patient Registry
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={() => requestDelete(viewing)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Patient
              </button>
            )}
            <button
              type="button"
              onClick={() => openEdit(viewing)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF Profile
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 print-sheet space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{org.name} · Patient Clinical Record</p>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{viewing.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                {viewing.patientCode} · {viewing.gender} · Age {viewing.age || 'N/A'} · Blood {viewing.bloodGroup || 'N/A'}
              </p>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 sm:text-right space-y-0.5">
              <p className="font-mono">{viewing.phone}</p>
              {viewing.email && <p>{viewing.email}</p>}
              {viewing.address && <p>{viewing.address}</p>}
            </div>
          </div>

          {/* Clinical Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Personal & Guardian</h3>
              <p className="text-slate-700 dark:text-slate-300">DOB: <span className="font-mono">{viewing.dob || '—'}</span></p>
              <p className="text-slate-700 dark:text-slate-300">Guardian: {viewing.guardianName || '—'}</p>
              <p className="text-slate-700 dark:text-slate-300">Emergency: {viewing.emergencyContact || '—'}</p>
              <p className="text-slate-700 dark:text-slate-300">Assigned Doctor: {viewing.assignedDoctorName || '—'}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Allergies & Existing Conditions</h3>
              <p className="text-red-700 dark:text-red-400 font-medium">Allergies: {viewing.allergies || 'None recorded'}</p>
              <p className="text-slate-700 dark:text-slate-300">Conditions: {viewing.existingDiseases || 'None recorded'}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Medical History & Notes</h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{viewing.medicalHistory || '—'}</p>
              {viewing.notes && <p className="text-xs text-slate-500 dark:text-slate-400">{viewing.notes}</p>}
            </div>
          </div>

          {/* Linked Records */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2.5">
                Appointment & Follow-up History ({pAppts.length})
              </h3>
              {pAppts.length === 0 ? (
                <p className="text-xs text-slate-500">No appointments recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {pAppts.map((a) => (
                    <div key={a.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{a.doctorName} · {a.type.replace('_', ' ')}</p>
                        <p className="text-slate-500 font-mono">{a.date} {a.timeSlot} · Token #{a.queueToken}</p>
                      </div>
                      <span className="capitalize text-slate-700 dark:text-slate-300">{a.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2.5">
                Previous Prescriptions ({pRx.length})
              </h3>
              {pRx.length === 0 ? (
                <p className="text-xs text-slate-500">No prescriptions recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {pRx.map((r) => (
                    <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{r.diagnosis || 'General Consultation'}</p>
                        <p className="text-slate-500 font-mono">{r.rxNumber} · {r.doctorName} · {r.medicines.length} med(s)</p>
                      </div>
                      <span className="capitalize text-teal-700 dark:text-teal-400">{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2.5">
                Laboratory Reports ({pLabs.length})
              </h3>
              {pLabs.length === 0 ? (
                <p className="text-xs text-slate-500">No lab orders recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {pLabs.map((l) => (
                    <div key={l.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{l.tests.map((t) => t.name).join(', ')}</p>
                        <p className="text-slate-500 font-mono">{l.orderNumber}</p>
                      </div>
                      <span className="capitalize text-emerald-700 dark:text-emerald-400">{l.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2.5">
                Billing & Payment History ({pInvs.length})
              </h3>
              {pInvs.length === 0 ? (
                <p className="text-xs text-slate-500">No invoices recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {pInvs.map((inv) => (
                    <div key={inv.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium font-mono text-slate-900 dark:text-white">{inv.invoiceNumber}</p>
                        <p className="text-slate-500 tabular-nums">
                          Total {formatMoney(inv.totalAmount, org.currency)} · Paid {formatMoney(inv.paidAmount, org.currency)}
                        </p>
                      </div>
                      <span className="capitalize font-medium text-slate-700 dark:text-slate-300">{inv.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {deleteConfirmModal}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Patient ID, phone, or name..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'all' | 'male' | 'female' | 'other')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'completed' | 'archived' | 'all')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
          >
            <option value="active">Active Patients</option>
            <option value="completed">Completed Visits ({completedPatientIds.size})</option>
            <option value="archived">Archived</option>
            <option value="all">All Status</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" /> Register Patient
          </button>
        </div>
      </div>

      {/* Patient Data Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">No patients match your current filters.</p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg"
            >
              Register First Patient
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Patient ID</th>
                  <th className="py-3 px-4 font-medium">Patient Name</th>
                  <th className="py-3 px-4 font-medium">Demographics</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Assigned Doctor</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {p.patientCode}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setViewing(p)}
                        className="font-medium text-slate-900 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 text-left"
                      >
                        {p.name}
                      </button>
                      {p.allergies && p.allergies.toLowerCase() !== 'none' && p.allergies.toLowerCase() !== 'none known' && (
                        <p className="text-xs text-red-600 dark:text-red-400">Allergy: {p.allergies}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 capitalize whitespace-nowrap">
                      {p.gender} · {p.age ? `${p.age}y` : '—'} · {p.bloodGroup || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {p.phone}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {p.assignedDoctorName || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 text-xs capitalize">
                      <span className={p.status === 'active' ? 'text-teal-700 dark:text-teal-400 font-medium' : 'text-slate-500'}>
                        {p.status}
                      </span>
                      {completedPatientIds.has(p.id) && (
                        <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          Visit Completed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => setViewing(p)} title="View Profile" className="p-1.5 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => openEdit(p)} title="Edit" className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleArchiveToggle(p)} title="Archive / Restore" className="p-1.5 text-slate-500 hover:text-amber-600">
                          <Archive className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button type="button" onClick={() => requestDelete(p)} title="Delete Patient" className="p-1.5 text-slate-500 hover:text-red-600">
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

      {/* Registration / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90dvh] flex flex-col my-auto overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editing ? `Edit Patient (${editing.patientCode})` : 'Register New Patient'}
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto px-4 sm:px-6 py-4 space-y-4 flex-1">
                {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg">{error}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Patient full name"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Gender *</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Age (Years)</label>
                    <input type="number" min={0} max={130} value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                    <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>{bg || 'Select'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                    <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 010-2000" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Doctor</label>
                    <select value={assignedDoctorId} onChange={(e) => setAssignedDoctorId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                      <option value="">None</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Branch</label>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                      <option value="">Main</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Guardian Name</label>
                    <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Emergency Contact</label>
                    <input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient Portal Auth UID (Optional)</label>
                    <input value={patientAuthUid} onChange={(e) => setPatientAuthUid(e.target.value)} placeholder="Firebase UID for portal login" className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Allergies</label>
                    <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Penicillin, dust..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Existing Diseases</label>
                    <input value={existingDiseases} onChange={(e) => setExistingDiseases(e.target.value)} placeholder="Hypertension, Diabetes..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Medical History & Clinical Notes</label>
                    <textarea rows={2} value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium text-white bg-[#047857] hover:bg-[#065f46] rounded-lg disabled:opacity-60">
                  {saving ? 'Saving...' : editing ? 'Update Patient' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteConfirmModal}
    </div>
  );
}
