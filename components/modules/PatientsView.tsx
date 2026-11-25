'use client';

import React, { useState } from 'react';
import {
  FileText,
  FlaskConical,
  Plus,
  Receipt,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type {
  Appointment,
  CurrencyCode,
  Doctor,
  Invoice,
  LabOrder,
  Patient,
  Prescription,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface PatientsViewProps {
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  invoices: Invoice[];
  currency: CurrencyCode;
  hideFinancials: boolean;
  onSavePatient: (patient: Omit<Patient, 'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'>, existingId?: string) => void;
  onDeletePatient: (id: string) => void;
}

export function PatientsView({
  patients,
  doctors,
  appointments,
  prescriptions,
  labOrders,
  invoices,
  currency,
  hideFinancials,
  onSavePatient,
  onDeletePatient,
}: PatientsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed_visits'>('all');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const [form, setForm] = useState({
    patientCode: '',
    name: '',
    gender: 'male' as 'male' | 'female' | 'other',
    age: 30,
    bloodGroup: 'O+',
    phone: '',
    email: '',
    address: '',
    emergencyContact: '',
    allergies: '',
    existingDiseases: '',
    medicalHistory: '',
    assignedDoctorId: doctors[0]?.id || '',
    status: 'active' as 'active' | 'archived',
  });

  const completedPatientIds = new Set(
    appointments.filter((a) => a.status === 'completed').map((a) => a.patientId)
  );

  const filtered = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.patientCode.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (statusFilter === 'active') return p.status === 'active';
    if (statusFilter === 'completed_visits') return completedPatientIds.has(p.id);
    return true;
  });

  const openNewModal = () => {
    setEditingId(undefined);
    setForm({
      patientCode: `PAT-${1001 + patients.length}`,
      name: '',
      gender: 'male',
      age: 30,
      bloodGroup: 'O+',
      phone: '',
      email: '',
      address: '',
      emergencyContact: '',
      allergies: '',
      existingDiseases: '',
      medicalHistory: '',
      assignedDoctorId: doctors[0]?.id || '',
      status: 'active',
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Patient) => {
    setEditingId(p.id);
    setForm({
      patientCode: p.patientCode,
      name: p.name,
      gender: p.gender,
      age: p.age ?? 30,
      bloodGroup: p.bloodGroup ?? '',
      phone: p.phone,
      email: p.email ?? '',
      address: p.address ?? '',
      emergencyContact: p.emergencyContact ?? '',
      allergies: p.allergies ?? '',
      existingDiseases: p.existingDiseases ?? '',
      medicalHistory: p.medicalHistory ?? '',
      assignedDoctorId: p.assignedDoctorId ?? '',
      status: p.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const docObj = doctors.find((d) => d.id === form.assignedDoctorId);
    onSavePatient(
      {
        patientCode: form.patientCode.trim(),
        name: form.name.trim(),
        gender: form.gender,
        age: Number(form.age) || undefined,
        bloodGroup: form.bloodGroup.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        allergies: form.allergies.trim() || undefined,
        existingDiseases: form.existingDiseases.trim() || undefined,
        medicalHistory: form.medicalHistory.trim() || undefined,
        assignedDoctorId: docObj?.id,
        assignedDoctorName: docObj?.name,
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
            Patient Registry &amp; EMR
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Demographics, allergies, assigned clinicians, and longitudinal clinical timeline.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register Patient</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name, code, or phone..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg self-start">
          {[
            { id: 'all', label: 'All Patients' },
            { id: 'active', label: 'Active' },
            { id: 'completed_visits', label: 'Completed Visits' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Patient</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Blood &amp; Allergies</th>
              <th className="py-3 px-4">Assigned Doctor</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  No patients match the current search filter.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(p)}
                      className="text-left group cursor-pointer"
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {p.patientCode} · {p.gender} · {p.age ?? '—'} yrs
                      </p>
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-slate-800 dark:text-slate-200 font-mono text-xs tabular-nums">
                      {p.phone}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{p.email || '—'}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      Blood: {p.bloodGroup || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                      Allergies: {p.allergies || 'None reported'}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                    {p.assignedDoctorName || 'Unassigned'}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(p)}
                      className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      EMR Timeline
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePatient(p.id)}
                      aria-label={`Remove ${p.name}`}
                      className="inline-flex text-slate-400 hover:text-rose-600 transition-colors cursor-pointer align-middle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Longitudinal EMR Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto p-6 space-y-6 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedPatient.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {selectedPatient.patientCode} · {selectedPatient.gender} · {selectedPatient.age}y ·{' '}
                    {selectedPatient.bloodGroup || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-500">Allergies</p>
                <p className="font-medium text-rose-600 dark:text-rose-400 mt-0.5">
                  {selectedPatient.allergies || 'None documented'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Existing Conditions</p>
                <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedPatient.existingDiseases || 'None documented'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">Medical History</p>
                <p className="text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
                  {selectedPatient.medicalHistory || 'No historical notes recorded.'}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Prescriptions ({prescriptions.filter((r) => r.patientId === selectedPatient.id).length})</span>
              </h3>
              {prescriptions
                .filter((r) => r.patientId === selectedPatient.id)
                .map((rx) => (
                  <div
                    key={rx.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {rx.rxNumber} · {rx.doctorName} · {rx.status}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">{rx.diagnosis}</p>
                    <p className="text-slate-500">
                      {rx.medicines.map((m) => m.name).join(', ')}
                    </p>
                  </div>
                ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <FlaskConical className="w-4 h-4 text-teal-600" />
                <span>Lab Orders ({labOrders.filter((l) => l.patientId === selectedPatient.id).length})</span>
              </h3>
              {labOrders
                .filter((l) => l.patientId === selectedPatient.id)
                .map((lo) => (
                  <div
                    key={lo.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {lo.orderNumber} · {lo.status}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      {lo.tests.map((t) => `${t.code}: ${t.resultValue || 'Pending'}`).join(' · ')}
                    </p>
                  </div>
                ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Billing Ledger ({invoices.filter((i) => i.patientId === selectedPatient.id).length})</span>
              </h3>
              {invoices
                .filter((i) => i.patientId === selectedPatient.id)
                .map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                  >
                    <span className="font-mono font-medium">
                      {inv.invoiceNumber} · {inv.status}
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatCurrency(inv.totalAmount, currency, hideFinancials)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Register / Edit Patient Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit Patient Profile' : 'Register New Patient'}
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
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Patient Code</span>
                <input
                  required
                  value={form.patientCode}
                  onChange={(e) => setForm({ ...form, patientCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Full Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Gender</span>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Age</span>
                <input
                  type="number"
                  min={0}
                  max={130}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Phone</span>
                <input
                  required
                  minLength={4}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Blood Group</span>
                <input
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  placeholder="O+, B+, A-"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1 col-span-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Assigned Doctor</span>
                <select
                  value={form.assignedDoctorId}
                  onChange={(e) => setForm({ ...form, assignedDoctorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                >
                  <option value="">Unassigned</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialization})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 col-span-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Known Allergies</span>
                <input
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  placeholder="Penicillin, Latex, etc."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="space-y-1 col-span-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Medical History</span>
                <textarea
                  rows={2}
                  value={form.medicalHistory}
                  onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Save Patient
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
