import { Timestamp } from 'firebase/firestore';

export type StaffRole =
  | 'clinic_owner'
  | 'clinic_admin'
  | 'doctor'
  | 'receptionist'
  | 'nurse'
  | 'lab_technician'
  | 'pharmacist'
  | 'accountant'
  | 'hr_manager'
  | 'patient';

export type ModuleKey =
  | 'dashboard'
  | 'patients'
  | 'doctors'
  | 'appointments'
  | 'prescriptions'
  | 'laboratory'
  | 'billing'
  | 'pharmacy'
  | 'beds'
  | 'staff'
  | 'branches'
  | 'notifications'
  | 'reports'
  | 'settings'
  | 'patient_portal'
  | 'super_admin';

export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type RolePermissionMap = Record<string, ModulePermission>;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  activeOrgId?: string;
  language?: 'en' | 'bn';
  theme?: 'light' | 'dark';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: 'starter' | 'professional' | 'enterprise' | 'custom';
  audience?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency?: string;
  trialDays?: number;
  doctorLimit: number;
  patientLimit: number;
  userLimit?: number;
  branchLimit?: number;
  storageGb?: number;
  modules?: string[];
  isPublic: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PlatformSetting {
  id: string;
  platformName: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultCurrency: string;
  defaultLanguage: 'en' | 'bn';
  smsProviderMode?: 'disabled' | 'test_mode' | 'configured';
  whatsappProviderMode?: 'disabled' | 'test_mode' | 'configured';
  paymentGatewayMode?: 'manual' | 'test_mode' | 'configured';
  maintenanceMode: boolean;
  isPublic: boolean;
  updatedAt?: Timestamp;
}

