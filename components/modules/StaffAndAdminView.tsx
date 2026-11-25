'use client';

import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  FileText,
  FlaskConical,
  MailPlus,
  Shield,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  Appointment,
  AuditLog,
  Branch,
  CurrencyCode,
  Invoice,
  LabOrder,
  Organization,
  OrganizationMember,
  Patient,
  Prescription,
  StaffInvite,
  StaffRole,
  SubscriptionPlan,
} from '@/lib/types';
import { formatCurrency, getTodayIsoDate } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Staff HR, RBAC & Verified Invites                                          */
/* -------------------------------------------------------------------------- */

interface StaffViewProps {
  members: OrganizationMember[];
  invites: StaffInvite[];
  branches: Branch[];
  onCreateInvite: (invite: {
    invitedEmail: string;
    invitedName: string;
    role: Exclude<StaffRole, 'clinic_owner'>;
    department?: string;
    designation?: string;
    branchId?: string;
  }) => void;
  onRevokeInvite: (inviteId: string) => void;
  onToggleMemberStatus: (memberId: string) => void;
}

export function StaffView({
  members,
  invites,
  branches,
  onCreateInvite,
  onRevokeInvite,
  onToggleMemberStatus,
}: StaffViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    invitedName: '',
    invitedEmail: '',
    role: 'doctor' as Exclude<StaffRole, 'clinic_owner'>,
    department: '',
    designation: '',
    branchId: branches[0]?.id || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateInvite({
      invitedName: form.invitedName.trim(),
      invitedEmail: form.invitedEmail.trim().toLowerCase(),
      role: form.role,
      department: form.department.trim() || undefined,
      designation: form.designation.trim() || undefined,
      branchId: form.branchId || undefined,
    });
    setModalOpen(false);
    setForm({
      invitedName: '',
      invitedEmail: '',
      role: 'doctor',
      department: '',
      designation: '',
      branchId: branches[0]?.id || '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Staff HR, RBAC &amp; Verified Invites
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Zero-trust email-verified staff onboarding, role access control, and instant revocation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer self-start"
        >
          <MailPlus className="w-4 h-4" />
          <span>Invite Staff Member</span>
        </button>
      </div>

      {/* Team Directory */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">RBAC Role</th>
              <th className="py-3 px-4">Department &amp; Shift</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Access Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{m.name}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    {m.staffCode || 'STF'} · {m.email || '—'}
                  </p>
                </td>
                <td className="py-3 px-4 text-xs capitalize font-medium text-emerald-700 dark:text-emerald-400">
                  {m.role.replace('_', ' ')}
                </td>
                <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                  {m.department || 'General'} · {m.shift || 'Standard'}
                </td>
                <td className="py-3 px-4 text-xs capitalize">{m.status}</td>
                <td className="py-3 px-4 text-right text-xs">
                  {m.role === 'clinic_owner' ? (
                    <span className="text-slate-400">Protected Owner</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleMemberStatus(m.id)}
                      className="font-medium text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                    >
                      {m.status === 'active' ? 'Suspend Access' : 'Restore Access'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Verified Email Invitations ({invites.length})
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {invites.length === 0 ? (
            <p className="text-slate-500 py-3">No staff invitations created yet.</p>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {inv.invitedName} · <span className="font-mono font-normal">{inv.invitedEmail}</span>
                  </p>
                  <p className="text-slate-500 capitalize">
                    Role: {inv.role.replace('_', ' ')} · Code:{' '}
                    <span className="font-mono">{inv.inviteCode}</span> · Expires {inv.expiresAt}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                    {inv.status}
                  </span>
                  {inv.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => onRevokeInvite(inv.id)}
                      className="text-rose-600 hover:underline font-medium cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Create Verified Staff Invitation</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <input
                required
                placeholder="Staff Full Name"
                value={form.invitedName}
                onChange={(e) => setForm({ ...form, invitedName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="email"
                required
                placeholder="Verified Google / Work Email"
                value={form.invitedEmail}
                onChange={(e) => setForm({ ...form, invitedEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as Exclude<StaffRole, 'clinic_owner'> })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="clinic_admin">Clinic Admin</option>
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
                <option value="nurse">Nurse</option>
                <option value="lab_technician">Lab Technician</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="accountant">Accountant</option>
                <option value="hr_manager">HR Manager</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <input
                  placeholder="Designation"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
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
                Generate Invite
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Clinic Settings, Branches, Audit Trail & JSON Backup                       */
/* -------------------------------------------------------------------------- */

interface SettingsViewProps {
  organization: Organization;
  branches: Branch[];
  auditLogs: AuditLog[];
  onUpdateOrganization: (patch: Partial<Organization>) => void;
  onAddBranch: (branch: { name: string; code: string; address?: string; phone?: string; managerName?: string }) => void;
  onExportBackup: () => void;
}

export function SettingsView({
  organization,
  branches,
  auditLogs,
  onUpdateOrganization,
  onAddBranch,
  onExportBackup,
}: SettingsViewProps) {
  const [orgForm, setOrgForm] = useState({
    name: organization.name,
    address: organization.address || '',
    phone: organization.phone || '',
    email: organization.email || '',
    currency: organization.currency,
    prescriptionHeader: organization.prescriptionHeader || '',
    prescriptionFooter: organization.prescriptionFooter || '',
    invoiceFooter: organization.invoiceFooter || '',
    enablePharmacy: organization.enablePharmacy ?? true,
    enableInpatient: organization.enableInpatient ?? true,
  });
  const [savedNotice, setSavedNotice] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', code: '', address: '', managerName: '' });

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateOrganization(orgForm);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.code.trim()) return;
    onAddBranch({
      name: branchForm.name.trim(),
      code: branchForm.code.trim().toUpperCase(),
      address: branchForm.address.trim() || undefined,
      managerName: branchForm.managerName.trim() || undefined,
    });
    setBranchForm({ name: '', code: '', address: '', managerName: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Clinic Settings, Branches &amp; Audit Trail
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure print headers, currency, multi-branch locations, JSON backup, and immutable audit logs.
          </p>
        </div>
        <button
          type="button"
          onClick={onExportBackup}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer self-start"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Export Full Clinic JSON Backup</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Org Config */}
        <form
          onSubmit={handleSaveOrg}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Organization Profile &amp; Modules
          </h2>
          <div className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-xs text-slate-500">Clinic Name</span>
              <input
                required
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-slate-500">Currency</span>
                <select
                  value={orgForm.currency}
                  onChange={(e) =>
                    setOrgForm({ ...orgForm, currency: e.target.value as CurrencyCode })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="BDT">BDT (৳)</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-500">Phone</span>
                <input
                  value={orgForm.phone}
                  onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-slate-500">Prescription Header</span>
              <input
                value={orgForm.prescriptionHeader}
                onChange={(e) => setOrgForm({ ...orgForm, prescriptionHeader: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-500">Prescription Footer</span>
              <input
                value={orgForm.prescriptionFooter}
                onChange={(e) => setOrgForm({ ...orgForm, prescriptionFooter: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </label>
            <div className="flex items-center gap-6 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={orgForm.enablePharmacy}
                  onChange={(e) => setOrgForm({ ...orgForm, enablePharmacy: e.target.checked })}
                />
                <span>Enable Pharmacy &amp; POS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={orgForm.enableInpatient}
                  onChange={(e) => setOrgForm({ ...orgForm, enableInpatient: e.target.checked })}
                />
                <span>Enable Inpatient Beds</span>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            {savedNotice ? (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Settings saved
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </form>

        {/* Multi-Branch Management */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Clinic Branches ({branches.length})</span>
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {branches.map((b) => (
              <div key={b.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {b.name} · <span className="font-mono text-emerald-700 dark:text-emerald-400">{b.code}</span>
                  </p>
                  <p className="text-slate-500">
                    {b.address || 'Main Facility'} · Mgr: {b.managerName || '—'}
                  </p>
                </div>
                <span className="capitalize text-slate-500">{b.isMain ? 'Main' : b.status}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleCreateBranch} className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <input
              required
              placeholder="Branch Name"
              value={branchForm.name}
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <input
              required
              placeholder="Code (BR-03)"
              value={branchForm.code}
              onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
            <input
              placeholder="Address"
              value={branchForm.address}
              onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              className="col-span-2 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <button
              type="submit"
              className="col-span-2 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium cursor-pointer"
            >
              Add Clinic Branch
            </button>
          </form>
        </div>
      </div>

      {/* Immutable Audit Trail */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Append-Only Security &amp; Clinical Audit Trail</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">{auditLogs.length} events</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {auditLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 mr-2">
                  {log.action}
                </span>
                <span className="text-slate-800 dark:text-slate-200">{log.summary}</span>
              </div>
              <span className="text-slate-500 font-mono whitespace-nowrap">
                {log.actorName} ({log.actorRole}) · {log.createdAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Patient Self-Service Portal                                                */
/* -------------------------------------------------------------------------- */

interface PatientPortalViewProps {
  patients: Patient[];
  appointments: Appointment[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  invoices: Invoice[];
  currency: CurrencyCode;
}

export function PatientPortalView({
  patients,
  appointments,
  prescriptions,
  labOrders,
  invoices,
  currency,
}: PatientPortalViewProps) {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const patient = patients.find((p) => p.id === selectedPatientId) ?? patients[0];

  if (!patient) {
    return <p className="text-sm text-slate-500">No patient records available.</p>;
  }

  const myApts = appointments.filter((a) => a.patientId === patient.id);
  const myRx = prescriptions.filter((r) => r.patientId === patient.id);
  const myLabs = labOrders.filter((l) => l.patientId === patient.id);
  const myInvoices = invoices.filter((i) => i.patientId === patient.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Patient Self-Service Portal
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Read-only personal health record view for appointments, digital prescriptions, verified lab results, and receipts.
          </p>
        </div>
        <select
          value={patient.id}
          onChange={(e) => setSelectedPatientId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 self-start"
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              Preview as: {p.name} ({p.patientCode})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Upcoming &amp; Past Visits ({myApts.length})</span>
          </h2>
          {myApts.map((a) => (
            <div key={a.id} className="text-xs py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <span>
                {a.date} {a.timeSlot} · {a.doctorName}
              </span>
              <span className="capitalize font-medium">{a.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Digital Prescriptions ({myRx.length})</span>
          </h2>
          {myRx.length === 0 ? (
            <p className="text-xs text-slate-500">No prescriptions issued yet.</p>
          ) : (
            myRx.map((r) => (
              <div key={r.id} className="text-xs py-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <p className="font-semibold">
                  {r.rxNumber} · {r.doctorName}
                </p>
                <p className="text-slate-500">{r.diagnosis}</p>
              </div>
            ))
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-teal-600" />
            <span>Verified Lab Reports ({myLabs.length})</span>
          </h2>
          {myLabs.length === 0 ? (
            <p className="text-xs text-slate-500">No diagnostic orders on file.</p>
          ) : (
            myLabs.map((l) => (
              <div key={l.id} className="text-xs py-2 border-t border-slate-100 dark:border-slate-800">
                <p className="font-semibold">
                  {l.orderNumber} · <span className="capitalize">{l.status}</span>
                </p>
                <p className="text-slate-500">
                  {l.tests.map((t) => `${t.code}: ${t.resultValue || 'Pending'}`).join(' · ')}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">Billing Receipts ({myInvoices.length})</h2>
          {myInvoices.map((inv) => (
            <div key={inv.id} className="text-xs py-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-mono">
              <span>
                {inv.invoiceNumber} · {inv.status}
              </span>
              <span>{formatCurrency(inv.totalAmount, currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SaaS Super Admin Governance Console                                        */
/* -------------------------------------------------------------------------- */

interface SuperAdminViewProps {
  organization: Organization;
  plans: SubscriptionPlan[];
  onSwitchPlan: (planId: string) => void;
}

export function SuperAdminView({ organization, plans, onSwitchPlan }: SuperAdminViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-600" />
          <span>SaaS Super Admin Console</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tenant subscription governance &amp; quota plans. Clinical subcollections remain isolated from platform admins.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2 text-sm">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Active Tenant Workspace</p>
        <p className="text-xs text-slate-500 font-mono">
          {organization.name} · slug: {organization.slug} · status: {organization.status} · plan:{' '}
          {organization.planId} · date: {getTodayIsoDate()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isActive = organization.planId === plan.code;
          return (
            <div
              key={plan.id}
              className={`bg-white dark:bg-slate-900 rounded-xl p-5 flex flex-col justify-between space-y-4 border ${
                isActive
                  ? 'border-emerald-600 dark:border-emerald-500'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-2">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {plan.audience}
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{plan.name}</h3>
                <p className="text-2xl font-bold font-mono tabular-nums">
                  ${plan.monthlyPrice}
                  <span className="text-xs font-sans font-normal text-slate-500"> /month</span>
                </p>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <li>Up to {plan.doctorLimit} doctors</li>
                  <li>Up to {plan.patientLimit.toLocaleString()} patients</li>
                  <li>Up to {plan.branchLimit ?? 1} branches</li>
                  <li>Modules: {(plan.modules || []).join(', ')}</li>
                </ul>
              </div>
              <button
                type="button"
                disabled={isActive}
                onClick={() => onSwitchPlan(plan.code)}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isActive ? 'Current Active Plan' : 'Assign Plan to Tenant'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
