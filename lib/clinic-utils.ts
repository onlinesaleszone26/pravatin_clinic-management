import type { Doctor, Appointment } from './types';

export function clampStr(val: string | undefined | null, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

export function makeSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned.length >= 2 ? cleaned : `clinic-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}

export function makeCode(prefix: string, seq?: number): string {
  const num = seq !== undefined ? 1000 + seq : Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

export function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export function sanitizeSafeUrl(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, 200);
    }
    return '';
  } catch {
    return '';
  }
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatMoney(amount: number, currency: 'BDT' | 'USD' | 'EUR' | string = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(safe));
  if (currency === 'BDT') return `${sign}৳${formatted}`;
  if (currency === 'EUR') return `${sign}€${formatted}`;
  return `${sign}$${formatted}`;
}

export function parseTimeToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function minutesToTimeLabel(totalMins: number): string {
  const h24 = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getWeekdayForDate(dateISO: string): string {
  const parts = dateISO.split('-').map(Number);
  if (parts.length !== 3) return '';
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return WEEKDAY_NAMES[d.getDay()] ?? '';
}

export interface GeneratedSlot {
  label: string;
  shift: 'morning' | 'evening';
  booked: boolean;
  bookedBy?: string;
}

export function generateDoctorSlots(
  doctor: Doctor | undefined,
  dateISO: string,
  existingAppointments: Appointment[]
): { slots: GeneratedSlot[]; unavailableReason?: string } {
  if (!doctor) return { slots: [], unavailableReason: 'Select a doctor to view available slots.' };
  if (doctor.status === 'inactive') {
    return { slots: [], unavailableReason: 'Doctor is currently inactive.' };
  }
  if (doctor.leaveDates?.includes(dateISO)) {
    return { slots: [], unavailableReason: `Dr. ${doctor.name} is on scheduled leave on ${dateISO}.` };
  }
  const weekday = getWeekdayForDate(dateISO);
  if (doctor.availableDays && doctor.availableDays.length > 0 && weekday && !doctor.availableDays.includes(weekday)) {
    return {
      slots: [],
      unavailableReason: `${doctor.name} does not consult on ${weekday}. Available: ${doctor.availableDays.join(', ')}.`,
    };
  }

  const duration = Math.max(5, Math.min(180, doctor.slotDurationMinutes || 15));
  const bookedMap = new Map<string, string>();
  existingAppointments
    .filter((a) => a.doctorId === doctor.id && a.date === dateISO && a.status !== 'cancelled' && a.status !== 'no_show')
    .forEach((a) => bookedMap.set(a.timeSlot, a.patientName));

  const parseRange = (rangeStr: string | undefined): [number, number] | null => {
    if (!rangeStr || !rangeStr.includes('-')) return null;
    const [startStr, endStr] = rangeStr.split('-');
    const s = parseTimeToMinutes(startStr);
    const e = parseTimeToMinutes(endStr);
    if (s === null || e === null || e <= s) return null;
    return [s, e];
  };

  const breakRange = parseRange(doctor.breakTime);
  const slots: GeneratedSlot[] = [];

  const pushShift = (rangeStr: string | undefined, shift: 'morning' | 'evening') => {
    const r = parseRange(rangeStr);
    if (!r) return;
    for (let t = r[0]; t + duration <= r[1]; t += duration) {
      if (breakRange && t >= breakRange[0] && t < breakRange[1]) continue;
      const label = minutesToTimeLabel(t);
      slots.push({
        label,
        shift,
        booked: bookedMap.has(label),
        bookedBy: bookedMap.get(label),
      });
    }
  };

  pushShift(doctor.morningShift || '09:00-13:00', 'morning');
  pushShift(doctor.eveningShift || '17:00-21:00', 'evening');

  return { slots };
}

export function exportRowsToCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  const escapeCell = (val: string | number | undefined | null) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJsonBackup(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const MEDICINE_REFERENCE_DB = [
  { name: 'Napa 500mg', genericName: 'Paracetamol', dosage: '500mg', route: 'Oral', defaultFreq: '1+1+1' },
  { name: 'Napa Extra', genericName: 'Paracetamol + Caffeine', dosage: '500mg+65mg', route: 'Oral', defaultFreq: '1+0+1' },
  { name: 'Seclo 20mg', genericName: 'Omeprazole', dosage: '20mg', route: 'Oral', defaultFreq: '1+0+1' },
  { name: 'Sergel 20mg', genericName: 'Esomeprazole', dosage: '20mg', route: 'Oral', defaultFreq: '1+0+1' },
  { name: 'Fexo 120mg', genericName: 'Fexofenadine HCl', dosage: '120mg', route: 'Oral', defaultFreq: '0+0+1' },
  { name: 'Monas 10mg', genericName: 'Montelukast', dosage: '10mg', route: 'Oral', defaultFreq: '0+0+1' },
  { name: 'Azith 500mg', genericName: 'Azithromycin', dosage: '500mg', route: 'Oral', defaultFreq: '1+0+0' },
  { name: 'Cef-3 200mg', genericName: 'Cefixime Trihydrate', dosage: '200mg', route: 'Oral', defaultFreq: '1+0+1' },
  { name: 'Amdocal 5mg', genericName: 'Amlodipine', dosage: '5mg', route: 'Oral', defaultFreq: '0+0+1' },
  { name: 'Osartil 50mg', genericName: 'Losartan Potassium', dosage: '50mg', route: 'Oral', defaultFreq: '1+0+0' },
  { name: 'Comet 500mg', genericName: 'Metformin HCl', dosage: '500mg', route: 'Oral', defaultFreq: '1+0+1' },
  { name: 'Atova 10mg', genericName: 'Atorvastatin', dosage: '10mg', route: 'Oral', defaultFreq: '0+0+1' },
  { name: 'Neuro-B', genericName: 'Vitamin B1+B6+B12', dosage: '100mg+200mg+200mcg', route: 'Oral', defaultFreq: '1+0+1' },
  { name: 'Calcibo 500mg', genericName: 'Calcium Carbonate + Vit D3', dosage: '500mg', route: 'Oral', defaultFreq: '0+1+0' },
  { name: 'Belladonna 30C (Homeo)', genericName: 'Atropa Belladonna', dosage: '4 globules', route: 'Sublingual', defaultFreq: '1+1+1' },
  { name: 'Arnica Montana 200C (Homeo)', genericName: 'Arnica Montana', dosage: '4 globules', route: 'Sublingual', defaultFreq: '1+0+1' },
  { name: 'Nux Vomica 30C (Homeo)', genericName: 'Strychnos Nux-Vomica', dosage: '4 globules', route: 'Sublingual', defaultFreq: '0+0+1' },
];

export const MEDICAL_SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Pediatrics',
  'Gynecology & Obstetrics',
  'Orthopedics',
  'Dentistry',
  'Dermatology',
  'ENT',
  'Neurology',
  'Homeopathy',
  'Pathology & Diagnostics',
];

export const REGISTRATION_LABELS = [
  'BMDC Reg. No.',
  'BHMS / Homeo Reg. No.',
  'Dental Council Reg. No.',
  'Medical License ID',
  'NMC / GMC Reg. No.',
];
