# Pravaclin — Security Specification (Phase 0 TDD)

## 1. Core Data Invariants
1. **Strict Tenant Isolation**: Every clinical and operational document under `/organizations/{orgId}/...` must carry `organizationId == orgId`, an immutable `ownerUid`, and a bounded `authorizedUids` array (`size <= 50`). Clinic B members can never read, list, create, update, or delete Clinic A records.
2. **Master Gate Membership**: Single-document operations (`get`, `create`, `update`, `delete`) inside any organization subcollection verify active membership via `/organizations/{orgId}/members/{uid}` (or org `ownerUid` during initial bootstrap) and confirm the parent `/organizations/{orgId}` exists and is not `suspended`.
3. **Zero `get()` in `allow list`**: Every `allow list` rule evaluates `resource.data` directly against `request.auth.uid` (`ownerUid`, `authorizedUids`, or `patientAuthUid`) with zero document lookups to prevent O(n) read amplification and client-delegated query scraping.
4. **Super Admin Clinical Privacy**: Super Admin can manage `/organizations`, `/subscriptionPlans`, `/transactions`, and `/platformSettings`, but does NOT receive automatic access to clinical subcollections (`patients`, `prescriptions`, `labOrders`) unless explicitly a member of that clinic.
5. **Terminal State Locking**: Verified or delivered `labOrders` cannot have their `tests` results overwritten; finalized `prescriptions` cannot be edited clinically; `auditLogs` are append-only (no update/delete).
6. **PII Isolation**: `/users/{uid}` is strictly readable/writable only by the owning UID (or Super Admin).
7. **Temporal & Schema Integrity**: Every write requires `email_verified == true`, validates every string with `.size()`, checks `isValidId()` on single-document path variables, validates `createdAt == request.time` / `updatedAt == request.time`, and enforces strict key allowlists (`hasAll`/`hasOnly` on create, `affectedKeys().hasOnly(...)` on update).
8. **Zero-Trust Verified Staff Invitations (Pillar 7 Atomicity)**: Staff invitations under `/staffInvites/{inviteId}` bind a single verified email address to an explicit non-owner RBAC role. Accepting an invite MUST atomically (in one `writeBatch`) transition the invite `pending -> accepted`, create `/organizations/{orgId}/members/{uid}` with the exact invited role, and append `uid` to `/organizations/{orgId}.authorizedUids`.
9. **Anti-Privilege-Escalation Guard**: Non-owner admins and HR managers can never invite `clinic_owner`, promote any member to `clinic_owner`, or alter the `clinic_owner`'s own membership record.

## 2. The "Dirty Dozen" + Extended Adversarial Payloads
1. **Cross-Tenant Read**: User B (`uid_b`) attempts `get` on `/organizations/clinicA/patients/pat1`. Expected: `PERMISSION_DENIED`.
2. **Cross-Tenant Unfiltered List**: User B attempts `list` on `/organizations/clinicA/patients` without being in `authorizedUids`. Expected: `PERMISSION_DENIED`.
3. **Shadow Field Injection**: Clinic Owner attempts `create` on `patients` with extra field `isVipOverride: true`. Expected: `PERMISSION_DENIED`.
4. **Identity Spoofing**: Clinic staff attempts `create` on `patients` with `createdByUid: 'someone_else'`. Expected: `PERMISSION_DENIED`.
5. **Immutable Field Mutation**: Staff attempts `update` changing `organizationId` or `ownerUid` on an existing `appointment`. Expected: `PERMISSION_DENIED`.
6. **Unverified Email Spoofing**: Attacker with `email: 'admin@example.com'` and `email_verified: false` attempts to update `/subscriptionPlans/starter`. Expected: `PERMISSION_DENIED`.
7. **Path ID Poisoning**: Attacker attempts `create` with a 200-char junk document ID `a*200` or special characters `../admin`. Expected: `PERMISSION_DENIED`.
8. **Verified Lab Result Tampering**: Technician attempts `update` on `labOrders/ord1` (where `existing().status == 'verified'`) modifying `tests`. Expected: `PERMISSION_DENIED`.
9. **Finalized Prescription Tampering**: Doctor attempts `update` on `prescriptions/rx1` (where `existing().status == 'finalized'`) modifying `medicines`. Expected: `PERMISSION_DENIED`.
10. **PII Blanket Read**: Authenticated User B attempts `get` on `/users/uid_a`. Expected: `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Clinic Owner attempts `create` on `patients` with a backdated client timestamp instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
12. **Audit Log Deletion / Tampering**: Clinic Owner attempts `delete` or `update` on `/organizations/clinicA/auditLogs/log1`. Expected: `PERMISSION_DENIED`.
13. **Invite Role Escalation**: Invited receptionist (`docInvite`) attempts to create `/organizations/clinicA/members/userC` with `role: 'clinic_admin'` instead of the invited role `'receptionist'`. Expected: `PERMISSION_DENIED`.
14. **Uninvited Organization Self-Join**: Uninvited User B attempts to append their own UID to `/organizations/clinicA.authorizedUids`. Expected: `PERMISSION_DENIED`.
15. **Non-Owner Privilege Escalation**: Clinic Admin or HR Manager attempts to promote a member to `role: 'clinic_owner'` or alter the owner's membership. Expected: `PERMISSION_DENIED`.
