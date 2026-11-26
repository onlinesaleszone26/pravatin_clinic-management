'use client';

import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  writeBatch,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { clampStr, makeDocId, makeSlug, makeCode, makeInviteCode, sanitizeSafeUrl, todayISO } from './clinic-utils';
import type {
  Organization,
  OrganizationMember,
  StaffInvite,
  StaffRole,
  RolePermissionMap,
  PrescribedMedicine,
  PrescriptionVitals,
  LabOrderTestItem,
  LabOrderAuditEntry,
  LabOrderStatus,
  Invoice,
  InvoiceLineItem,
  InvoicePayment,
  PharmacyItem,
  AppointmentStatus,
  SubscriptionPlan,
} from './types';

export interface TenantActor {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export async function ensureUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}) {
  const path = `users/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(
        ref,
        stripUndefined({
          uid: user.uid,
          email: clampStr(user.email || `${user.uid}@pravaclin.local`, 160),
          displayName: clampStr(user.displayName || user.email?.split('@')[0] || 'Clinic User', 120),
          photoURL: sanitizeSafeUrl(user.photoURL),
          language: 'en',
          theme: 'light',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserPrefs(
  uid: string,
  patch: { activeOrgId?: string; language?: 'en' | 'bn'; theme?: 'light' | 'dark'; displayName?: string; phone?: string }
) {
  const path = `users/${uid}`;
  try {
    await updateDoc(
      doc(db, 'users', uid),
      stripUndefined({
        ...(patch.activeOrgId !== undefined ? { activeOrgId: clampStr(patch.activeOrgId, 128) } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
        ...(patch.displayName !== undefined ? { displayName: clampStr(patch.displayName, 120) } : {}),
        ...(patch.phone !== undefined ? { phone: clampStr(patch.phone, 32) } : {}),
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function logAudit(
  org: Organization,
  actor: TenantActor,
  action: string,
  moduleName: string,
  summary: string,
  entityId?: string
) {
  const logId = makeDocId('aud');
  const path = `organizations/${org.id}/auditLogs/${logId}`;
  try {
    await setDoc(
      doc(db, 'organizations', org.id, 'auditLogs', logId),
      stripUndefined({
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        action: clampStr(action, 80),
        module: clampStr(moduleName, 60),
        entityId: entityId ? clampStr(entityId, 128) : undefined,
        summary: clampStr(summary, 400),
        actorUid: actor.uid,
        actorName: clampStr(actor.name || 'User', 120),
        actorRole: clampStr(actor.role, 40),
        createdAt: serverTimestamp(),
      })
    );
  } catch (error) {
    console.warn('Audit log write warning:', error);
  }
}

// ============================================================================
// ORGANIZATION REGISTRATION & SETTINGS
// ============================================================================
export async function createOrganization(
  actor: TenantActor,
  input: {
    name: string;
    type: 'clinic' | 'diagnostic' | 'hospital' | 'chamber';
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    address: string;
    phone: string;
    email: string;
    currency: 'BDT' | 'USD' | 'EUR';
    language: 'en' | 'bn';
    enablePharmacy: boolean;
    enableInpatient: boolean;
  }
): Promise<string> {
  const orgId = makeDocId('org');
  const orgPath = `organizations/${orgId}`;
  const slug = `${makeSlug(input.name)}-${orgId.slice(-4)}`.slice(0, 78);

  try {
    // 1. Create Organization Document first so Master Gate exists() succeeds
    await setDoc(doc(db, 'organizations', orgId), {
      name: clampStr(input.name, 140),
      slug,
      type: input.type,
      ownerUid: actor.uid,
      authorizedUids: [actor.uid],
      status: 'active',
      planId: clampStr(input.planId || 'professional', 80),
      billingCycle: input.billingCycle || 'monthly',
      address: clampStr(input.address, 300),
      phone: clampStr(input.phone, 32),
      email: clampStr(input.email || actor.email, 160),
      website: '',
      currency: input.currency || 'USD',
      timezone: 'UTC',
      language: 'en',
      prescriptionHeader: clampStr(input.name, 400),
      prescriptionFooter: 'Please bring this prescription on your next visit. Emergency contact: ' + clampStr(input.phone, 32),
      invoiceFooter: 'Thank you for choosing ' + clampStr(input.name, 100) + '. Computer generated receipt.',
      enablePharmacy: input.enablePharmacy,
      enableInpatient: input.enableInpatient,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Create Clinic Owner membership doc (Master Source of Truth for RBAC)
    const memberPath = `organizations/${orgId}/members/${actor.uid}`;
    try {
      await setDoc(doc(db, 'organizations', orgId, 'members', actor.uid), {
        organizationId: orgId,
        ownerUid: actor.uid,
        authorizedUids: [actor.uid],
        uid: actor.uid,
        staffCode: 'STF-1001',
        name: clampStr(actor.name || 'Clinic Owner', 120),
        email: clampStr(actor.email, 160),
        phone: clampStr(input.phone, 32),
        role: 'clinic_owner',
        department: 'Administration',
        designation: 'Founder & Clinic Owner',
        salary: 0,
        joiningDate: todayISO(),
        shift: 'Full Day',
        attendanceStatus: 'present',
        status: 'active',
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (memberErr) {
      handleFirestoreError(memberErr, OperationType.CREATE, memberPath);
    }

    // 3. Create Default Main Branch
    const branchId = makeDocId('brn');
    await setDoc(doc(db, 'organizations', orgId, 'branches', branchId), {
      organizationId: orgId,
      ownerUid: actor.uid,
      authorizedUids: [actor.uid],
      name: 'Main Branch',
      code: 'BR-MAIN',
      address: clampStr(input.address, 260),
      phone: clampStr(input.phone, 32),
      managerName: clampStr(actor.name || 'Clinic Owner', 100),
      isMain: true,
      status: 'active',
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. Update user's activeOrgId
    await updateUserPrefs(actor.uid, { activeOrgId: orgId });
    return orgId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orgPath);
  }
}

export async function updateOrganizationSettings(
  orgId: string,
  patch: Partial<Pick<Organization, 'name' | 'type' | 'address' | 'phone' | 'email' | 'website' | 'currency' | 'timezone' | 'language' | 'prescriptionHeader' | 'prescriptionFooter' | 'invoiceFooter' | 'enablePharmacy' | 'enableInpatient' | 'planId' | 'billingCycle' | 'status' | 'authorizedUids'>>
) {
  const path = `organizations/${orgId}`;
  try {
    await updateDoc(
      doc(db, 'organizations', orgId),
      stripUndefined({
        ...(patch.name !== undefined ? { name: clampStr(patch.name, 140) } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.address !== undefined ? { address: clampStr(patch.address, 300) } : {}),
        ...(patch.phone !== undefined ? { phone: clampStr(patch.phone, 32) } : {}),
        ...(patch.email !== undefined ? { email: clampStr(patch.email, 160) } : {}),
        ...(patch.website !== undefined ? { website: sanitizeSafeUrl(patch.website) } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
        ...(patch.timezone !== undefined ? { timezone: clampStr(patch.timezone, 64) } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.prescriptionHeader !== undefined ? { prescriptionHeader: clampStr(patch.prescriptionHeader, 400) } : {}),
        ...(patch.prescriptionFooter !== undefined ? { prescriptionFooter: clampStr(patch.prescriptionFooter, 400) } : {}),
        ...(patch.invoiceFooter !== undefined ? { invoiceFooter: clampStr(patch.invoiceFooter, 400) } : {}),
        ...(patch.enablePharmacy !== undefined ? { enablePharmacy: patch.enablePharmacy } : {}),
        ...(patch.enableInpatient !== undefined ? { enableInpatient: patch.enableInpatient } : {}),
        ...(patch.planId !== undefined ? { planId: clampStr(patch.planId, 80) } : {}),
        ...(patch.billingCycle !== undefined ? { billingCycle: patch.billingCycle } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.authorizedUids !== undefined ? { authorizedUids: patch.authorizedUids.slice(0, 50) } : {}),
        updatedAt: serverTimestamp(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// PATIENTS CRUD
// ============================================================================
export async function savePatient(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    patientCode?: string;
    patientAuthUid?: string;
    name: string;
    gender: 'male' | 'female' | 'other';
    dob?: string;
    age?: number;
    bloodGroup?: string;
    phone: string;
    email?: string;
    address?: string;
    emergencyContact?: string;
    guardianName?: string;
    medicalHistory?: string;
    allergies?: string;
    existingDiseases?: string;
    assignedDoctorId?: string;
    assignedDoctorName?: string;
    branchId?: string;
    notes?: string;
    status: 'active' | 'archived';
  },
  nextSeq = 1
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('pat');
  const path = `organizations/${org.id}/patients/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(
        doc(db, 'organizations', org.id, 'patients', docId),
        stripUndefined({
          patientAuthUid: clampStr(data.patientAuthUid, 128),
          name: clampStr(data.name, 120),
          gender: data.gender,
          dob: clampStr(data.dob, 20),
          age: Number(data.age || 0),
          bloodGroup: clampStr(data.bloodGroup, 10),
          phone: clampStr(data.phone, 32),
          email: clampStr(data.email, 160),
          address: clampStr(data.address, 300),
          emergencyContact: clampStr(data.emergencyContact, 140),
          guardianName: clampStr(data.guardianName, 120),
          medicalHistory: clampStr(data.medicalHistory, 1500),
          allergies: clampStr(data.allergies, 500),
          existingDiseases: clampStr(data.existingDiseases, 500),
          assignedDoctorId: clampStr(data.assignedDoctorId, 128),
          assignedDoctorName: clampStr(data.assignedDoctorName, 120),
          branchId: clampStr(data.branchId, 128),
          notes: clampStr(data.notes, 1500),
          status: data.status,
          updatedAt: serverTimestamp(),
        })
      );
      await logAudit(org, actor, 'UPDATE_PATIENT', 'patients', `Updated patient ${data.name}`, docId);
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'patients', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        patientAuthUid: clampStr(data.patientAuthUid, 128),
        patientCode: clampStr(data.patientCode || makeCode('PAT', nextSeq), 40),
        name: clampStr(data.name, 120),
        gender: data.gender,
        dob: clampStr(data.dob, 20),
        age: Number(data.age || 0),
        bloodGroup: clampStr(data.bloodGroup, 10),
        phone: clampStr(data.phone, 32),
        email: clampStr(data.email, 160),
        address: clampStr(data.address, 300),
        emergencyContact: clampStr(data.emergencyContact, 140),
        guardianName: clampStr(data.guardianName, 120),
        medicalHistory: clampStr(data.medicalHistory, 1500),
        allergies: clampStr(data.allergies, 500),
        existingDiseases: clampStr(data.existingDiseases, 500),
        assignedDoctorId: clampStr(data.assignedDoctorId, 128),
        assignedDoctorName: clampStr(data.assignedDoctorName, 120),
        branchId: clampStr(data.branchId, 128),
        notes: clampStr(data.notes, 1500),
        status: data.status || 'active',
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit(org, actor, 'CREATE_PATIENT', 'patients', `Registered patient ${data.name}`, docId);
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function removePatient(org: Organization, actor: TenantActor, patientId: string, name: string) {
  const path = `organizations/${org.id}/patients/${patientId}`;
  try {
    await deleteDoc(doc(db, 'organizations', org.id, 'patients', patientId));
    await logAudit(org, actor, 'DELETE_PATIENT', 'patients', `Deleted patient record ${name}`, patientId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// DOCTORS & SCHEDULES CRUD
// ============================================================================
export async function saveDoctor(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    doctorCode?: string;
    name: string;
    specialization: string;
    discipline?: string;
    qualifications?: string;
    registrationLabel?: string;
    registrationNumber?: string;
    phone?: string;
    email?: string;
    chamberInfo?: string;
    branchId?: string;
    consultationFee: number;
    followUpFee?: number;
    experienceYears?: number;
    slotDurationMinutes: number;
    availableDays: string[];
    morningShift: string;
    eveningShift: string;
    breakTime: string;
    leaveDates: string[];
    emergencyAvailable: boolean;
    status: 'active' | 'on_leave' | 'inactive';
  },
  nextSeq = 1
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('doc');
  const path = `organizations/${org.id}/doctors/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'doctors', docId), {
        name: clampStr(data.name, 120),
        specialization: clampStr(data.specialization, 100),
        discipline: clampStr(data.discipline, 60),
        qualifications: clampStr(data.qualifications, 200),
        registrationLabel: clampStr(data.registrationLabel || 'BMDC Reg. No.', 60),
        registrationNumber: clampStr(data.registrationNumber, 80),
        phone: clampStr(data.phone, 32),
        email: clampStr(data.email, 160),
        chamberInfo: clampStr(data.chamberInfo, 240),
        branchId: clampStr(data.branchId, 128),
        consultationFee: Math.max(0, Number(data.consultationFee || 0)),
        followUpFee: Math.max(0, Number(data.followUpFee || 0)),
        experienceYears: Math.max(0, Number(data.experienceYears || 0)),
        slotDurationMinutes: Math.max(5, Math.min(180, Number(data.slotDurationMinutes || 15))),
        availableDays: data.availableDays.slice(0, 7),
        morningShift: clampStr(data.morningShift, 40),
        eveningShift: clampStr(data.eveningShift, 40),
        breakTime: clampStr(data.breakTime, 40),
        leaveDates: data.leaveDates.slice(0, 60),
        emergencyAvailable: Boolean(data.emergencyAvailable),
        status: data.status,
        updatedAt: serverTimestamp(),
      });
      await logAudit(org, actor, 'UPDATE_DOCTOR', 'doctors', `Updated doctor ${data.name}`, docId);
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'doctors', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        doctorCode: clampStr(data.doctorCode || makeCode('DOC', nextSeq), 40),
        name: clampStr(data.name, 120),
        specialization: clampStr(data.specialization, 100),
        discipline: clampStr(data.discipline || 'Allopathic', 60),
        qualifications: clampStr(data.qualifications, 200),
        registrationLabel: clampStr(data.registrationLabel || 'BMDC Reg. No.', 60),
        registrationNumber: clampStr(data.registrationNumber, 80),
        phone: clampStr(data.phone, 32),
        email: clampStr(data.email, 160),
        chamberInfo: clampStr(data.chamberInfo, 240),
        branchId: clampStr(data.branchId, 128),
        consultationFee: Math.max(0, Number(data.consultationFee || 0)),
        followUpFee: Math.max(0, Number(data.followUpFee || 0)),
        experienceYears: Math.max(0, Number(data.experienceYears || 0)),
        slotDurationMinutes: Math.max(5, Math.min(180, Number(data.slotDurationMinutes || 15))),
        availableDays: data.availableDays.slice(0, 7),
        morningShift: clampStr(data.morningShift, 40),
        eveningShift: clampStr(data.eveningShift, 40),
        breakTime: clampStr(data.breakTime, 40),
        leaveDates: data.leaveDates.slice(0, 60),
        emergencyAvailable: Boolean(data.emergencyAvailable),
        status: data.status || 'active',
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit(org, actor, 'CREATE_DOCTOR', 'doctors', `Added doctor ${data.name}`, docId);
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function removeDoctor(org: Organization, actor: TenantActor, doctorId: string, name: string) {
  const path = `organizations/${org.id}/doctors/${doctorId}`;
  try {
    await deleteDoc(doc(db, 'organizations', org.id, 'doctors', doctorId));
    await logAudit(org, actor, 'DELETE_DOCTOR', 'doctors', `Removed doctor ${name}`, doctorId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// APPOINTMENTS CRUD
// ============================================================================
export async function createAppointment(
  org: Organization,
  actor: TenantActor,
  data: {
    patientId: string;
    patientName: string;
    patientPhone?: string;
    patientAuthUid?: string;
    doctorId: string;
    doctorName: string;
    branchId?: string;
    date: string;
    timeSlot: string;
    type: 'new' | 'follow_up' | 'emergency' | 'teleconsult';
    consultationFee: number;
    status: AppointmentStatus;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    notes?: string;
    followUpDate?: string;
    followUpReason?: string;
    queueToken: number;
  },
  nextSeq = 1
) {
  const docId = makeDocId('apt');
  const path = `organizations/${org.id}/appointments/${docId}`;
  try {
    await setDoc(doc(db, 'organizations', org.id, 'appointments', docId), {
      organizationId: org.id,
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids,
      patientAuthUid: clampStr(data.patientAuthUid, 128),
      appointmentNumber: makeCode('APT', nextSeq),
      queueToken: Math.max(1, Number(data.queueToken || 1)),
      patientId: clampStr(data.patientId, 128),
      patientName: clampStr(data.patientName, 120),
      patientPhone: clampStr(data.patientPhone, 32),
      doctorId: clampStr(data.doctorId, 128),
      doctorName: clampStr(data.doctorName, 120),
      branchId: clampStr(data.branchId, 128),
      date: clampStr(data.date, 20),
      timeSlot: clampStr(data.timeSlot, 24),
      type: data.type,
      consultationFee: Math.max(0, Number(data.consultationFee || 0)),
      status: data.status,
      paymentStatus: data.paymentStatus,
      notes: clampStr(data.notes, 800),
      followUpDate: clampStr(data.followUpDate, 20),
      followUpReason: clampStr(data.followUpReason, 300),
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      org,
      actor,
      'BOOK_APPOINTMENT',
      'appointments',
      `Booked ${data.patientName} with ${data.doctorName} on ${data.date} ${data.timeSlot}`,
      docId
    );
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAppointment(
  org: Organization,
  actor: TenantActor,
  appointmentId: string,
  patch: {
    date?: string;
    timeSlot?: string;
    type?: 'new' | 'follow_up' | 'emergency' | 'teleconsult';
    consultationFee?: number;
    status?: AppointmentStatus;
    paymentStatus?: 'unpaid' | 'partial' | 'paid';
    notes?: string;
    followUpDate?: string;
    followUpReason?: string;
  }
) {
  const path = `organizations/${org.id}/appointments/${appointmentId}`;
  try {
    await updateDoc(
      doc(db, 'organizations', org.id, 'appointments', appointmentId),
      stripUndefined({
        ...(patch.date !== undefined ? { date: clampStr(patch.date, 20) } : {}),
        ...(patch.timeSlot !== undefined ? { timeSlot: clampStr(patch.timeSlot, 24) } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.consultationFee !== undefined ? { consultationFee: Math.max(0, Number(patch.consultationFee)) } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.paymentStatus !== undefined ? { paymentStatus: patch.paymentStatus } : {}),
        ...(patch.notes !== undefined ? { notes: clampStr(patch.notes, 800) } : {}),
        ...(patch.followUpDate !== undefined ? { followUpDate: clampStr(patch.followUpDate, 20) } : {}),
        ...(patch.followUpReason !== undefined ? { followUpReason: clampStr(patch.followUpReason, 300) } : {}),
        updatedAt: serverTimestamp(),
      })
    );
    await logAudit(org, actor, 'UPDATE_APPOINTMENT', 'appointments', `Updated appointment ${appointmentId} (${patch.status || 'details'})`, appointmentId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeAppointment(
  org: Organization,
  actor: TenantActor,
  appointmentId: string,
  summaryLabel: string
) {
  const path = `organizations/${org.id}/appointments/${appointmentId}`;
  try {
    await deleteDoc(doc(db, 'organizations', org.id, 'appointments', appointmentId));
    await logAudit(org, actor, 'DELETE_APPOINTMENT', 'appointments', `Deleted appointment ${summaryLabel}`, appointmentId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeCompletedAppointments(
  org: Organization,
  actor: TenantActor,
  targets: Array<{ id: string; patientName: string }>
) {
  if (targets.length === 0) return;
  const path = `organizations/${org.id}/appointments`;
  try {
    // Firestore batch limit is 500 writes per batch; chunk safely at 400
    for (let i = 0; i < targets.length; i += 400) {
      const chunk = targets.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((t) => {
        batch.delete(doc(db, 'organizations', org.id, 'appointments', t.id));
      });
      await batch.commit();
    }
    await logAudit(
      org,
      actor,
      'BULK_DELETE_COMPLETED_APPOINTMENTS',
      'appointments',
      `Deleted ${targets.length} completed appointment(s)`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// DIGITAL PRESCRIPTIONS CRUD
// ============================================================================
export async function savePrescription(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    appointmentId?: string;
    patientId: string;
    patientName: string;
    patientCode?: string;
    patientAge?: number;
    patientGender?: string;
    patientAuthUid?: string;
    doctorId: string;
    doctorName: string;
    doctorQualifications?: string;
    doctorRegistration?: string;
    templateType: 'general_a4' | 'compact' | 'homeopathy';
    vitals: PrescriptionVitals;
    chiefComplaints: string;
    clinicalFindings: string;
    diagnosis: string;
    investigationAdvice: string;
    treatmentPlan: string;
    medicines: PrescribedMedicine[];
    followUpDate?: string;
    digitalSignature?: string;
    status: 'draft' | 'finalized';
  },
  nextSeq = 1
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('rx');
  const path = `organizations/${org.id}/prescriptions/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'prescriptions', docId), {
        templateType: data.templateType,
        vitals: data.vitals,
        chiefComplaints: clampStr(data.chiefComplaints, 1000),
        clinicalFindings: clampStr(data.clinicalFindings, 1000),
        diagnosis: clampStr(data.diagnosis, 600),
        investigationAdvice: clampStr(data.investigationAdvice, 1000),
        treatmentPlan: clampStr(data.treatmentPlan, 1200),
        medicines: data.medicines.slice(0, 30),
        followUpDate: clampStr(data.followUpDate, 20),
        digitalSignature: clampStr(data.digitalSignature, 120),
        status: data.status,
        updatedAt: serverTimestamp(),
      });
      await logAudit(org, actor, 'UPDATE_PRESCRIPTION', 'prescriptions', `Updated prescription (${data.status}) for ${data.patientName}`, docId);
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'prescriptions', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        patientAuthUid: clampStr(data.patientAuthUid, 128),
        rxNumber: makeCode('RX', nextSeq),
        appointmentId: clampStr(data.appointmentId, 128),
        patientId: clampStr(data.patientId, 128),
        patientName: clampStr(data.patientName, 120),
        patientCode: clampStr(data.patientCode, 40),
        patientAge: Number(data.patientAge || 0),
        patientGender: clampStr(data.patientGender, 20),
        doctorId: clampStr(data.doctorId, 128),
        doctorName: clampStr(data.doctorName, 120),
        doctorQualifications: clampStr(data.doctorQualifications, 200),
        doctorRegistration: clampStr(data.doctorRegistration, 120),
        templateType: data.templateType,
        vitals: data.vitals,
        chiefComplaints: clampStr(data.chiefComplaints, 1000),
        clinicalFindings: clampStr(data.clinicalFindings, 1000),
        diagnosis: clampStr(data.diagnosis, 600),
        investigationAdvice: clampStr(data.investigationAdvice, 1000),
        treatmentPlan: clampStr(data.treatmentPlan, 1200),
        medicines: data.medicines.slice(0, 30),
        followUpDate: clampStr(data.followUpDate, 20),
        digitalSignature: clampStr(data.digitalSignature || data.doctorName, 120),
        status: data.status,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit(org, actor, 'CREATE_PRESCRIPTION', 'prescriptions', `Created ${data.status} Rx for ${data.patientName}`, docId);
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

// ============================================================================
// LABORATORY CATALOG & ORDERS CRUD
// ============================================================================
export async function saveLabTest(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    code: string;
    name: string;
    category: string;
    price: number;
    sampleType: string;
    preparation?: string;
    referenceRange?: string;
    unit?: string;
    description?: string;
    status: 'active' | 'inactive';
  }
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('tst');
  const path = `organizations/${org.id}/labTests/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'labTests', docId), {
        code: clampStr(data.code, 40),
        name: clampStr(data.name, 140),
        category: clampStr(data.category, 80),
        price: Math.max(0, Number(data.price || 0)),
        sampleType: clampStr(data.sampleType, 60),
        preparation: clampStr(data.preparation, 240),
        referenceRange: clampStr(data.referenceRange, 120),
        unit: clampStr(data.unit, 40),
        description: clampStr(data.description, 500),
        status: data.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'labTests', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        code: clampStr(data.code, 40),
        name: clampStr(data.name, 140),
        category: clampStr(data.category, 80),
        price: Math.max(0, Number(data.price || 0)),
        sampleType: clampStr(data.sampleType, 60),
        preparation: clampStr(data.preparation, 240),
        referenceRange: clampStr(data.referenceRange, 120),
        unit: clampStr(data.unit, 40),
        description: clampStr(data.description, 500),
        status: data.status || 'active',
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function createLabOrder(
  org: Organization,
  actor: TenantActor,
  data: {
    patientId: string;
    patientName: string;
    patientCode?: string;
    patientAuthUid?: string;
    referringDoctorId?: string;
    referringDoctorName?: string;
    tests: LabOrderTestItem[];
    totalPrice: number;
  },
  nextSeq = 1
) {
  const docId = makeDocId('lab');
  const path = `organizations/${org.id}/labOrders/${docId}`;
  const initialHistory: LabOrderAuditEntry[] = [
    { action: 'Order Created', by: actor.name, at: new Date().toISOString() },
  ];
  try {
    await setDoc(doc(db, 'organizations', org.id, 'labOrders', docId), {
      organizationId: org.id,
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids,
      patientAuthUid: clampStr(data.patientAuthUid, 128),
      orderNumber: makeCode('LAB', nextSeq),
      patientId: clampStr(data.patientId, 128),
      patientName: clampStr(data.patientName, 120),
      patientCode: clampStr(data.patientCode, 40),
      referringDoctorId: clampStr(data.referringDoctorId, 128),
      referringDoctorName: clampStr(data.referringDoctorName, 120),
      tests: data.tests.slice(0, 25),
      totalPrice: Math.max(0, Number(data.totalPrice || 0)),
      status: 'ordered',
      technicianName: '',
      verifiedByName: '',
      verifiedAt: '',
      deliveredAt: '',
      history: initialHistory,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAudit(org, actor, 'CREATE_LAB_ORDER', 'laboratory', `Ordered ${data.tests.length} lab test(s) for ${data.patientName}`, docId);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLabOrderResults(
  org: Organization,
  actor: TenantActor,
  orderId: string,
  patch: {
    tests?: LabOrderTestItem[];
    status: LabOrderStatus;
    technicianName?: string;
    verifiedByName?: string;
    verifiedAt?: string;
    deliveredAt?: string;
    history: LabOrderAuditEntry[];
  }
) {
  const path = `organizations/${org.id}/labOrders/${orderId}`;
  try {
    // Strictly respect Firestore terminal lock: when marking delivered from verified, never pass `tests`
    if (patch.status === 'delivered') {
      await updateDoc(doc(db, 'organizations', org.id, 'labOrders', orderId), {
        status: 'delivered',
        deliveredAt: clampStr(patch.deliveredAt || new Date().toISOString(), 40),
        history: patch.history.slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(
        doc(db, 'organizations', org.id, 'labOrders', orderId),
        stripUndefined({
          ...(patch.tests !== undefined ? { tests: patch.tests.slice(0, 25) } : {}),
          status: patch.status,
          ...(patch.technicianName !== undefined ? { technicianName: clampStr(patch.technicianName, 120) } : {}),
          ...(patch.verifiedByName !== undefined ? { verifiedByName: clampStr(patch.verifiedByName, 120) } : {}),
          ...(patch.verifiedAt !== undefined ? { verifiedAt: clampStr(patch.verifiedAt, 40) } : {}),
          history: patch.history.slice(0, 40),
          updatedAt: serverTimestamp(),
        })
      );
    }
    await logAudit(org, actor, 'UPDATE_LAB_ORDER', 'laboratory', `Lab order ${orderId} moved to ${patch.status}`, orderId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// BILLING INVOICES & EXPENSES CRUD
// ============================================================================
export async function createInvoice(
  org: Organization,
  actor: TenantActor,
  data: {
    patientId: string;
    patientName: string;
    patientCode?: string;
    patientAuthUid?: string;
    branchId?: string;
    items: InvoiceLineItem[];
    discount: number;
    taxRate: number;
    initialPayment?: InvoicePayment;
  },
  nextSeq = 1
) {
  const docId = makeDocId('inv');
  const path = `organizations/${org.id}/invoices/${docId}`;
  const subtotal = data.items.reduce((s, item) => s + item.total, 0);
  const discount = Math.max(0, Math.min(subtotal, Number(data.discount || 0)));
  const taxable = Math.max(0, subtotal - discount);
  const taxRate = Math.max(0, Math.min(100, Number(data.taxRate || 0)));
  const taxAmount = Math.round(((taxable * taxRate) / 100) * 100) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;
  const payments = data.initialPayment && data.initialPayment.amount > 0 ? [data.initialPayment] : [];
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const dueAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
  const status = paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  try {
    await setDoc(doc(db, 'organizations', org.id, 'invoices', docId), {
      organizationId: org.id,
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids,
      patientAuthUid: clampStr(data.patientAuthUid, 128),
      invoiceNumber: makeCode('INV', nextSeq),
      patientId: clampStr(data.patientId, 128),
      patientName: clampStr(data.patientName, 120),
      patientCode: clampStr(data.patientCode, 40),
      branchId: clampStr(data.branchId, 128),
      items: data.items.slice(0, 30),
      subtotal,
      discount,
      taxRate,
      taxAmount,
      totalAmount,
      paidAmount,
      dueAmount,
      status,
      payments,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAudit(org, actor, 'CREATE_INVOICE', 'billing', `Created invoice for ${data.patientName} (${totalAmount})`, docId);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function recordInvoicePayment(
  org: Organization,
  actor: TenantActor,
  invoiceId: string,
  currentTotal: number,
  existingPayments: InvoicePayment[],
  newPayment: InvoicePayment | null,
  markRefunded = false
) {
  const path = `organizations/${org.id}/invoices/${invoiceId}`;
  const payments = newPayment ? [...existingPayments, newPayment].slice(0, 20) : existingPayments;
  const paidAmount = markRefunded ? 0 : payments.reduce((s, p) => s + p.amount, 0);
  const dueAmount = markRefunded ? 0 : Math.max(0, Math.round((currentTotal - paidAmount) * 100) / 100);
  const status = markRefunded
    ? 'refunded'
    : paidAmount >= currentTotal && currentTotal > 0
      ? 'paid'
      : paidAmount > 0
        ? 'partial'
        : 'unpaid';

  try {
    await updateDoc(doc(db, 'organizations', org.id, 'invoices', invoiceId), {
      paidAmount,
      dueAmount,
      status,
      payments,
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      org,
      actor,
      markRefunded ? 'REFUND_INVOICE' : 'RECORD_PAYMENT',
      'billing',
      markRefunded
        ? `Refunded invoice ${invoiceId}`
        : `Recorded payment of ${newPayment?.amount} via ${newPayment?.method}`,
      invoiceId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createExpense(
  org: Organization,
  actor: TenantActor,
  data: {
    title: string;
    category: string;
    amount: number;
    date: string;
    paymentMethod: string;
    vendor?: string;
    branchId?: string;
    notes?: string;
  }
) {
  const docId = makeDocId('exp');
  const path = `organizations/${org.id}/expenses/${docId}`;
  try {
    await setDoc(doc(db, 'organizations', org.id, 'expenses', docId), {
      organizationId: org.id,
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids,
      title: clampStr(data.title, 140),
      category: clampStr(data.category, 60),
      amount: Math.max(0, Number(data.amount || 0)),
      date: clampStr(data.date, 20),
      paymentMethod: clampStr(data.paymentMethod, 40),
      vendor: clampStr(data.vendor, 120),
      branchId: clampStr(data.branchId, 128),
      notes: clampStr(data.notes, 400),
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAudit(org, actor, 'CREATE_EXPENSE', 'billing', `Recorded expense: ${data.title} (${data.amount})`, docId);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteExpense(org: Organization, actor: TenantActor, expenseId: string) {
  const path = `organizations/${org.id}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'organizations', org.id, 'expenses', expenseId));
    await logAudit(org, actor, 'DELETE_EXPENSE', 'billing', `Deleted expense ${expenseId}`, expenseId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// PHARMACY, BEDS, STAFF, ROLES, BRANCHES, NOTIFICATIONS
// ============================================================================
export async function savePharmacyItem(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    brandName: string;
    genericName: string;
    manufacturer?: string;
    batchNumber?: string;
    barcode?: string;
    supplierName?: string;
    purchasePrice: number;
    sellingPrice: number;
    stockQty: number;
    reorderLevel: number;
    expiryDate: string;
    status: 'active' | 'discontinued';
  }
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('phm');
  const path = `organizations/${org.id}/pharmacyInventory/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'pharmacyInventory', docId), {
        brandName: clampStr(data.brandName, 120),
        genericName: clampStr(data.genericName, 120),
        manufacturer: clampStr(data.manufacturer, 120),
        batchNumber: clampStr(data.batchNumber, 60),
        barcode: clampStr(data.barcode, 80),
        supplierName: clampStr(data.supplierName, 120),
        purchasePrice: Math.max(0, Number(data.purchasePrice || 0)),
        sellingPrice: Math.max(0, Number(data.sellingPrice || 0)),
        stockQty: Math.max(0, Number(data.stockQty || 0)),
        reorderLevel: Math.max(0, Number(data.reorderLevel || 0)),
        expiryDate: clampStr(data.expiryDate, 20),
        status: data.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'pharmacyInventory', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        brandName: clampStr(data.brandName, 120),
        genericName: clampStr(data.genericName, 120),
        manufacturer: clampStr(data.manufacturer, 120),
        batchNumber: clampStr(data.batchNumber, 60),
        barcode: clampStr(data.barcode, 80),
        supplierName: clampStr(data.supplierName, 120),
        purchasePrice: Math.max(0, Number(data.purchasePrice || 0)),
        sellingPrice: Math.max(0, Number(data.sellingPrice || 0)),
        stockQty: Math.max(0, Number(data.stockQty || 0)),
        reorderLevel: Math.max(0, Number(data.reorderLevel || 0)),
        expiryDate: clampStr(data.expiryDate, 20),
        status: data.status || 'active',
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function removePharmacyItem(
  org: Organization,
  actor: TenantActor,
  itemId: string,
  brandName: string
) {
  const path = `organizations/${org.id}/pharmacyInventory/${itemId}`;
  try {
    await deleteDoc(doc(db, 'organizations', org.id, 'pharmacyInventory', itemId));
    await logAudit(org, actor, 'DELETE_PHARMACY_ITEM', 'pharmacy', `Deleted pharmacy product ${brandName}`, itemId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function dispensePharmacySale(
  org: Organization,
  actor: TenantActor,
  data: {
    patientId: string;
    patientName: string;
    patientCode?: string;
    patientAuthUid?: string;
    branchId?: string;
    cart: Array<{ item: PharmacyItem; qty: number }>;
    discount: number;
    taxRate: number;
    paymentMethod: InvoicePayment['method'];
    paidAmountInput: number;
    paymentReference?: string;
    prescriptionRef?: string;
  },
  nextInvoiceSeq = 1
): Promise<Invoice> {
  if (data.cart.length === 0) {
    throw new Error('Add at least one medicine to dispense.');
  }

  for (const line of data.cart) {
    if (line.qty <= 0) throw new Error(`Invalid quantity for ${line.item.brandName}.`);
    if (line.qty > line.item.stockQty) {
      throw new Error(`Insufficient stock for ${line.item.brandName} (available: ${line.item.stockQty}).`);
    }
  }

  const invoiceId = makeDocId('inv');
  const invoiceNumber = makeCode('PHM', nextInvoiceSeq);
  const path = `organizations/${org.id}/invoices/${invoiceId}`;

  const items: InvoiceLineItem[] = data.cart.slice(0, 30).map(({ item, qty }) => ({
    category: 'pharmacy',
    description: clampStr(
      `${item.brandName}${item.genericName ? ` (${item.genericName})` : ''}${data.prescriptionRef ? ` [${data.prescriptionRef}]` : ''}`,
      140
    ),
    qty,
    unitPrice: Math.max(0, Number(item.sellingPrice || 0)),
    total: Math.round(qty * Math.max(0, Number(item.sellingPrice || 0)) * 100) / 100,
  }));

  const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  const discount = Math.max(0, Math.min(subtotal, Math.round(Number(data.discount || 0) * 100) / 100));
  const taxable = Math.max(0, subtotal - discount);
  const taxRate = Math.max(0, Math.min(100, Number(data.taxRate || 0)));
  const taxAmount = Math.round(((taxable * taxRate) / 100) * 100) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;

  const paidAmount = Math.max(0, Math.min(totalAmount, Math.round(Number(data.paidAmountInput || 0) * 100) / 100));
  const dueAmount = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
  const status: Invoice['status'] =
    paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  const payments: InvoicePayment[] =
    paidAmount > 0
      ? [
          {
            id: makeDocId('pay'),
            amount: paidAmount,
            method: data.paymentMethod,
            reference: clampStr(data.paymentReference || 'Pharmacy Counter Sale', 100),
            paidAt: new Date().toISOString(),
            recordedBy: clampStr(actor.name || actor.email || 'Staff', 80),
          },
        ]
      : [];

  const safePatientId = clampStr(data.patientId || 'walkin_customer', 128).replace(/[^a-zA-Z0-9_\-]/g, '') || 'walkin_customer';
  const safePatientName = clampStr(data.patientName || 'Walk-In Customer', 120) || 'Walk-In Customer';

  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'organizations', org.id, 'invoices', invoiceId), {
      organizationId: org.id,
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids,
      patientAuthUid: clampStr(data.patientAuthUid, 128),
      invoiceNumber,
      patientId: safePatientId,
      patientName: safePatientName,
      patientCode: clampStr(data.patientCode || (safePatientId === 'walkin_customer' ? 'WALK-IN' : ''), 40),
      branchId: clampStr(data.branchId, 128),
      items,
      subtotal,
      discount,
      taxRate,
      taxAmount,
      totalAmount,
      paidAmount,
      dueAmount,
      status,
      payments,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const { item, qty } of data.cart.slice(0, 30)) {
      const nextStock = Math.max(0, Math.floor(item.stockQty - qty));
      batch.update(doc(db, 'organizations', org.id, 'pharmacyInventory', item.id), {
        stockQty: nextStock,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await logAudit(
      org,
      actor,
      'DISPENSE_PHARMACY_SALE',
      'pharmacy',
      `Dispensed ${items.length} medicine(s) (${invoiceNumber}) to ${safePatientName} · Total ${totalAmount}`,
      invoiceId
    );

    return {
      id: invoiceId,
      organizationId: org.id,
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids,
      createdByUid: actor.uid,
      patientAuthUid: clampStr(data.patientAuthUid, 128),
      invoiceNumber,
      patientId: safePatientId,
      patientName: safePatientName,
      patientCode: clampStr(data.patientCode || (safePatientId === 'walkin_customer' ? 'WALK-IN' : ''), 40),
      branchId: clampStr(data.branchId, 128),
      items,
      subtotal,
      discount,
      taxRate,
      taxAmount,
      totalAmount,
      paidAmount,
      dueAmount,
      status,
      payments,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveBed(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    wardName: string;
    roomNumber?: string;
    bedNumber: string;
    type: 'general_ward' | 'semi_cabin' | 'vip_cabin' | 'icu';
    dailyRate: number;
    status: 'available' | 'occupied' | 'maintenance';
    currentPatientId?: string;
    currentPatientName?: string;
    admittedAt?: string;
    attendingDoctorName?: string;
    nursingNotes?: string;
  }
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('bed');
  const path = `organizations/${org.id}/beds/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'beds', docId), {
        wardName: clampStr(data.wardName, 80),
        roomNumber: clampStr(data.roomNumber, 40),
        bedNumber: clampStr(data.bedNumber, 40),
        type: data.type,
        dailyRate: Math.max(0, Number(data.dailyRate || 0)),
        status: data.status,
        currentPatientId: clampStr(data.currentPatientId, 128),
        currentPatientName: clampStr(data.currentPatientName, 120),
        admittedAt: clampStr(data.admittedAt, 40),
        attendingDoctorName: clampStr(data.attendingDoctorName, 120),
        nursingNotes: clampStr(data.nursingNotes, 1000),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'beds', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        wardName: clampStr(data.wardName, 80),
        roomNumber: clampStr(data.roomNumber, 40),
        bedNumber: clampStr(data.bedNumber, 40),
        type: data.type,
        dailyRate: Math.max(0, Number(data.dailyRate || 0)),
        status: data.status || 'available',
        currentPatientId: clampStr(data.currentPatientId, 128),
        currentPatientName: clampStr(data.currentPatientName, 120),
        admittedAt: clampStr(data.admittedAt, 40),
        attendingDoctorName: clampStr(data.attendingDoctorName, 120),
        nursingNotes: clampStr(data.nursingNotes, 1000),
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function saveStaffMember(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    uid?: string;
    staffCode?: string;
    name: string;
    email?: string;
    phone?: string;
    role: StaffRole;
    customRoleName?: string;
    department?: string;
    designation?: string;
    branchId?: string;
    salary?: number;
    joiningDate?: string;
    shift?: string;
    attendanceStatus?: 'present' | 'absent' | 'on_leave';
    status: 'active' | 'inactive';
  },
  nextSeq = 1
) {
  const isEdit = Boolean(data.id);
  const memberUid = (data.id || data.uid?.trim() || makeDocId('stf')).replace(/[^a-zA-Z0-9_\-]/g, '');
  const path = `organizations/${org.id}/members/${memberUid}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'members', memberUid), {
        staffCode: clampStr(data.staffCode, 40),
        name: clampStr(data.name, 120),
        email: clampStr(data.email, 160),
        phone: clampStr(data.phone, 32),
        role: data.role,
        customRoleName: clampStr(data.customRoleName, 80),
        department: clampStr(data.department, 80),
        designation: clampStr(data.designation, 80),
        branchId: clampStr(data.branchId, 128),
        salary: Math.max(0, Number(data.salary || 0)),
        joiningDate: clampStr(data.joiningDate, 32),
        shift: clampStr(data.shift, 60),
        attendanceStatus: data.attendanceStatus || 'present',
        status: data.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'members', memberUid), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        uid: memberUid,
        staffCode: clampStr(data.staffCode || makeCode('STF', nextSeq), 40),
        name: clampStr(data.name, 120),
        email: clampStr(data.email, 160),
        phone: clampStr(data.phone, 32),
        role: data.role,
        customRoleName: clampStr(data.customRoleName, 80),
        department: clampStr(data.department, 80),
        designation: clampStr(data.designation, 80),
        branchId: clampStr(data.branchId, 128),
        salary: Math.max(0, Number(data.salary || 0)),
        joiningDate: clampStr(data.joiningDate || todayISO(), 32),
        shift: clampStr(data.shift || 'Morning (09:00-17:00)', 60),
        attendanceStatus: data.attendanceStatus || 'present',
        status: data.status || 'active',
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    // If real external Firebase Auth UID was provided, add to org.authorizedUids
    if (data.uid && data.uid.trim().length > 15 && !org.authorizedUids.includes(data.uid.trim())) {
      await updateOrganizationSettings(org.id, {
        authorizedUids: [...org.authorizedUids, data.uid.trim()].slice(0, 50),
      });
    }
    await logAudit(org, actor, isEdit ? 'UPDATE_STAFF' : 'ADD_STAFF', 'staff', `${isEdit ? 'Updated' : 'Added'} staff ${data.name} (${data.role})`, memberUid);
    return memberUid;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function saveCustomRole(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    name: string;
    baseRole?: string;
    description?: string;
    permissions: RolePermissionMap;
  }
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('rol');
  const path = `organizations/${org.id}/roles/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'roles', docId), {
        name: clampStr(data.name, 80),
        baseRole: clampStr(data.baseRole, 40),
        description: clampStr(data.description, 240),
        permissions: data.permissions,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'roles', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        name: clampStr(data.name, 80),
        baseRole: clampStr(data.baseRole || 'receptionist', 40),
        description: clampStr(data.description, 240),
        permissions: data.permissions,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await logAudit(org, actor, 'SAVE_ROLE', 'staff', `Configured custom role ${data.name}`, docId);
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function saveBranch(
  org: Organization,
  actor: TenantActor,
  data: {
    id?: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    managerName?: string;
    isMain?: boolean;
    status: 'active' | 'inactive';
  }
) {
  const isEdit = Boolean(data.id);
  const docId = data.id || makeDocId('brn');
  const path = `organizations/${org.id}/branches/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'organizations', org.id, 'branches', docId), {
        name: clampStr(data.name, 120),
        code: clampStr(data.code, 32),
        address: clampStr(data.address, 260),
        phone: clampStr(data.phone, 32),
        managerName: clampStr(data.managerName, 100),
        isMain: Boolean(data.isMain),
        status: data.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'organizations', org.id, 'branches', docId), {
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        name: clampStr(data.name, 120),
        code: clampStr(data.code, 32),
        address: clampStr(data.address, 260),
        phone: clampStr(data.phone, 32),
        managerName: clampStr(data.managerName, 100),
        isMain: Boolean(data.isMain),
        status: data.status || 'active',
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return docId;
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function queueNotification(
  org: Organization,
  actor: TenantActor,
  data: {
    type: string;
    channel: 'in_app' | 'email' | 'sms' | 'whatsapp';
    recipientName: string;
    recipientContact?: string;
    language: 'en' | 'bn';
    message: string;
  }
) {
  const docId = makeDocId('ntf');
  const path = `organizations/${org.id}/notifications/${docId}`;
  // Never falsely claim third-party SMS/WhatsApp/Email delivery when provider isn't wired
  const deliveryStatus = data.channel === 'in_app' ? 'sent' : 'test_simulated';
  try {
    await setDoc(doc(db, 'organizations', org.id, 'notifications', docId), {
      organizationId: org.id,
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids,
      type: clampStr(data.type, 60),
      channel: data.channel,
      recipientName: clampStr(data.recipientName, 120),
      recipientContact: clampStr(data.recipientContact, 120),
      language: data.language,
      message: clampStr(data.message, 800),
      deliveryStatus,
      read: false,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ============================================================================
// SUPER ADMIN OPERATIONS
// ============================================================================
export async function saveSubscriptionPlan(
  plan: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
) {
  const isEdit = Boolean(plan.id);
  const docId = plan.id || makeDocId('pln');
  const path = `subscriptionPlans/${docId}`;
  try {
    if (isEdit) {
      await updateDoc(doc(db, 'subscriptionPlans', docId), {
        name: clampStr(plan.name, 80),
        audience: clampStr(plan.audience, 120),
        monthlyPrice: Math.max(0, Number(plan.monthlyPrice || 0)),
        yearlyPrice: Math.max(0, Number(plan.yearlyPrice || 0)),
        currency: clampStr(plan.currency || 'BDT', 10),
        trialDays: Math.max(0, Number(plan.trialDays || 14)),
        doctorLimit: Math.max(1, Number(plan.doctorLimit || 1)),
        patientLimit: Math.max(1, Number(plan.patientLimit || 500)),
        userLimit: Math.max(1, Number(plan.userLimit || 5)),
        branchLimit: Math.max(1, Number(plan.branchLimit || 1)),
        storageGb: Math.max(1, Number(plan.storageGb || 5)),
        modules: (plan.modules || []).slice(0, 20),
        isPublic: Boolean(plan.isPublic),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'subscriptionPlans', docId), {
        name: clampStr(plan.name, 80),
        code: plan.code,
        audience: clampStr(plan.audience, 120),
        monthlyPrice: Math.max(0, Number(plan.monthlyPrice || 0)),
        yearlyPrice: Math.max(0, Number(plan.yearlyPrice || 0)),
        currency: clampStr(plan.currency || 'BDT', 10),
        trialDays: Math.max(0, Number(plan.trialDays || 14)),
        doctorLimit: Math.max(1, Number(plan.doctorLimit || 1)),
        patientLimit: Math.max(1, Number(plan.patientLimit || 500)),
        userLimit: Math.max(1, Number(plan.userLimit || 5)),
        branchLimit: Math.max(1, Number(plan.branchLimit || 1)),
        storageGb: Math.max(1, Number(plan.storageGb || 5)),
        modules: (plan.modules || []).slice(0, 20),
        isPublic: Boolean(plan.isPublic),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function createPlatformTransaction(data: {
  organizationId: string;
  organizationName: string;
  ownerUid: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  method: string;
  reference: string;
  status: 'pending' | 'approved' | 'refunded' | 'overdue';
}) {
  const txId = makeDocId('tx');
  const path = `transactions/${txId}`;
  try {
    await setDoc(doc(db, 'transactions', txId), {
      organizationId: clampStr(data.organizationId, 128),
      organizationName: clampStr(data.organizationName, 140),
      ownerUid: clampStr(data.ownerUid, 128),
      planId: clampStr(data.planId, 80),
      planName: clampStr(data.planName, 80),
      billingCycle: data.billingCycle,
      amount: Math.max(0, Number(data.amount || 0)),
      currency: clampStr(data.currency || 'BDT', 10),
      method: clampStr(data.method, 40),
      reference: clampStr(data.reference, 100),
      status: data.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTransactionStatus(txId: string, status: 'pending' | 'approved' | 'refunded' | 'overdue') {
  const path = `transactions/${txId}`;
  try {
    await updateDoc(doc(db, 'transactions', txId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function savePlatformSettings(data: {
  platformName: string;
  contactEmail: string;
  contactPhone: string;
  defaultCurrency: string;
  defaultLanguage: 'en' | 'bn';
  smsProviderMode: 'disabled' | 'test_mode' | 'configured';
  whatsappProviderMode: 'disabled' | 'test_mode' | 'configured';
  paymentGatewayMode: 'manual' | 'test_mode' | 'configured';
  maintenanceMode: boolean;
}) {
  const path = 'platformSettings/global';
  try {
    await setDoc(doc(db, 'platformSettings', 'global'), {
      platformName: clampStr(data.platformName, 100),
      contactEmail: clampStr(data.contactEmail, 160),
      contactPhone: clampStr(data.contactPhone, 32),
      defaultCurrency: clampStr(data.defaultCurrency, 10),
      defaultLanguage: data.defaultLanguage,
      smsProviderMode: data.smsProviderMode,
      whatsappProviderMode: data.whatsappProviderMode,
      paymentGatewayMode: data.paymentGatewayMode,
      maintenanceMode: Boolean(data.maintenanceMode),
      isPublic: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedDefaultSubscriptionPlans() {
  const defaults: Array<Omit<SubscriptionPlan, 'createdAt' | 'updatedAt'>> = [
    {
      id: 'starter',
      name: 'Starter',
      code: 'starter',
      audience: 'Solo chambers & early practices',
      monthlyPrice: 29,
      yearlyPrice: 290,
      currency: 'USD',
      trialDays: 14,
      doctorLimit: 1,
      patientLimit: 500,
      userLimit: 3,
      branchLimit: 1,
      storageGb: 5,
      modules: ['patients', 'appointments', 'doctors'],
      isPublic: true,
    },
    {
      id: 'professional',
      name: 'Professional',
      code: 'professional',
      audience: 'Growing clinics & diagnostic centers',
      monthlyPrice: 79,
      yearlyPrice: 790,
      currency: 'USD',
      trialDays: 14,
      doctorLimit: 5,
      patientLimit: 5000,
      userLimit: 15,
      branchLimit: 2,
      storageGb: 25,
      modules: ['patients', 'appointments', 'doctors', 'prescriptions', 'laboratory', 'billing', 'reports'],
      isPublic: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      code: 'enterprise',
      audience: 'Multi-branch hospitals & networks',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      currency: 'USD',
      trialDays: 30,
      doctorLimit: 100,
      patientLimit: 100000,
      userLimit: 200,
      branchLimit: 25,
      storageGb: 250,
      modules: ['patients', 'appointments', 'doctors', 'prescriptions', 'laboratory', 'billing', 'pharmacy', 'beds', 'branches', 'reports'],
      isPublic: true,
    },
  ];
  for (const plan of defaults) {
    const existingSnap = await getDoc(doc(db, 'subscriptionPlans', plan.id));
    if (!existingSnap.exists()) {
      await setDoc(doc(db, 'subscriptionPlans', plan.id), {
        ...plan,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
}

// ============================================================================
// EXPLICIT TEST-MODE SAMPLE DATA SEEDER (Only triggered by user click)
// ============================================================================
export async function seedSampleClinicData(org: Organization, actor: TenantActor) {
  const today = todayISO();
  const d1 = await saveDoctor(
    org,
    actor,
    {
      name: 'Dr. Mahmudul Hasan',
      specialization: 'General Medicine',
      discipline: 'Allopathic',
      qualifications: 'MBBS, FCPS (Medicine)',
      registrationLabel: 'BMDC Reg. No.',
      registrationNumber: 'A-48291',
      phone: '+8801711223344',
      email: 'mahmudul@clinic.example',
      chamberInfo: 'Room 201, Level 2',
      consultationFee: 800,
      followUpFee: 500,
      experienceYears: 11,
      slotDurationMinutes: 15,
      availableDays: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
      morningShift: '09:00-13:00',
      eveningShift: '17:00-21:00',
      breakTime: '13:00-14:00',
      leaveDates: [],
      emergencyAvailable: true,
      status: 'active',
    },
    1
  );

  const d2 = await saveDoctor(
    org,
    actor,
    {
      name: 'Dr. Farzana Rahman',
      specialization: 'Cardiology',
      discipline: 'Allopathic',
      qualifications: 'MBBS, MD (Cardiology)',
      registrationLabel: 'BMDC Reg. No.',
      registrationNumber: 'A-51904',
      phone: '+8801819334455',
      email: 'farzana@clinic.example',
      chamberInfo: 'Room 204, Cardiac Wing',
      consultationFee: 1200,
      followUpFee: 700,
      experienceYears: 9,
      slotDurationMinutes: 20,
      availableDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
      morningShift: '10:00-13:00',
      eveningShift: '18:00-21:00',
      breakTime: '13:00-14:00',
      leaveDates: [],
      emergencyAvailable: false,
      status: 'active',
    },
    2
  );

  const d3 = await saveDoctor(
    org,
    actor,
    {
      name: 'Dr. Kamrul Islam',
      specialization: 'Homeopathy',
      discipline: 'Homeopathic',
      qualifications: 'BHMS (DU), DHMS',
      registrationLabel: 'BHMS / Homeo Reg. No.',
      registrationNumber: 'H-22048',
      phone: '+8801911445566',
      email: 'kamrul@clinic.example',
      chamberInfo: 'Room 105, Ground Floor',
      consultationFee: 500,
      followUpFee: 300,
      experienceYears: 14,
      slotDurationMinutes: 20,
      availableDays: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
      morningShift: '09:30-12:30',
      eveningShift: '16:30-20:30',
      breakTime: '13:00-14:00',
      leaveDates: [],
      emergencyAvailable: false,
      status: 'active',
    },
    3
  );

  const p1 = await savePatient(
    org,
    actor,
    {
      name: 'Md. Tariqul Islam',
      gender: 'male',
      dob: '1984-05-12',
      age: 42,
      bloodGroup: 'B+',
      phone: '+8801712889900',
      email: 'tariqul@example.com',
      address: 'House 14, Road 7, Dhanmondi, Dhaka',
      emergencyContact: 'Salma Begum (+8801712889901)',
      guardianName: 'Abdur Rashid',
      medicalHistory: 'Mild hypertension since 2022',
      allergies: 'None known',
      existingDiseases: 'Hypertension',
      assignedDoctorId: d2,
      assignedDoctorName: 'Dr. Farzana Rahman',
      patientAuthUid: actor.uid, // linked so Clinic Owner can immediately preview Patient Portal
      notes: 'Regular quarterly BP & Lipid checkup.',
      status: 'active',
    },
    1
  );

  const p2 = await savePatient(
    org,
    actor,
    {
      name: 'Nusrat Jahan',
      gender: 'female',
      dob: '1996-11-03',
      age: 30,
      bloodGroup: 'O+',
      phone: '+8801674221199',
      email: 'nusrat@example.com',
      address: 'Sector 4, Uttara, Dhaka',
      emergencyContact: 'Mehedi Hasan (+8801674221198)',
      guardianName: 'Mehedi Hasan',
      medicalHistory: 'Seasonal allergic rhinitis',
      allergies: 'Dust, Penicillin',
      existingDiseases: 'Allergic Rhinitis',
      assignedDoctorId: d1,
      assignedDoctorName: 'Dr. Mahmudul Hasan',
      notes: 'Prefers evening consultations.',
      status: 'active',
    },
    2
  );

  const p3 = await savePatient(
    org,
    actor,
    {
      name: 'Abul Kalam Azad',
      gender: 'male',
      dob: '1968-02-19',
      age: 58,
      bloodGroup: 'A+',
      phone: '+8801552339944',
      email: 'azad@example.com',
      address: 'Mirpur 10, Dhaka',
      emergencyContact: 'Rafiq Azad (+8801552339945)',
      guardianName: 'Late Abdul Karim',
      medicalHistory: 'Type 2 Diabetes Mellitus (managed on oral medication)',
      allergies: 'Sulfa drugs',
      existingDiseases: 'Type 2 Diabetes',
      assignedDoctorId: d1,
      assignedDoctorName: 'Dr. Mahmudul Hasan',
      notes: 'Requires HbA1c review every 3 months.',
      status: 'active',
    },
    3
  );

  const apt1 = await createAppointment(
    org,
    actor,
    {
      patientId: p1,
      patientName: 'Md. Tariqul Islam',
      patientPhone: '+8801712889900',
      patientAuthUid: actor.uid,
      doctorId: d2,
      doctorName: 'Dr. Farzana Rahman',
      date: today,
      timeSlot: '10:00 AM',
      type: 'follow_up',
      consultationFee: 700,
      status: 'completed',
      paymentStatus: 'paid',
      notes: 'Routine BP evaluation and ECG review',
      followUpDate: '2026-12-15',
      followUpReason: 'Lipid profile & BP review',
      queueToken: 1,
    },
    1
  );

  await createAppointment(
    org,
    actor,
    {
      patientId: p2,
      patientName: 'Nusrat Jahan',
      patientPhone: '+8801674221199',
      doctorId: d1,
      doctorName: 'Dr. Mahmudul Hasan',
      date: today,
      timeSlot: '09:30 AM',
      type: 'new',
      consultationFee: 800,
      status: 'checked_in',
      paymentStatus: 'paid',
      notes: 'Persistent cough and low-grade fever for 4 days',
      queueToken: 2,
    },
    2
  );

  await createAppointment(
    org,
    actor,
    {
      patientId: p3,
      patientName: 'Abul Kalam Azad',
      patientPhone: '+8801552339944',
      doctorId: d3,
      doctorName: 'Dr. Kamrul Islam',
      date: today,
      timeSlot: '05:00 PM',
      type: 'follow_up',
      consultationFee: 300,
      status: 'confirmed',
      paymentStatus: 'unpaid',
      notes: 'Joint stiffness follow-up',
      followUpDate: '2026-12-07',
      followUpReason: 'Evaluate homeopathic regimen response',
      queueToken: 3,
    },
    3
  );

  await savePrescription(
    org,
    actor,
    {
      appointmentId: apt1,
      patientId: p1,
      patientName: 'Md. Tariqul Islam',
      patientCode: 'PAT-1001',
      patientAge: 42,
      patientGender: 'male',
      patientAuthUid: actor.uid,
      doctorId: d2,
      doctorName: 'Dr. Farzana Rahman',
      doctorQualifications: 'MBBS, MD (Cardiology)',
      doctorRegistration: 'BMDC Reg. No.: A-51904',
      templateType: 'general_a4',
      vitals: { weight: '74 kg', bp: '132/84 mmHg', pulse: '76 bpm', temperature: '98.4 °F' },
      chiefComplaints: 'Occasional morning headache, routine hypertension review.',
      clinicalFindings: 'S1+S2 audible, no murmur. Chest clear.',
      diagnosis: 'Essential Hypertension (Controlled)',
      investigationAdvice: 'Fasting Lipid Profile, Serum Creatinine, ECG',
      treatmentPlan: 'Low-sodium diet, 30 min brisk walking daily. Monitor BP twice weekly.',
      medicines: [
        {
          name: 'Osartil 50mg',
          genericName: 'Losartan Potassium',
          dosage: '50mg',
          route: 'Oral',
          frequency: '1+0+0',
          duration: '30 days',
          quantity: '30 tabs',
          instructions: 'After breakfast',
        },
        {
          name: 'Atova 10mg',
          genericName: 'Atorvastatin',
          dosage: '10mg',
          route: 'Oral',
          frequency: '0+0+1',
          duration: '30 days',
          quantity: '30 tabs',
          instructions: 'After dinner',
        },
      ],
      followUpDate: '2026-12-15',
      digitalSignature: 'Dr. Farzana Rahman',
      status: 'finalized',
    },
    1
  );

  const t1 = await saveLabTest(org, actor, {
    code: 'CBC',
    name: 'Complete Blood Count (CBC)',
    category: 'Hematology',
    price: 550,
    sampleType: 'Whole Blood (EDTA)',
    preparation: 'No fasting required',
    referenceRange: 'Hb 13.0 - 17.0',
    unit: 'g/dL',
    description: 'Comprehensive blood cell analysis including Hb, WBC, RBC, Platelets.',
    status: 'active',
  });

  const t2 = await saveLabTest(org, actor, {
    code: 'LIPID',
    name: 'Fasting Lipid Profile',
    category: 'Biochemistry',
    price: 1200,
    sampleType: 'Serum',
    preparation: '10-12 hours overnight fasting required',
    referenceRange: '< 200',
    unit: 'mg/dL',
    description: 'Total Cholesterol, HDL, LDL, and Triglycerides.',
    status: 'active',
  });

  await saveLabTest(org, actor, {
    code: 'HBA1C',
    name: 'HbA1c (Glycated Hemoglobin)',
    category: 'Endocrinology',
    price: 950,
    sampleType: 'Whole Blood (EDTA)',
    preparation: 'No fasting required',
    referenceRange: '4.0 - 5.6',
    unit: '%',
    description: '3-month average blood glucose indicator.',
    status: 'active',
  });

  const labOrder1 = await createLabOrder(
    org,
    actor,
    {
      patientId: p1,
      patientName: 'Md. Tariqul Islam',
      patientCode: 'PAT-1001',
      patientAuthUid: actor.uid,
      referringDoctorId: d2,
      referringDoctorName: 'Dr. Farzana Rahman',
      tests: [
        {
          testId: t1,
          code: 'CBC',
          name: 'Complete Blood Count (CBC)',
          price: 550,
          referenceRange: 'Hb 13.0 - 17.0',
          unit: 'g/dL',
          resultValue: '14.6',
          isAbnormal: false,
          remarks: 'Within normal limits',
        },
        {
          testId: t2,
          code: 'LIPID',
          name: 'Fasting Lipid Profile',
          price: 1200,
          referenceRange: '< 200',
          unit: 'mg/dL',
          resultValue: '218',
          isAbnormal: true,
          remarks: 'Borderline elevated total cholesterol',
        },
      ],
      totalPrice: 1750,
    },
    1
  );

  await updateLabOrderResults(org, actor, labOrder1, {
    status: 'verified',
    technicianName: 'Sajib Ahmed, BSc MLT',
    verifiedByName: 'Dr. Farzana Rahman',
    verifiedAt: new Date().toISOString(),
    history: [
      { action: 'Order Created', by: actor.name, at: new Date().toISOString() },
      { action: 'Results Verified & Approved', by: 'Dr. Farzana Rahman', at: new Date().toISOString() },
    ],
  });

  await createInvoice(
    org,
    actor,
    {
      patientId: p1,
      patientName: 'Md. Tariqul Islam',
      patientCode: 'PAT-1001',
      patientAuthUid: actor.uid,
      items: [
        { category: 'consultation', description: 'Cardiology Follow-Up — Dr. Farzana Rahman', qty: 1, unitPrice: 700, total: 700 },
        { category: 'lab', description: 'CBC + Fasting Lipid Profile', qty: 1, unitPrice: 1750, total: 1750 },
      ],
      discount: 150,
      taxRate: 0,
      initialPayment: {
        id: makeDocId('pay'),
        amount: 2300,
        method: 'bkash',
        reference: 'BKS-983241',
        paidAt: new Date().toISOString(),
        recordedBy: actor.name,
      },
    },
    1
  );

  await createInvoice(
    org,
    actor,
    {
      patientId: p2,
      patientName: 'Nusrat Jahan',
      patientCode: 'PAT-1002',
      items: [
        { category: 'consultation', description: 'General Medicine Consultation — Dr. Mahmudul Hasan', qty: 1, unitPrice: 800, total: 800 },
        { category: 'lab', description: 'Complete Blood Count (CBC)', qty: 1, unitPrice: 550, total: 550 },
      ],
      discount: 0,
      taxRate: 0,
      initialPayment: {
        id: makeDocId('pay'),
        amount: 800,
        method: 'cash',
        reference: 'CASH-RCV',
        paidAt: new Date().toISOString(),
        recordedBy: actor.name,
      },
    },
    2
  );

  await createExpense(org, actor, {
    title: 'Hematology Reagent Refill Kit',
    category: 'Lab Supplies',
    amount: 4200,
    date: today,
    paymentMethod: 'bank_transfer',
    vendor: 'BioMed Diagnostics BD',
    notes: 'Monthly lab analyzer reagent purchase',
  });

  await savePharmacyItem(org, actor, {
    brandName: 'Napa 500mg',
    genericName: 'Paracetamol',
    manufacturer: 'Beximco Pharma',
    batchNumber: 'NP-2604',
    barcode: '8941100105001',
    supplierName: 'Dhaka Pharma Distributors',
    purchasePrice: 0.9,
    sellingPrice: 1.2,
    stockQty: 420,
    reorderLevel: 100,
    expiryDate: '2028-06-30',
    status: 'active',
  });

  await savePharmacyItem(org, actor, {
    brandName: 'Seclo 20mg',
    genericName: 'Omeprazole',
    manufacturer: 'Square Pharmaceuticals',
    batchNumber: 'SC-2511',
    barcode: '8941100202004',
    supplierName: 'Square Depot',
    purchasePrice: 4.5,
    sellingPrice: 6,
    stockQty: 28,
    reorderLevel: 50,
    expiryDate: '2027-02-15',
    status: 'active',
  });

  await saveBed(org, actor, {
    wardName: 'General Observation Ward',
    roomNumber: '101',
    bedNumber: 'GW-01',
    type: 'general_ward',
    dailyRate: 1500,
    status: 'available',
  });

  await saveBed(org, actor, {
    wardName: 'Private Cabin Wing',
    roomNumber: '302',
    bedNumber: 'VIP-02',
    type: 'vip_cabin',
    dailyRate: 5500,
    status: 'occupied',
    currentPatientId: p3,
    currentPatientName: 'Abul Kalam Azad',
    admittedAt: today,
    attendingDoctorName: 'Dr. Mahmudul Hasan',
    nursingNotes: 'Monitoring blood glucose every 6 hours. Vitals stable.',
  });

  await saveStaffMember(
    org,
    actor,
    {
      name: 'Tasnim Akter',
      email: 'tasnim@clinic.example',
      phone: '+8801715556677',
      role: 'receptionist',
      department: 'Front Desk',
      designation: 'Senior Receptionist',
      salary: 22000,
      joiningDate: '2025-03-01',
      shift: 'Morning (08:30-16:30)',
      attendanceStatus: 'present',
      status: 'active',
    },
    2
  );

  await saveStaffMember(
    org,
    actor,
    {
      name: 'Sajib Ahmed',
      email: 'sajib@clinic.example',
      phone: '+8801815556688',
      role: 'lab_technician',
      department: 'Diagnostics',
      designation: 'Senior Lab Technologist',
      salary: 28000,
      joiningDate: '2024-11-15',
      shift: 'Morning (08:00-16:00)',
      attendanceStatus: 'present',
      status: 'active',
    },
    3
  );
}

// ============================================================================
// ZERO-TRUST VERIFIED STAFF INVITATIONS & ACCESS SYNC
// ============================================================================
export async function createStaffInvite(
  org: Organization,
  actor: TenantActor,
  data: {
    invitedEmail: string;
    invitedName: string;
    role: Exclude<StaffRole, 'clinic_owner'>;
    department?: string;
    designation?: string;
    branchId?: string;
  }
) {
  const emailNorm = clampStr(data.invitedEmail, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw new Error('Please enter a valid email address for the staff invite.');
  }
  const inviteId = makeDocId('inv');
  const inviteCode = makeInviteCode();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  const expiresAt = expires.toISOString().slice(0, 10);
  const path = `staffInvites/${inviteId}`;
  try {
    await setDoc(doc(db, 'staffInvites', inviteId), {
      organizationId: org.id,
      organizationName: clampStr(org.name, 140),
      ownerUid: org.ownerUid,
      authorizedUids: org.authorizedUids.slice(0, 50),
      invitedEmail: emailNorm,
      invitedName: clampStr(data.invitedName, 120),
      role: data.role,
      department: clampStr(data.department, 80),
      designation: clampStr(data.designation, 80),
      branchId: clampStr(data.branchId, 128),
      inviteCode,
      status: 'pending',
      expiresAt,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      org,
      actor,
      'CREATE_STAFF_INVITE',
      'staff',
      `Invited ${data.invitedName} (${emailNorm}) as ${data.role}`,
      inviteId
    );
    return { inviteId, inviteCode };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeStaffInvite(org: Organization, actor: TenantActor, inviteId: string) {
  const path = `staffInvites/${inviteId}`;
  try {
    await updateDoc(doc(db, 'staffInvites', inviteId), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
    await logAudit(org, actor, 'REVOKE_STAFF_INVITE', 'staff', `Revoked staff invitation ${inviteId}`, inviteId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function acceptStaffInvite(
  invite: StaffInvite,
  user: { uid: string; email: string | null; displayName: string | null }
) {
  const path = `staffInvites/${invite.id}`;
  const memberAuthorizedUids = Array.from(new Set([invite.ownerUid, ...invite.authorizedUids, user.uid])).slice(0, 50);
  try {
    const batch = writeBatch(db);
    // 1. Atomically create the verified user's membership doc with exact invited role
    batch.set(doc(db, 'organizations', invite.organizationId, 'members', user.uid), {
      organizationId: invite.organizationId,
      ownerUid: invite.ownerUid,
      authorizedUids: memberAuthorizedUids,
      uid: user.uid,
      staffCode: makeCode('STF'),
      name: clampStr(user.displayName || invite.invitedName, 120),
      email: clampStr((user.email || invite.invitedEmail).toLowerCase(), 160),
      phone: '',
      role: invite.role,
      customRoleName: '',
      department: clampStr(invite.department, 80),
      designation: clampStr(invite.designation, 80),
      branchId: clampStr(invite.branchId, 128),
      salary: 0,
      joiningDate: todayISO(),
      shift: 'Full Day',
      attendanceStatus: 'present',
      status: 'active',
      inviteId: invite.id,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Atomically append ONLY caller's UID to the organization's authorizedUids
    batch.update(doc(db, 'organizations', invite.organizationId), {
      authorizedUids: arrayUnion(user.uid),
      updatedAt: serverTimestamp(),
    });

    // 3. Atomically transition invite status pending -> accepted
    batch.update(doc(db, 'staffInvites', invite.id), {
      status: 'accepted',
      acceptedByUid: user.uid,
      acceptedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await updateUserPrefs(user.uid, { activeOrgId: invite.organizationId });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

const SYNCABLE_TENANT_COLLECTIONS = [
  'members',
  'roles',
  'branches',
  'patients',
  'doctors',
  'appointments',
  'prescriptions',
  'labTests',
  'labOrders',
  'invoices',
  'expenses',
  'pharmacyInventory',
  'beds',
  'notifications',
] as const;

export async function syncClinicTeamAccess(
  org: Organization,
  actor: TenantActor,
  overrideUids?: string[]
): Promise<number> {
  const targetUids = Array.from(new Set([org.ownerUid, ...(overrideUids || org.authorizedUids)])).slice(0, 50);
  let updatedCount = 0;

  try {
    let batch = writeBatch(db);
    let opCount = 0;

    for (const subcol of SYNCABLE_TENANT_COLLECTIONS) {
      const q = query(
        collection(db, 'organizations', org.id, subcol),
        where('authorizedUids', 'array-contains', actor.uid)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const current = (d.data().authorizedUids as string[] | undefined) || [];
        const same = current.length === targetUids.length && targetUids.every((u) => current.includes(u));
        if (!same) {
          batch.update(d.ref, {
            authorizedUids: targetUids,
            updatedAt: serverTimestamp(),
          });
          opCount++;
          updatedCount++;
          if (opCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
          }
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    await logAudit(
      org,
      actor,
      'SYNC_TEAM_ACCESS',
      'security',
      `Synchronized authorized team access (${targetUids.length} active UIDs) across ${updatedCount} clinic record(s)`
    );
    return updatedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `organizations/${org.id}`);
    return 0;
  }
}

export async function revokeStaffAccess(org: Organization, actor: TenantActor, member: OrganizationMember) {
  if (member.uid === org.ownerUid || member.role === 'clinic_owner') {
    throw new Error('Clinic owner access cannot be revoked.');
  }
  const path = `organizations/${org.id}/members/${member.uid}`;
  const nextUids = Array.from(new Set([org.ownerUid, ...org.authorizedUids.filter((u) => u !== member.uid)])).slice(0, 50);
  try {
    await updateDoc(doc(db, 'organizations', org.id, 'members', member.uid), {
      status: 'inactive',
      authorizedUids: nextUids,
      updatedAt: serverTimestamp(),
    });
    if (org.ownerUid === actor.uid && org.authorizedUids.includes(member.uid)) {
      await updateDoc(doc(db, 'organizations', org.id), {
        authorizedUids: nextUids,
        updatedAt: serverTimestamp(),
      });
    }
    await syncClinicTeamAccess({ ...org, authorizedUids: nextUids }, actor, nextUids);
    await logAudit(
      { ...org, authorizedUids: nextUids },
      actor,
      'REVOKE_STAFF_ACCESS',
      'security',
      `Revoked clinic access for ${member.name} (${member.role})`,
      member.uid
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
