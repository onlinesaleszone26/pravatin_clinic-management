/**
 * MediCare Pro — Firestore Security Rules Verification Suite (Dirty Dozen TDD)
 * Run against Firebase Emulator Suite:
 *   npx firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import fs from 'node:fs';

async function runSecurityTests() {
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'medicare-pro-security-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  try {
    // Seed Clinic A and Clinic B via admin bypass
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'organizations', 'clinicA'), {
        name: 'City Medical Clinic',
        slug: 'city-medical',
        type: 'clinic',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA', 'docA'],
        status: 'active',
        planId: 'professional',
        billingCycle: 'monthly',
        currency: 'BDT',
        language: 'en',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'organizations', 'clinicA', 'members', 'ownerA'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA', 'docA'],
        uid: 'ownerA',
        name: 'Dr. Owner A',
        role: 'clinic_owner',
        status: 'active',
        createdByUid: 'ownerA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'organizations', 'clinicA', 'patients', 'pat1'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA', 'docA'],
        patientCode: 'PAT-1001',
        name: 'Rahim Uddin',
        gender: 'male',
        phone: '+8801711000001',
        status: 'active',
        createdByUid: 'ownerA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'organizations', 'clinicA', 'labOrders', 'ord1'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA', 'docA'],
        orderNumber: 'LAB-1001',
        patientId: 'pat1',
        patientName: 'Rahim Uddin',
        tests: [{ code: 'CBC', name: 'Complete Blood Count', resultValue: 'Normal' }],
        totalPrice: 600,
        status: 'verified',
        history: [{ action: 'verified', at: '2026-11-23' }],
        createdByUid: 'ownerA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'organizations', 'clinicA', 'prescriptions', 'rx1'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA', 'docA'],
        rxNumber: 'RX-1001',
        patientId: 'pat1',
        patientName: 'Rahim Uddin',
        doctorId: 'doc1',
        doctorName: 'Dr. Owner A',
        templateType: 'general_a4',
        medicines: [{ name: 'Napa 500mg' }],
        status: 'finalized',
        createdByUid: 'ownerA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'organizations', 'clinicA', 'auditLogs', 'log1'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA', 'docA'],
        action: 'CREATE_PATIENT',
        module: 'patients',
        summary: 'Registered Rahim Uddin',
        actorUid: 'ownerA',
        actorName: 'Dr. Owner A',
        actorRole: 'clinic_owner',
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', 'ownerA'), {
        uid: 'ownerA',
        email: 'ownerA@clinic.com',
        displayName: 'Owner A',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const ownerA = testEnv.authenticatedContext('ownerA', { email: 'ownerA@clinic.com', email_verified: true });
    const ownerB = testEnv.authenticatedContext('ownerB', { email: 'ownerB@other.com', email_verified: true });
    const spoofedAdmin = testEnv.authenticatedContext('attacker', { email: 'admin@example.com', email_verified: false });

    // 1. Cross-Tenant Read
    await assertFails(getDoc(doc(ownerB.firestore(), 'organizations', 'clinicA', 'patients', 'pat1')));
    // 2. Cross-Tenant List
    await assertFails(getDocs(collection(ownerB.firestore(), 'organizations', 'clinicA', 'patients')));
    // 3. Shadow Field Injection
    await assertFails(
      setDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'patients', 'pat2'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA'],
        patientCode: 'PAT-1002',
        name: 'Shadow Test',
        gender: 'male',
        phone: '+8801711000002',
        status: 'active',
        isVipOverride: true,
        createdByUid: 'ownerA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 4. Identity Spoofing
    await assertFails(
      setDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'patients', 'pat3'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA'],
        patientCode: 'PAT-1003',
        name: 'Spoof Creator',
        gender: 'male',
        phone: '+8801711000003',
        status: 'active',
        createdByUid: 'someone_else',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 5. Immutable Field Mutation
    await assertFails(
      updateDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'patients', 'pat1'), {
        ownerUid: 'ownerB',
        updatedAt: serverTimestamp(),
      })
    );
    // 6. Unverified Email Spoofing
    await assertFails(
      setDoc(doc(spoofedAdmin.firestore(), 'subscriptionPlans', 'starter'), {
        name: 'Hacked',
        code: 'starter',
        monthlyPrice: 0,
        yearlyPrice: 0,
        doctorLimit: 999,
        patientLimit: 999,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 7. Path ID Poisoning
    await assertFails(
      setDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'patients', 'a'.repeat(150)), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA'],
        patientCode: 'PAT-1004',
        name: 'Long ID',
        gender: 'male',
        phone: '+8801711000004',
        status: 'active',
        createdByUid: 'ownerA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    // 8. Verified Lab Result Tampering
    await assertFails(
      updateDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'labOrders', 'ord1'), {
        tests: [{ code: 'CBC', name: 'Tampered', resultValue: 'Critical' }],
        updatedAt: serverTimestamp(),
      })
    );
    // 9. Finalized Prescription Tampering
    await assertFails(
      updateDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'prescriptions', 'rx1'), {
        medicines: [{ name: 'Tampered Drug' }],
        updatedAt: serverTimestamp(),
      })
    );
    // 10. PII Blanket Read
    await assertFails(getDoc(doc(ownerB.firestore(), 'users', 'ownerA')));
    // 11. Timestamp Forgery
    await assertFails(
      setDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'patients', 'pat5'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA'],
        patientCode: 'PAT-1005',
        name: 'Backdated',
        gender: 'male',
        phone: '+8801711000005',
        status: 'active',
        createdByUid: 'ownerA',
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'),
      })
    );
    // 12. Audit Log Deletion
    await assertFails(deleteDoc(doc(ownerA.firestore(), 'organizations', 'clinicA', 'auditLogs', 'log1')));

    // 13. Uninvited Self-Join to Organization authorizedUids
    await assertFails(
      updateDoc(doc(ownerB.firestore(), 'organizations', 'clinicA'), {
        authorizedUids: ['ownerA', 'docA', 'ownerB'],
        updatedAt: serverTimestamp(),
      })
    );

    // 14. Creating Staff Invite with Clinic Owner Role (Privilege Escalation Blocked)
    await assertFails(
      setDoc(doc(ownerA.firestore(), 'staffInvites', 'inv_bad_owner'), {
        organizationId: 'clinicA',
        organizationName: 'City Medical Clinic',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA'],
        invitedEmail: 'newuser@clinic.com',
        invitedName: 'Escalated Owner',
        role: 'clinic_owner',
        inviteCode: 'ABCD1234EFGH',
        status: 'pending',
        expiresAt: '2026-12-31',
        createdByUid: 'ownerA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // 15. Uninvited User Creating Membership with Forged Invite ID
    await assertFails(
      setDoc(doc(ownerB.firestore(), 'organizations', 'clinicA', 'members', 'ownerB'), {
        organizationId: 'clinicA',
        ownerUid: 'ownerA',
        authorizedUids: ['ownerA', 'ownerB'],
        uid: 'ownerB',
        name: 'Forged Join',
        role: 'clinic_admin',
        inviteId: 'nonexistent_invite',
        status: 'active',
        createdByUid: 'ownerB',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Positive sanity check: Clinic Owner A can list own tenant patients
    await assertSucceeds(
      getDocs(
        query(
          collection(ownerA.firestore(), 'organizations', 'clinicA', 'patients'),
          where('authorizedUids', 'array-contains', 'ownerA')
        )
      )
    );

    console.log('All 15 adversarial security assertions + positive tenant check passed.');
  } finally {
    await testEnv.cleanup();
  }
}

runSecurityTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
