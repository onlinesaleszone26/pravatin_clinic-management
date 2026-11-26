'use client';

import React, { useState } from 'react';
import {
  Plus,
  BedDouble,
  Users,
  Shield,
  Building2,
  Bell,
  X,
  Send,
  Check,
  Mail,
  RefreshCw,
  UserMinus,
  Copy,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import {
  saveBed,
  saveStaffMember,
  saveCustomRole,
  saveBranch,
  queueNotification,
  createStaffInvite,
  revokeStaffInvite,
  syncClinicTeamAccess,
  revokeStaffAccess,
  TenantActor,
} from '@/lib/firestore-service';
import { formatMoney, todayISO } from '@/lib/clinic-utils';
import { NOTIFICATION_TEMPLATES } from '@/lib/i18n';
import {
  ROLE_LABELS,
  type Organization,
  type Bed,
  type OrganizationMember,
  type CustomRole,
  type Branch,
  type NotificationRecord,
  type Patient,
  type Doctor,
  type StaffRole,
  type StaffInvite,
  type RolePermissionMap,
} from '@/lib/types';

const PERM_MODULES = ['patients', 'doctors', 'appointments', 'prescriptions', 'laboratory', 'billing', 'pharmacy', 'beds', 'staff', 'reports', 'settings'];

function makeDefaultPerms(): RolePermissionMap {
  const map: RolePermissionMap = {};
  PERM_MODULES.forEach((m) => {
    map[m] = { view: true, create: false, edit: false, delete: false };
  });
  return map;
}

// ============================================================================
// INPATIENT BEDS & CABINS MODULE
// ============================================================================
export function BedsModule({
  org,
  actor,
  beds,
  patients,
  doctors,
}: {
  org: Organization;
  actor: TenantActor;
  beds: Bed[];
  patients: Patient[];
  doctors: Doctor[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [admitBed, setAdmitBed] = useState<Bed | null>(null);
  const [wardName, setWardName] = useState('General Ward');
  const [roomNumber, setRoomNumber] = useState('101');
  const [bedNumber, setBedNumber] = useState('');
  const [type, setType] = useState<Bed['type']>('general_ward');
  const [dailyRate, setDailyRate] = useState('1500');
  const [admitPatientId, setAdmitPatientId] = useState('');
  const [admitDoctorName, setAdmitDoctorName] = useState('');
  const [nursingNotes, setNursingNotes] = useState('');

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveBed(org, actor, {
      wardName,
      roomNumber,
      bedNumber,
      type,
      dailyRate: Number(dailyRate || 0),
      status: 'available',
    });
    setBedNumber('');
    setShowAdd(false);
  };

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitBed) return;
    const pat = patients.find((p) => p.id === admitPatientId);
    if (!pat) return;
    await saveBed(org, actor, {
      ...admitBed,
      status: 'occupied',
      currentPatientId: pat.id,
      currentPatientName: pat.name,
      admittedAt: todayISO(),
      attendingDoctorName: admitDoctorName,
      nursingNotes,
    });
    setAdmitBed(null);
  };

  const handleDischarge = async (bed: Bed) => {
    await saveBed(org, actor, {
      ...bed,
      status: 'available',
      currentPatientId: '',
      currentPatientName: '',
      admittedAt: '',
      attendingDoctorName: '',
      nursingNotes: '',
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Inpatient Wards, Cabins & Beds</h2>
          <p className="text-xs text-slate-500">
            {beds.filter((b) => b.status === 'available').length} available · {beds.filter((b) => b.status === 'occupied').length} occupied · {beds.length} total
          </p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Bed / Cabin
        </button>
      </div>

      {beds.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-2">
          <BedDouble className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-500">No inpatient beds or cabins configured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {beds.map((bed) => (
            <div key={bed.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{bed.bedNumber} · Room {bed.roomNumber || '—'}</p>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{bed.wardName}</h3>
                  <p className="text-xs text-slate-500 capitalize">{bed.type.replace('_', ' ')} · {formatMoney(bed.dailyRate, org.currency)}/day</p>
                </div>
                <span className={`text-xs font-medium capitalize ${bed.status === 'available' ? 'text-teal-700 dark:text-teal-400' : bed.status === 'occupied' ? 'text-amber-600' : 'text-slate-500'}`}>
                  {bed.status}
                </span>
              </div>

              {bed.status === 'occupied' ? (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
                  <p className="font-medium text-slate-900 dark:text-white">Patient: {bed.currentPatientName}</p>
                  <p className="text-slate-500">Admitted: <span className="font-mono">{bed.admittedAt}</span> · {bed.attendingDoctorName || '—'}</p>
                  {bed.nursingNotes && <p className="text-slate-600 dark:text-slate-400">{bed.nursingNotes}</p>}
                  <div className="pt-2">
                    <button type="button" onClick={() => handleDischarge(bed)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-teal-600">
                      Discharge Patient
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAdmitBed(bed);
                      setAdmitPatientId(patients[0]?.id || '');
                      setAdmitDoctorName(doctors[0]?.name || '');
                      setNursingNotes('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
                  >
                    Admit Patient
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex justify-between mb-4"><h2 className="text-base font-bold">Add Ward Bed / Cabin</h2><button type="button" onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
            <form onSubmit={handleAddBed} className="space-y-3">
              <div><label className="block text-xs mb-1">Ward / Wing Name *</label><input required value={wardName} onChange={(e) => setWardName(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs mb-1">Room #</label><input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                <div><label className="block text-xs mb-1">Bed / Cabin Code *</label><input required value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} placeholder="VIP-03" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                <div><label className="block text-xs mb-1">Category</label><select value={type} onChange={(e) => setType(e.target.value as Bed['type'])} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"><option value="general_ward">General Ward</option><option value="semi_cabin">Semi Cabin</option><option value="vip_cabin">VIP Cabin</option><option value="icu">ICU</option></select></div>
                <div><label className="block text-xs mb-1">Daily Charge ({org.currency})</label><input type="number" min={0} value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">Save Bed</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {admitBed && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex justify-between mb-4"><h2 className="text-base font-bold">Admit Patient — {admitBed.bedNumber}</h2><button type="button" onClick={() => setAdmitBed(null)}><X className="w-5 h-5 text-slate-400" /></button></div>
            <form onSubmit={handleAdmit} className="space-y-3">
              <div><label className="block text-xs mb-1">Patient *</label><select required value={admitPatientId} onChange={(e) => setAdmitPatientId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">{patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.patientCode})</option>)}</select></div>
              <div><label className="block text-xs mb-1">Attending Doctor</label><select value={admitDoctorName} onChange={(e) => setAdmitDoctorName(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">{doctors.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
              <div><label className="block text-xs mb-1">Nursing Notes</label><textarea rows={3} value={nursingNotes} onChange={(e) => setNursingNotes(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAdmitBed(null)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">Confirm Admission</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STAFF, HR & RBAC ROLES MODULE
// ============================================================================
export function StaffAndRbacModule({
  org,
  actor,
  members,
  customRoles,
  branches,
  invites = [],
}: {
  org: Organization;
  actor: TenantActor;
  members: OrganizationMember[];
  customRoles: CustomRole[];
  branches: Branch[];
  invites?: StaffInvite[];
}) {
  const [tab, setTab] = useState<'staff' | 'invites' | 'roles'>('staff');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmRevokeUid, setConfirmRevokeUid] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const canManageAccess = actor.role === 'clinic_owner' || actor.role === 'clinic_admin';
  const assignableRoles = (Object.entries(ROLE_LABELS) as Array<[StaffRole, { en: string }]>).filter(
    ([k]) => k !== 'clinic_owner'
  );

  // Staff form
  const [sName, setSName] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sUid, setSUid] = useState('');
  const [sRole, setSRole] = useState<StaffRole>('receptionist');
  const [sDept, setSDept] = useState('Front Desk');
  const [sDesig, setSDesig] = useState('Executive');
  const [sSalary, setSSalary] = useState('20000');
  const [sShift, setSShift] = useState('Morning (09:00-17:00)');
  const [sBranch, setSBranch] = useState('');

  // Verified Invite form
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<Exclude<StaffRole, 'clinic_owner'>>('doctor');
  const [invDept, setInvDept] = useState('Clinical');
  const [invDesig, setInvDesig] = useState('');
  const [invBranch, setInvBranch] = useState('');
  const [invSaving, setInvSaving] = useState(false);

  // Custom Role form
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<RolePermissionMap>(makeDefaultPerms());

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    await saveStaffMember(
      org,
      actor,
      {
        uid: sUid.trim() || undefined,
        name: sName.trim(),
        email: sEmail.trim(),
        phone: sPhone.trim(),
        role: sRole,
        department: sDept,
        designation: sDesig,
        branchId: sBranch,
        salary: Number(sSalary || 0),
        shift: sShift,
        attendanceStatus: 'present',
        status: 'active',
      },
      members.length + 1
    );
    setSName('');
    setSEmail('');
    setSPhone('');
    setSUid('');
    setShowStaffModal(false);
    setStatusMsg('Staff record saved.');
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setInvSaving(true);
    try {
      const res = await createStaffInvite(org, actor, {
        invitedName: invName.trim(),
        invitedEmail: invEmail.trim(),
        role: invRole,
        department: invDept.trim(),
        designation: invDesig.trim(),
        branchId: invBranch,
      });
      setInvName('');
      setInvEmail('');
      setInvDesig('');
      setShowInviteModal(false);
      setTab('invites');
      setStatusMsg(
        `Verified invite created (Code: ${res?.inviteCode || 'READY'}). Ask the staff member to sign in with Google using that exact email address to join ${org.name}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create invitation.');
    } finally {
      setInvSaving(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setErrorMsg(null);
    await revokeStaffInvite(org, actor, inviteId);
    setStatusMsg('Pending invitation revoked.');
  };

  const handleRevokeStaff = async (member: OrganizationMember) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await revokeStaffAccess(org, actor, member);
      setConfirmRevokeUid(null);
      setStatusMsg(`Access revoked for ${member.name} and removed across clinic records.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to revoke staff access.');
    }
  };

  const handleSyncAccess = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setSyncing(true);
    try {
      const count = await syncClinicTeamAccess(org, actor);
      setStatusMsg(
        count > 0
          ? `Team access synchronized across ${count} clinic record(s) for ${org.authorizedUids.length} active authorized account(s).`
          : `All clinic records are already in sync with ${org.authorizedUids.length} active authorized account(s).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Access sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyInvite = async (inv: StaffInvite) => {
    const text = `You are invited to join ${org.name} on Pravaclin as ${ROLE_LABELS[inv.role]?.en || inv.role}. Sign in with Google using ${inv.invitedEmail} (Invite Code: ${inv.inviteCode}).`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInviteId(inv.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch {
      setStatusMsg(text);
    }
  };

  const toggleAttendance = async (m: OrganizationMember) => {
    const order: Array<'present' | 'absent' | 'on_leave'> = ['present', 'on_leave', 'absent'];
    const next = order[(order.indexOf(m.attendanceStatus || 'present') + 1) % order.length];
    await saveStaffMember(org, actor, { ...m, attendanceStatus: next });
  };

  const togglePerm = (mod: string, key: 'view' | 'create' | 'edit' | 'delete') => {
    setRolePerms((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], [key]: !prev[mod][key] },
    }));
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCustomRole(org, actor, {
      name: roleName.trim(),
      description: roleDesc.trim(),
      permissions: rolePerms,
    });
    setRoleName('');
    setRoleDesc('');
    setRolePerms(makeDefaultPerms());
    setShowRoleModal(false);
  };

  const pendingInvitesCount = invites.filter((i) => i.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('staff')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'staff' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Staff, HR & Payroll ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('invites')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'invites' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Verified Invites ({pendingInvitesCount} pending)
          </button>
          <button
            type="button"
            onClick={() => setTab('roles')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'roles' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Custom RBAC Roles ({customRoles.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManageAccess && (
            <button
              type="button"
              onClick={handleSyncAccess}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:border-[#047857]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing Access...' : 'Sync Team Access'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRoleModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <Shield className="w-3.5 h-3.5" /> Custom Role
          </button>
          <button
            type="button"
            onClick={() => setShowStaffModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <Users className="w-3.5 h-3.5" /> Add HR Record
          </button>
          {canManageAccess && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
            >
              <Mail className="w-3.5 h-3.5" /> Invite Staff (Email)
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {statusMsg}
          </span>
          <button type="button" onClick={() => setStatusMsg(null)} className="text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {tab === 'staff' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Staff & Code</th>
                  <th className="py-3 px-4 font-medium">Role & Dept</th>
                  <th className="py-3 px-4 font-medium">Shift</th>
                  <th className="py-3 px-4 font-medium text-right">Monthly Salary</th>
                  <th className="py-3 px-4 font-medium">Attendance</th>
                  <th className="py-3 px-4 font-medium text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {members.map((m) => {
                  const isOwnerRow = m.role === 'clinic_owner' || m.uid === org.ownerUid;
                  const hasLoginAccess = org.authorizedUids.includes(m.uid);
                  return (
                    <tr key={m.id} className={m.status === 'inactive' ? 'opacity-60' : ''}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">{m.name}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {m.staffCode || m.uid.slice(0, 8)} · {m.email || m.phone || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-medium text-emerald-700 dark:text-emerald-400">{ROLE_LABELS[m.role]?.en || m.role}</p>
                        <p className="text-slate-500">
                          {m.department || '—'} · {m.designation || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{m.shift || 'Full Day'}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-medium text-slate-900 dark:text-white">
                        {formatMoney(m.salary || 0, org.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleAttendance(m)}
                          disabled={m.status === 'inactive'}
                          className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 capitalize hover:border-emerald-500 disabled:opacity-50"
                        >
                          {(m.attendanceStatus || 'present').replace('_', ' ')}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap text-xs">
                        {isOwnerRow ? (
                          <span className="font-medium text-[#047857] dark:text-emerald-400">Owner (Protected)</span>
                        ) : m.status === 'inactive' ? (
                          <span className="text-red-600 dark:text-red-400 font-medium">Revoked</span>
                        ) : canManageAccess ? (
                          confirmRevokeUid === m.uid ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRevokeStaff(m)}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                              >
                                Confirm Revoke
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeUid(null)}
                                className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <span className="text-slate-500">{hasLoginAccess ? 'Verified Login' : 'HR Only'}</span>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeUid(m.uid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <UserMinus className="w-3.5 h-3.5" /> Revoke
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-500">{hasLoginAccess ? 'Verified Login' : 'Active'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'invites' ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
              <p>
                <strong>Verified Email Onboarding:</strong> Staff members sign in with Google using their exact invited email address and click <strong>Accept & Join Clinic</strong>. After a new member joins, click <strong>Sync Team Access</strong> so they can view historical clinic records too.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {invites.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Mail className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-500">No staff invitations created yet.</p>
                {canManageAccess && (
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
                  >
                    <Mail className="w-3.5 h-3.5" /> Send First Staff Invite
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-medium">Invited Staff</th>
                      <th className="py-3 px-4 font-medium">Assigned Role</th>
                      <th className="py-3 px-4 font-medium">Invite Code</th>
                      <th className="py-3 px-4 font-medium">Expires</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {invites.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900 dark:text-white">{inv.invitedName}</p>
                          <p className="text-xs font-mono text-slate-500">{inv.invitedEmail}</p>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="font-medium text-emerald-700 dark:text-emerald-400">{ROLE_LABELS[inv.role]?.en || inv.role}</p>
                          <p className="text-slate-500">{inv.department || '—'} {inv.designation ? `· ${inv.designation}` : ''}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {inv.inviteCode}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{inv.expiresAt}</td>
                        <td className="py-3 px-4 text-xs font-medium capitalize">
                          <span
                            className={
                              inv.status === 'accepted'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : inv.status === 'revoked'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap text-xs">
                          {inv.status === 'pending' && (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyInvite(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded hover:border-[#047857]"
                              >
                                {copiedInviteId === inv.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedInviteId === inv.id ? 'Copied' : 'Copy Info'}
                              </button>
                              {canManageAccess && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeInvite(inv.id)}
                                  className="px-2.5 py-1 text-red-600 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customRoles.length === 0 ? (
            <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
              No custom roles defined yet. Built-in RBAC roles (Clinic Owner, Admin, Doctor, Receptionist, Nurse, Lab Tech, Pharmacist, Accountant, HR Manager, Patient) are active.
            </div>
          ) : (
            customRoles.map((role) => (
              <div key={role.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{role.name}</h3>
                  <p className="text-xs text-slate-500">{role.description || 'Custom module permission profile'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(role.permissions).map(([mod, p]) => (
                    <div key={mod} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="capitalize text-slate-700 dark:text-slate-300">{mod}</span>
                      <span className="font-mono text-xs text-slate-500">
                        {[p.view && 'V', p.create && 'C', p.edit && 'E', p.delete && 'D'].filter(Boolean).join('/') || 'None'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Verified Email Staff Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Invite Staff Member (Verified Email)</h2>
                <p className="text-xs text-slate-500">Server-verified role assignment bound to their Google account email.</p>
              </div>
              <button type="button" onClick={() => setShowInviteModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateInvite} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs mb-1">Full Name *</label>
                  <input
                    required
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    placeholder="Dr. Nusrat Jahan"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs mb-1">Verified Google Account Email *</label>
                  <input
                    type="email"
                    required
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder="doctor@gmail.com"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Assigned RBAC Role *</label>
                  <select
                    value={invRole}
                    onChange={(e) => setInvRole(e.target.value as Exclude<StaffRole, 'clinic_owner'>)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {assignableRoles.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Branch</label>
                  <select
                    value={invBranch}
                    onChange={(e) => setInvBranch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="">Main</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Department</label>
                  <input
                    value={invDept}
                    onChange={(e) => setInvDept(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Designation</label>
                  <input
                    value={invDesig}
                    onChange={(e) => setInvDesig(e.target.value)}
                    placeholder="Consultant / Receptionist"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={invSaving}
                  className="px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
                >
                  {invSaving ? 'Creating Invite...' : 'Generate Verified Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-base font-bold">Add Staff HR Record</h2>
              <button type="button" onClick={() => setShowStaffModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddStaff} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs mb-1">Full Name *</label>
                  <input
                    required
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">RBAC Role *</label>
                  <select
                    value={sRole}
                    onChange={(e) => setSRole(e.target.value as StaffRole)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {(actor.role === 'clinic_owner' ? Object.entries(ROLE_LABELS) : assignableRoles).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Branch</label>
                  <select
                    value={sBranch}
                    onChange={(e) => setSBranch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="">Main</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Email</label>
                  <input
                    type="email"
                    value={sEmail}
                    onChange={(e) => setSEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Phone</label>
                  <input
                    value={sPhone}
                    onChange={(e) => setSPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Department</label>
                  <input
                    value={sDept}
                    onChange={(e) => setSDept(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Designation</label>
                  <input
                    value={sDesig}
                    onChange={(e) => setSDesig(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Monthly Salary ({org.currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={sSalary}
                    onChange={(e) => setSSalary(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Shift</label>
                  <input
                    value={sShift}
                    onChange={(e) => setSShift(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs mb-1">
                    Firebase Auth UID (Optional — prefer &quot;Invite Staff (Email)&quot; for verified onboarding)
                  </label>
                  <input
                    value={sUid}
                    onChange={(e) => setSUid(e.target.value)}
                    placeholder="Leave empty for HR-only staff record"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
                  Save Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex justify-between mb-4">
              <h2 className="text-base font-bold">Configure Custom RBAC Role</h2>
              <button type="button" onClick={() => setShowRoleModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveRole} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Role Name *</label>
                  <input
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Senior Lab Supervisor"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Description</label>
                  <input
                    value={roleDesc}
                    onChange={(e) => setRoleDesc(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Module</th>
                      <th className="py-2 px-3 text-center">View</th>
                      <th className="py-2 px-3 text-center">Create</th>
                      <th className="py-2 px-3 text-center">Edit</th>
                      <th className="py-2 px-3 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {PERM_MODULES.map((mod) => (
                      <tr key={mod}>
                        <td className="py-2 px-3 capitalize font-medium">{mod}</td>
                        {(['view', 'create', 'edit', 'delete'] as const).map((k) => (
                          <td key={k} className="py-2 px-3 text-center">
                            <input type="checkbox" checked={rolePerms[mod][k]} onChange={() => togglePerm(mod, k)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
                  Save Custom Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MULTI-BRANCH MANAGEMENT MODULE
// ============================================================================
export function BranchesModule({
  org,
  actor,
  branches,
}: {
  org: Organization;
  actor: TenantActor;
  branches: Branch[];
}) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [managerName, setManagerName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveBranch(org, actor, {
      name,
      code: code.toUpperCase(),
      address,
      phone,
      managerName,
      isMain: branches.length === 0,
      status: 'active',
    });
    setName('');
    setCode('');
    setAddress('');
    setPhone('');
    setManagerName('');
    setShowModal(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Multi-Branch Clinic Network ({branches.length})</h2>
          <p className="text-xs text-slate-500">Manage independent branches under {org.name} with consolidated reporting.</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">
          <Building2 className="w-3.5 h-3.5" /> Add Branch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b) => (
          <div key={b.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{b.code}</span>
              <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">{b.isMain ? 'Headquarters' : b.status}</span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{b.name}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{b.address || 'No address set'}</p>
            <p className="text-xs font-mono text-slate-500">{b.phone || '—'} · Mgr: {b.managerName || '—'}</p>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex justify-between mb-4"><h2 className="text-base font-bold">Create Clinic Branch</h2><button type="button" onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div><label className="block text-xs mb-1">Branch Name *</label><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Uttara Diagnostic Branch" className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs mb-1">Branch Code *</label><input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="BR-UTT" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
                <div><label className="block text-xs mb-1">Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
              </div>
              <div><label className="block text-xs mb-1">Address</label><input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
              <div><label className="block text-xs mb-1">Branch Manager</label><input value={managerName} onChange={(e) => setManagerName(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">Create Branch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NOTIFICATION CENTER MODULE (EN + BN TEMPLATES, HONEST TEST MODE)
// ============================================================================
export function NotificationsModule({
  org,
  actor,
  notifications,
  patients,
}: {
  org: Organization;
  actor: TenantActor;
  notifications: NotificationRecord[];
  patients: Patient[];
}) {
  const [tplIdx, setTplIdx] = useState(0);
  const [channel, setChannel] = useState<'in_app' | 'email' | 'sms' | 'whatsapp'>('in_app');
  const [recipientName, setRecipientName] = useState(patients[0]?.name || '');
  const [recipientContact, setRecipientContact] = useState(patients[0]?.phone || '');
  const [message, setMessage] = useState(NOTIFICATION_TEMPLATES[0].en);
  const [sending, setSending] = useState(false);

  const applyTemplate = (idx: number) => {
    setTplIdx(idx);
    setMessage(NOTIFICATION_TEMPLATES[idx].en.replace('{name}', recipientName || 'Patient'));
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await queueNotification(org, actor, {
        type: NOTIFICATION_TEMPLATES[tplIdx].type,
        channel,
        recipientName,
        recipientContact,
        language: 'en',
        message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Compose Patient Notification</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            In-App notifications deliver directly. SMS, WhatsApp, and Email operate in transparent Test Mode until external gateway credentials are configured.
          </p>
        </div>

        <form onSubmit={handleDispatch} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs mb-1">Template</label>
              <select value={tplIdx} onChange={(e) => applyTemplate(Number(e.target.value))} className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                {NOTIFICATION_TEMPLATES.map((t, idx) => <option key={t.type} value={idx}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Delivery Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as 'in_app' | 'email' | 'sms' | 'whatsapp')} className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                <option value="in_app">In-App</option>
                <option value="sms">SMS (Test)</option>
                <option value="whatsapp">WhatsApp (Test)</option>
                <option value="email">Email (Test)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div><label className="block text-xs mb-1">Recipient Name *</label><input required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
            <div><label className="block text-xs mb-1">Phone / Email</label><input value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" /></div>
          </div>

          <div>
            <label className="block text-xs mb-1">Message Content *</label>
            <textarea rows={4} required value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
          </div>

          <button type="submit" disabled={sending} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
            <Send className="w-3.5 h-3.5" /> {channel === 'in_app' ? 'Send In-App Notification' : 'Log Test-Mode Dispatch'}
          </button>
        </form>
      </div>

      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notification Dispatch Log ({notifications.length})</h3>
          <Bell className="w-4 h-4 text-slate-400" />
        </div>
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">No notifications dispatched yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="py-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{n.recipientName} <span className="font-mono text-slate-500 font-normal">({n.recipientContact || n.channel})</span></span>
                  <span className={`font-mono ${n.deliveryStatus === 'sent' ? 'text-teal-700 dark:text-teal-400 inline-flex items-center gap-1' : 'text-amber-600'}`}>
                    {n.deliveryStatus === 'sent' && <Check className="w-3 h-3" />}
                    {n.channel.toUpperCase()} · {n.deliveryStatus.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">{n.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
