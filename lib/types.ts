export type CurrencyCode = 'USD' | 'EUR' | 'BDT';
export type LanguageCode = 'en' | 'bn';
export type ThemeMode = 'light' | 'dark';

export type OrganizationType = 'clinic' | 'diagnostic' | 'hospital' | 'chamber';
export type OrganizationStatus = 'active' | 'trial' | 'suspended';

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

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  ownerUid: string;
  authorizedUids: string[];
  status: OrganizationStatus;
  planId: string;
  billingCycle?: 'monthly' | 'yearly';
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency: CurrencyCode;
  timezone?: string;
  language: LanguageCode;
  prescriptionHeader?: string;
  prescriptionFooter?: string;
  invoiceFooter?: string;
  enablePharmacy?: boolean;
  enableInpatient?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDocument {
  id: string;
  organizationId: string;
  ownerUid: string;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember extends TenantDocument {
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
  createdAt: string;
  updatedAt: string;
}

export interface Branch extends TenantDocument {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  managerName?: string;
  isMain?: boolean;
  status: 'active' | 'inactive';
}

export interface Patient extends TenantDocument {
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

export interface Doctor extends TenantDocument {
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

export interface Appointment extends TenantDocument {
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

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionVitals {
  bp?: string;
  pulse?: string;
  temp?: string;
  weight?: string;
  spo2?: string;
}

export interface Prescription extends TenantDocument {
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
  medicines: PrescriptionMedicine[];
  followUpDate?: string;
  digitalSignature?: string;
  status: 'draft' | 'finalized';
}

export interface LabTest extends TenantDocument {
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

export interface LabOrderTestItem {
  testId: string;
  code: string;
  name: string;
  price: number;
  resultValue?: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical';
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

export interface LabOrder extends TenantDocument {
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
  history: { action: string; by: string; at: string }[];
}

export interface InvoiceItem {
  description: string;
  category: 'consultation' | 'lab' | 'pharmacy' | 'bed' | 'other';
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePayment {
  amount: number;
  method: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank';
  reference?: string;
  paidAt: string;
}

export interface Invoice extends TenantDocument {
  patientAuthUid?: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientCode?: string;
  branchId?: string;
  items: InvoiceItem[];
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

export interface Expense extends TenantDocument {
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  vendor?: string;
  branchId?: string;
  notes?: string;
}

export interface PharmacyItem extends TenantDocument {
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

export interface PharmacySale {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerType: 'registered' | 'walk_in';
  patientId?: string;
  prescriptionId?: string;
  items: { itemId: string; brandName: string; genericName: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank';
  createdAt: string;
}

export interface Bed extends TenantDocument {
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
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: 'starter' | 'professional' | 'enterprise' | 'custom';
  audience?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency?: CurrencyCode;
  trialDays?: number;
  doctorLimit: number;
  patientLimit: number;
  userLimit?: number;
  branchLimit?: number;
  storageGb?: number;
  modules?: string[];
  isPublic: boolean;
}

export type ActiveModule =
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
  | 'settings'
  | 'patient_portal'
  | 'super_admin';