export interface PlatformTransaction {
  id: string;
  organizationId: string;
  organizationName: string;
  ownerUid: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  method?: string;
  reference?: string;
  status: 'pending' | 'approved' | 'refunded' | 'overdue';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'clinic' | 'diagnostic' | 'hospital' | 'chamber';
  ownerUid: string;
  authorizedUids: string[];
  status: 'active' | 'trial' | 'suspended';
  planId: string;
  billingCycle?: 'monthly' | 'yearly';
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency: 'BDT' | 'USD' | 'EUR';
  timezone?: string;
  language: 'en' | 'bn';
  prescriptionHeader?: string;
  prescriptionFooter?: string;
  invoiceFooter?: string;
  enablePharmacy?: boolean;
  enableInpatient?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TenantBase {
  id: string;
  organizationId: string;
  ownerUid: string;
  authorizedUids: string[];
  createdByUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrganizationMember extends TenantBase {
  uid: string;
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
  inviteId?: string;
}

export interface StaffInvite {
  id: string;
  organizationId: string;
  organizationName: string;
  ownerUid: string;
  authorizedUids: string[];
  invitedEmail: string;
  invitedName: string;
  role: Exclude<StaffRole, 'clinic_owner'>;
  department?: string;
  designation?: string;
  branchId?: string;
  inviteCode: string;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
  acceptedByUid?: string;
  acceptedAt?: string;
  createdByUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CustomRole extends TenantBase {
  name: string;
  baseRole?: string;
  description?: string;
  permissions: RolePermissionMap;
}

export interface Branch extends TenantBase {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  managerName?: string;
  isMain?: boolean;
  status: 'active' | 'inactive';
}

export interface Patient extends TenantBase {
  patientAuthUid?: string;
  patientCode: string;
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
}

export interface Doctor extends TenantBase {
  doctorCode: string;
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
  availableDays?: string[];
  morningShift?: string;
  eveningShift?: string;
  breakTime?: string;
  leaveDates?: string[];
  emergencyAvailable?: boolean;
  status: 'active' | 'on_leave' | 'inactive';
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment extends TenantBase {
  patientAuthUid?: string;
  appointmentNumber: string;
  queueToken: number;
  patientId: string;
  patientName: string;
  patientPhone?: string;
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
}

export interface PrescribedMedicine {
  name: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

export interface PrescriptionVitals {
  weight?: string;
  bp?: string;
  pulse?: string;
  temperature?: string;
}

export interface Prescription extends TenantBase {
  patientAuthUid?: string;
  rxNumber: string;
  appointmentId?: string;
  patientId: string;
  patientName: string;
  patientCode?: string;
  patientAge?: number;
  patientGender?: string;
  doctorId: string;
  doctorName: string;
  doctorQualifications?: string;
  doctorRegistration?: string;
  templateType: 'general_a4' | 'compact' | 'homeopathy';
  vitals?: PrescriptionVitals;
  chiefComplaints?: string;
  clinicalFindings?: string;
  diagnosis?: string;
  investigationAdvice?: string;
  treatmentPlan?: string;
  medicines: PrescribedMedicine[];
  followUpDate?: string;
  digitalSignature?: string;
  status: 'draft' | 'finalized';
}

export interface LabTest extends TenantBase {
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

export type LabOrderStatus =
  | 'ordered'
  | 'sample_pending'
  | 'sample_collected'
  | 'processing'
  | 'completed'
  | 'verified'
  | 'delivered'
  | 'cancelled';

export interface LabOrderTestItem {
  testId: string;
  code: string;
  name: string;
  price: number;
  referenceRange: string;
  unit: string;
  resultValue: string;
  isAbnormal: boolean;
  remarks: string;
}

export interface LabOrderAuditEntry {
  action: string;
  by: string;
  at: string;
  note?: string;
}

export interface LabOrder extends TenantBase {
  patientAuthUid?: string;
  orderNumber: string;
  patientId: string;
  patientName: string;
  patientCode?: string;
  referringDoctorId?: string;
  referringDoctorName?: string;
  tests: LabOrderTestItem[];
  totalPrice: number;
  status: LabOrderStatus;
  technicianName?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  deliveredAt?: string;
  history: LabOrderAuditEntry[];
}

export interface InvoiceLineItem {
  category: 'consultation' | 'lab' | 'procedure' | 'pharmacy' | 'bed' | 'other';
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  method: 'cash' | 'bkash' | 'nagad' | 'card' | 'bank_transfer' | 'mobile_banking';
  reference: string;
  paidAt: string;
  recordedBy: string;
}

export interface Invoice extends TenantBase {
  patientAuthUid?: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientCode?: string;
  branchId?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  payments: InvoicePayment[];
}

export interface Expense extends TenantBase {
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  vendor?: string;
  branchId?: string;
  notes?: string;
}

export interface PharmacyItem extends TenantBase {
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

export interface Bed extends TenantBase {
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

export interface NotificationRecord extends TenantBase {
  type: string;
  channel: 'in_app' | 'email' | 'sms' | 'whatsapp';
  recipientName: string;
  recipientContact?: string;
  language: 'en' | 'bn';
  message: string;
  deliveryStatus: 'queued' | 'test_simulated' | 'sent' | 'failed';
  read: boolean;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  ownerUid: string;
  authorizedUids: string[];
  action: string;
  module: string;
  entityId?: string;
  summary: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  createdAt?: Timestamp;
}

export const DEFAULT_ROLE_MODULES: Record<StaffRole, ModuleKey[]> = {
  clinic_owner: [
    'dashboard', 'patients', 'doctors', 'appointments', 'prescriptions', 'laboratory',
    'billing', 'pharmacy', 'beds', 'staff', 'branches', 'notifications', 'reports', 'settings', 'patient_portal',
  ],
  clinic_admin: [
    'dashboard', 'patients', 'doctors', 'appointments', 'prescriptions', 'laboratory',
    'billing', 'pharmacy', 'beds', 'staff', 'branches', 'notifications', 'reports', 'settings',
  ],
  doctor: ['dashboard', 'patients', 'doctors', 'appointments', 'prescriptions', 'laboratory', 'beds', 'notifications'],
  receptionist: ['dashboard', 'patients', 'doctors', 'appointments', 'billing', 'beds', 'notifications'],
  nurse: ['dashboard', 'patients', 'appointments', 'prescriptions', 'beds', 'notifications'],
  lab_technician: ['dashboard', 'laboratory', 'notifications'],
  pharmacist: ['dashboard', 'prescriptions', 'pharmacy', 'billing', 'notifications'],
  accountant: ['dashboard', 'billing', 'reports'],
  hr_manager: ['dashboard', 'staff', 'branches', 'reports'],
  patient: ['patient_portal'],
};

export const ROLE_LABELS: Record<StaffRole, { en: string }> = {
  clinic_owner: { en: 'Clinic Owner' },
  clinic_admin: { en: 'Clinic Admin' },
  doctor: { en: 'Doctor' },
  receptionist: { en: 'Receptionist' },
  nurse: { en: 'Nurse' },
  lab_technician: { en: 'Lab Technician' },
  pharmacist: { en: 'Pharmacist' },
  accountant: { en: 'Accountant' },
  hr_manager: { en: 'HR Manager' },
  patient: { en: 'Patient' },
};
