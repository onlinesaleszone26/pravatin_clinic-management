export type Lang = 'en';

export const DICT: Record<Lang, Record<string, string>> = {
  en: {
    appTitle: 'Pravaclin',
    dashboard: 'Dashboard',
    patients: 'Patients',
    doctors: 'Doctors & Schedules',
    appointments: 'Appointments',
    prescriptions: 'Prescriptions',
    laboratory: 'Laboratory',
    billing: 'Billing & Accounts',
    pharmacy: 'Pharmacy',
    beds: 'Beds & Cabins',
    staff: 'Staff & RBAC',
    branches: 'Branches',
    notifications: 'Notifications',
    reports: 'Reports & Audit',
    settings: 'Clinic Settings',
    patientPortal: 'Patient Portal',
    superAdmin: 'Super Admin',
    registerPatient: 'Register Patient',
    bookAppointment: 'Book Appointment',
    newPrescription: 'Create Prescription',
    addLabOrder: 'New Lab Order',
    createInvoice: 'Create Invoice',
    addDoctor: 'Add Doctor',
    searchGlobal: 'Search patients, doctors, Rx, lab, invoices...',
    todayPatients: "Today's Patients",
    todayAppointments: "Today's Appointments",
    collectedRevenue: 'Collected Revenue',
    pendingDues: 'Pending Dues',
    activeDoctors: 'Active Doctors',
    labOrders: 'Lab Orders',
    pharmacyAlerts: 'Low Stock / Expiry',
    signOut: 'Sign Out',
    newClinic: 'Register New Clinic',
    switchClinic: 'Switch Clinic',
    loadDemo: 'Load Sample Clinic Data (Test Mode)',
    save: 'Save',
    cancel: 'Cancel',
    print: 'Print / Save PDF',
    exportCsv: 'Export CSV',
    noData: 'No records found yet.',
    clinicalGroup: 'Clinical Care',
    operationsGroup: 'Operations',
    adminGroup: 'Administration',
    back: 'Back',
    backToDashboard: 'Back to Dashboard',
  },
};

export function t(lang: Lang, key: string): string {
  return DICT[lang]?.[key] || DICT.en[key] || key;
}

export const NOTIFICATION_TEMPLATES = [
  {
    type: 'appointment_confirmed',
    label: 'Appointment Confirmation',
    en: 'Dear {name}, your appointment with {doctor} on {date} at {time} is confirmed. Token #{token}.',
  },
  {
    type: 'lab_report_ready',
    label: 'Lab Report Ready',
    en: 'Dear {name}, your verified laboratory report ({ref}) is ready for collection or viewing in Patient Portal.',
  },
  {
    type: 'prescription_ready',
    label: 'Prescription Ready',
    en: 'Dear {name}, your digital prescription ({ref}) from {doctor} is ready.',
  },
  {
    type: 'followup_reminder',
    label: 'Follow-up Reminder',
    en: 'Dear {name}, reminder for your scheduled follow-up visit on {date} with {doctor}.',
  },
  {
    type: 'payment_due',
    label: 'Payment Due Reminder',
    en: 'Dear {name}, a balance of {amount} is due for invoice {ref}.',
  },
];
