import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-error';
import type { Organization, StaffInvite } from './types';

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

export async function listUserOrganizations(uid: string): Promise<Organization[]> {
  if (!isFirebaseConfigured || !db) return [];
  const path = 'organizations';
  try {
    const q = query(collection(db, path), where('authorizedUids', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Organization, 'id'>),
      createdAt: String(d.data().createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString()),
      updatedAt: String(d.data().updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString()),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, auth);
  }
}

export async function createOrganizationWithOwner(
  org: Omit<Organization, 'createdAt' | 'updatedAt'>,
  ownerDisplayName: string,
  ownerEmail: string
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const orgPath = `organizations/${org.id}`;
  const memberPath = `organizations/${org.id}/members/${org.ownerUid}`;
  try {
    const batch = writeBatch(db);
    const { id: _orgId, ...orgData } = org;
    void _orgId;
    batch.set(
      doc(db, 'organizations', org.id),
      stripUndefined({
        ...orgData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    batch.set(
      doc(db, 'organizations', org.id, 'members', org.ownerUid),
      stripUndefined({
        organizationId: org.id,
        ownerUid: org.ownerUid,
        authorizedUids: org.authorizedUids,
        uid: org.ownerUid,
        staffCode: 'STF-001',
        name: ownerDisplayName.slice(0, 120) || 'Clinic Owner',
        email: ownerEmail.slice(0, 160),
        role: 'clinic_owner',
        status: 'active',
        createdByUid: org.ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${orgPath} & ${memberPath}`, auth);
  }
}

export async function listTenantCollection<T extends { id: string }>(
  orgId: string,
  subcollection: string,
  uid: string
): Promise<T[]> {
  if (!isFirebaseConfigured || !db) return [];
  const path = `organizations/${orgId}/${subcollection}`;
  try {
    const q = query(
      collection(db, 'organizations', orgId, subcollection),
      where('authorizedUids', 'array-contains', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as DocumentData;
      return {
        ...data,
        id: d.id,
        createdAt: String(data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString()),
        updatedAt: String(data.updatedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString()),
      } as unknown as T;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, auth);
  }
}

export async function createTenantDoc(
  orgId: string,
  subcollection: string,
  docId: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `organizations/${orgId}/${subcollection}/${docId}`;
  try {
    const clean = stripUndefined(payload);
    delete clean.id;
    await setDoc(doc(db, 'organizations', orgId, subcollection, docId), {
      ...clean,
      createdAt: serverTimestamp(),
      ...(subcollection === 'auditLogs' ? {} : { updatedAt: serverTimestamp() }),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path, auth);
  }
}

export async function updateTenantDoc(
  orgId: string,
  subcollection: string,
  docId: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `organizations/${orgId}/${subcollection}/${docId}`;
  try {
    const clean = stripUndefined(patch);
    delete clean.id;
    await updateDoc(doc(db, 'organizations', orgId, subcollection, docId), {
      ...clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, auth);
  }
}

export async function deleteTenantDoc(
  orgId: string,
  subcollection: string,
  docId: string
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `organizations/${orgId}/${subcollection}/${docId}`;
  try {
    await deleteDoc(doc(db, 'organizations', orgId, subcollection, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, auth);
  }
}

export async function updateOrganizationDoc(
  orgId: string,
  patch: Record<string, unknown>
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `organizations/${orgId}`;
  try {
    const clean = stripUndefined(patch);
    delete clean.id;
    await updateDoc(doc(db, 'organizations', orgId), {
      ...clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, auth);
  }
}

export async function createStaffInviteDoc(invite: StaffInvite): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `staffInvites/${invite.id}`;
  try {
    const clean = stripUndefined(invite as unknown as Record<string, unknown>);
    delete clean.id;
    await setDoc(doc(db, 'staffInvites', invite.id), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path, auth);
  }
}

export async function acceptStaffInviteAtomic(
  invite: StaffInvite,
  userUid: string,
  displayName: string,
  currentOrgAuthorizedUids: string[]
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `staffInvites/${invite.id}`;
  try {
    const nextAuthorized = Array.from(new Set([...currentOrgAuthorizedUids, userUid]));
    const batch = writeBatch(db);
    batch.update(doc(db, 'staffInvites', invite.id), {
      status: 'accepted',
      acceptedByUid: userUid,
      acceptedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'organizations', invite.organizationId, 'members', userUid), {
      organizationId: invite.organizationId,
      ownerUid: invite.ownerUid,
      authorizedUids: nextAuthorized,
      uid: userUid,
      name: displayName.slice(0, 120),
      email: invite.invitedEmail,
      role: invite.role,
      department: invite.department ?? '',
      designation: invite.designation ?? '',
      branchId: invite.branchId ?? '',
      inviteId: invite.id,
      status: 'active',
      createdByUid: userUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'organizations', invite.organizationId), {
      authorizedUids: nextAuthorized,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, auth);
  }
}
