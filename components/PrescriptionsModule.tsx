'use client';

import React, { useMemo, useState } from 'react';
import {
  FilePlus2,
  Printer,
  Copy,
  Edit3,
  Plus,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { savePrescription, TenantActor } from '@/lib/firestore-service';
import { MEDICINE_REFERENCE_DB } from '@/lib/clinic-utils';
import type {
  Organization,
  Patient,
  Doctor,
  Appointment,
  Prescription,
  PrescribedMedicine,
} from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  patients: Patient[];
  doctors: Doctor[];
  prescriptions: Prescription[];
  prefillAppointment?: Appointment | null;
  onClearPrefill?: () => void;
}

const EMPTY_MED: PrescribedMedicine = {
  name: '',
  genericName: '',
  dosage: '',
  route: 'Oral',
  frequency: '1+0+1',
  duration: '7 days',
  quantity: '14 tabs',
  instructions: 'After meal',
};

export function PrescriptionsModule({
  org,
  actor,
  patients,
  doctors,
  prescriptions,
  prefillAppointment,
  onClearPrefill,
}: Props) {
  const [mode, setMode] = useState<'list' | 'editor' | 'preview'>(prefillAppointment ? 'editor' : 'list');
  const [activeRx, setActiveRx] = useState<Prescription | null>(null);
  const [search, setSearch] = useState('');
  const [medSearch, setMedSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [patientId, setPatientId] = useState(prefillAppointment?.patientId || patients[0]?.id || '');
  const [doctorId, setDoctorId] = useState(prefillAppointment?.doctorId || doctors[0]?.id || '');
  const [appointmentId, setAppointmentId] = useState(prefillAppointment?.id || '');
  const [templateType, setTemplateType] = useState<'general_a4' | 'compact' | 'homeopathy'>('general_a4');
  const [weight, setWeight] = useState('');
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temperature, setTemperature] = useState('');
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [clinicalFindings, setClinicalFindings] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [investigationAdvice, setInvestigationAdvice] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [digitalSignature, setDigitalSignature] = useState('');
  const [medicines, setMedicines] = useState<PrescribedMedicine[]>([{ ...EMPTY_MED }]);

  const startNew = (apt?: Appointment | null) => {
    setEditingId(undefined);
    setPatientId(apt?.patientId || patients[0]?.id || '');
    const docId = apt?.doctorId || doctors[0]?.id || '';
    setDoctorId(docId);
    const docObj = doctors.find((d) => d.id === docId);
    setAppointmentId(apt?.id || '');
    setTemplateType(docObj?.discipline === 'Homeopathic' ? 'homeopathy' : 'general_a4');
    setWeight('');
    setBp('');
    setPulse('');
    setTemperature('');
    setChiefComplaints('');
    setClinicalFindings('');
    setDiagnosis('');
    setInvestigationAdvice('');
    setTreatmentPlan('');
    setFollowUpDate('');
    setDigitalSignature(docObj?.name || actor.name);
    setMedicines([{ ...EMPTY_MED }]);
    setError(null);
    setMode('editor');
    onClearPrefill?.();
  };

  const loadIntoEditor = (rx: Prescription, asDuplicate: boolean) => {
    setEditingId(asDuplicate ? undefined : rx.id);
    setPatientId(rx.patientId);
    setDoctorId(rx.doctorId);
    setAppointmentId(asDuplicate ? '' : rx.appointmentId || '');
    setTemplateType(rx.templateType);
    setWeight(rx.vitals?.weight || '');
    setBp(rx.vitals?.bp || '');
    setPulse(rx.vitals?.pulse || '');
    setTemperature(rx.vitals?.temperature || '');
    setChiefComplaints(rx.chiefComplaints || '');
    setClinicalFindings(rx.clinicalFindings || '');
    setDiagnosis(rx.diagnosis || '');
    setInvestigationAdvice(rx.investigationAdvice || '');
    setTreatmentPlan(rx.treatmentPlan || '');
    setFollowUpDate(rx.followUpDate || '');
    setDigitalSignature(rx.digitalSignature || rx.doctorName);
    setMedicines(rx.medicines.length > 0 ? rx.medicines.map((m) => ({ ...m })) : [{ ...EMPTY_MED }]);
    setError(null);
    setMode('editor');
  };

  const addQuickMed = (item: (typeof MEDICINE_REFERENCE_DB)[number]) => {
    setMedicines((prev) => {
      const cleaned = prev.filter((m) => m.name.trim() !== '');
      return [
        ...cleaned,
        {
          name: item.name,
          genericName: item.genericName,
          dosage: item.dosage,
          route: item.route,
          frequency: item.defaultFreq,
          duration: '7 days',
          quantity: '14',
          instructions: 'After meal',
        },
      ];
    });
    setMedSearch('');
  };

  const updateMed = (index: number, key: keyof PrescribedMedicine, value: string) => {
    setMedicines((prev) => prev.map((m, i) => (i === index ? { ...m, [key]: value } : m)));
  };

  const handleSave = async (status: 'draft' | 'finalized') => {
    const pat = patients.find((p) => p.id === patientId);
    const docObj = doctors.find((d) => d.id === doctorId);
    if (!pat || !docObj) {
      setError('Select both Patient and Prescribing Doctor.');
      return;
    }
    const validMeds = medicines.filter((m) => m.name.trim().length > 0);
    setSaving(true);
    setError(null);
    try {
      await savePrescription(
        org,
        actor,
        {
          id: editingId,
          appointmentId,
          patientId: pat.id,
          patientName: pat.name,
          patientCode: pat.patientCode,
          patientAge: pat.age,
          patientGender: pat.gender,
          patientAuthUid: pat.patientAuthUid,
          doctorId: docObj.id,
          doctorName: docObj.name,
          doctorQualifications: docObj.qualifications || '',
          doctorRegistration: docObj.registrationNumber
            ? `${docObj.registrationLabel || 'Reg'}: ${docObj.registrationNumber}`
            : '',
          templateType,
          vitals: { weight, bp, pulse, temperature },
          chiefComplaints,
          clinicalFindings,
          diagnosis,
          investigationAdvice,
          treatmentPlan,
          medicines: validMeds,
          followUpDate,
          digitalSignature: digitalSignature || docObj.name,
          status,
        },
        prescriptions.length + 1
      );
      setMode('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prescription.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prescriptions.filter(
      (r) =>
        !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.doctorName.toLowerCase().includes(q) ||
        r.rxNumber.toLowerCase().includes(q) ||
        (r.diagnosis || '').toLowerCase().includes(q)
    );
  }, [prescriptions, search]);

  const matchingMeds = useMemo(() => {
    const q = medSearch.trim().toLowerCase();
    if (!q) return [];
    return MEDICINE_REFERENCE_DB.filter(
      (m) => m.name.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [medSearch]);

  // =========================================================================
  // PRINTABLE PRESCRIPTION PREVIEW (A4 / COMPACT / HOMEOPATHY)
  // =========================================================================
  if (mode === 'preview' && activeRx) {
    const isCompact = activeRx.templateType === 'compact';
    const isHomeo = activeRx.templateType === 'homeopathy';
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <button type="button" onClick={() => setMode('list')} className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
            ← Back to Prescriptions
          </button>
          <div className="flex items-center gap-2">
            {activeRx.status === 'draft' && (
              <button
                type="button"
                onClick={() => loadIntoEditor(activeRx, false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Draft
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
          </div>
        </div>

        <div
          className={`bg-white text-slate-900 border border-slate-200 rounded-xl print-sheet mx-auto ${
            isCompact ? 'max-w-xl p-6' : 'max-w-4xl p-8 sm:p-10'
          }`}
        >
          {/* Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{org.prescriptionHeader || org.name}</h1>
              <p className="text-xs text-slate-600 mt-0.5">{org.address}</p>
              <p className="text-xs text-slate-600 font-mono">
                {org.phone} {org.email ? `· ${org.email}` : ''}
              </p>
              {isHomeo && <p className="text-xs font-semibold text-teal-800 mt-1">Homeopathic Consultation Sheet</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-base font-bold text-slate-900">{activeRx.doctorName}</p>
              <p className="text-xs text-slate-700">{activeRx.doctorQualifications}</p>
              <p className="text-xs font-mono text-slate-600">{activeRx.doctorRegistration}</p>
              <p className="text-xs font-mono text-emerald-800 mt-1">Rx #{activeRx.rxNumber}</p>
            </div>
          </div>

          {/* Patient Strip */}
          <div className="py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span><strong>Patient:</strong> {activeRx.patientName}</span>
              <span className="font-mono"><strong>ID:</strong> {activeRx.patientCode || '—'}</span>
              <span><strong>Age/Sex:</strong> {activeRx.patientAge || '—'}y / {activeRx.patientGender || '—'}</span>
            </div>
            <span className="font-mono text-slate-600">
              Date: {activeRx.createdAt?.toDate ? activeRx.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
            </span>
          </div>

          {/* Vitals */}
          {activeRx.vitals && (activeRx.vitals.bp || activeRx.vitals.pulse || activeRx.vitals.weight || activeRx.vitals.temperature) && (
            <div className="py-2.5 border-b border-slate-200 flex flex-wrap gap-6 text-xs font-mono text-slate-700">
              {activeRx.vitals.weight && <span>Wt: {activeRx.vitals.weight}</span>}
              {activeRx.vitals.bp && <span>BP: {activeRx.vitals.bp}</span>}
              {activeRx.vitals.pulse && <span>Pulse: {activeRx.vitals.pulse}</span>}
              {activeRx.vitals.temperature && <span>Temp: {activeRx.vitals.temperature}</span>}
            </div>
          )}

          {/* Body: Clinical Left Column + Rx Right Column */}
          <div className={`grid grid-cols-1 ${isCompact ? 'gap-5 mt-5' : 'md:grid-cols-12 gap-8 mt-6'}`}>
            <div className={`${isCompact ? '' : 'md:col-span-4 md:border-r md:border-slate-200 md:pr-6'} space-y-4 text-xs`}>
              {activeRx.chiefComplaints && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Chief Complaints</h3>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{activeRx.chiefComplaints}</p>
                </div>
              )}
              {activeRx.clinicalFindings && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Clinical Findings</h3>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{activeRx.clinicalFindings}</p>
                </div>
              )}
              {activeRx.diagnosis && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Diagnosis</h3>
                  <p className="text-slate-900 font-medium">{activeRx.diagnosis}</p>
                </div>
              )}
              {activeRx.investigationAdvice && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Investigation Advice</h3>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{activeRx.investigationAdvice}</p>
                </div>
              )}
            </div>

            <div className={`${isCompact ? '' : 'md:col-span-8'} space-y-5`}>
              <div>
                <p className="text-2xl font-serif font-bold text-slate-900 mb-3">Rx</p>
                {activeRx.medicines.length === 0 ? (
                  <p className="text-xs text-slate-500">No medicines prescribed.</p>
                ) : (
                  <ol className="space-y-3.5 list-decimal list-inside">
                    {activeRx.medicines.map((med, i) => (
                      <li key={i} className="text-sm text-slate-900 border-b border-slate-100 pb-2.5">
                        <span className="font-semibold">{med.name}</span>
                        {med.genericName && <span className="text-xs text-slate-500 ml-1.5">({med.genericName})</span>}
                        <div className="pl-5 mt-1 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-0.5 font-mono">
                          <span>{med.dosage} · {med.route}</span>
                          <span className="font-semibold text-slate-900">{med.frequency}</span>
                          <span>{med.duration}</span>
                          {med.quantity && <span>Qty: {med.quantity}</span>}
                        </div>
                        {med.instructions && <p className="pl-5 mt-0.5 text-xs text-slate-600">{med.instructions}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {activeRx.treatmentPlan && (
                <div className="text-xs pt-2">
                  <h3 className="font-semibold text-slate-900 mb-1">Advice & Treatment Plan</h3>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{activeRx.treatmentPlan}</p>
                </div>
              )}

              {activeRx.followUpDate && (
                <p className="text-xs font-medium text-slate-900 pt-1">
                  Next Follow-up Date: <span className="font-mono">{activeRx.followUpDate}</span>
                </p>
              )}
            </div>
          </div>

          {/* Signature & Footer */}
          <div className="mt-10 pt-5 border-t border-slate-200 flex items-end justify-between gap-4 text-xs">
            <p className="text-slate-500 max-w-md">{org.prescriptionFooter}</p>
            <div className="text-right">
              <p className="font-serif italic text-base text-slate-900 border-b border-slate-400 pb-1 px-4">
                {activeRx.digitalSignature || activeRx.doctorName}
              </p>
              <p className="text-xs text-slate-500 mt-1">Authorized Doctor Signature</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // DIGITAL PRESCRIPTION EDITOR
  // =========================================================================
  if (mode === 'editor') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {editingId ? 'Edit Draft Prescription' : 'Digital Prescription Editor'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All clinical findings, diagnoses, and medications are entered and approved strictly by the authorized doctor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMode('list')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            ← Back to Prescriptions
          </button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 p-3 rounded-lg">{error}</p>}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          {/* Patient, Doctor & Template Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient *</label>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                <option value="">Select Patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.patientCode})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Prescribing Doctor *</label>
              <select
                value={doctorId}
                onChange={(e) => {
                  setDoctorId(e.target.value);
                  const d = doctors.find((x) => x.id === e.target.value);
                  if (d) setDigitalSignature(d.name);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="">Select Doctor</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Print Template Layout</label>
              <select value={templateType} onChange={(e) => setTemplateType(e.target.value as 'general_a4' | 'compact' | 'homeopathy')} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
                <option value="general_a4">Standard A4 Clinical Layout</option>
                <option value="compact">Compact Prescription Sheet</option>
                <option value="homeopathy">Homeopathy Consultation Template</option>
              </select>
            </div>
          </div>

          {/* Vitals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Weight</label>
              <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70 kg" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Blood Pressure</label>
              <input value={bp} onChange={(e) => setBp(e.target.value)} placeholder="120/80 mmHg" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Pulse</label>
              <input value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="74 bpm" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Temperature</label>
              <input value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="98.6 °F" className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
          </div>

          {/* Clinical Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Chief Complaints</label>
              <textarea rows={2} value={chiefComplaints} onChange={(e) => setChiefComplaints(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Clinical Findings</label>
              <textarea rows={2} value={clinicalFindings} onChange={(e) => setClinicalFindings(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Diagnosis</label>
              <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Primary diagnosis" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Investigation / Lab Advice</label>
              <input value={investigationAdvice} onChange={(e) => setInvestigationAdvice(e.target.value)} placeholder="CBC, FBS, ECG..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
          </div>

          {/* Medicine Database Search & Rx List */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Medicines ({medicines.length})</h3>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                <input
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Quick search medicine database (brand/generic)..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
                {matchingMeds.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-800">
                    {matchingMeds.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => addQuickMed(item)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                        <span className="text-slate-500">{item.genericName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {medicines.map((med, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <input value={med.name} onChange={(e) => updateMed(idx, 'name', e.target.value)} placeholder="Medicine Name" className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <input value={med.genericName} onChange={(e) => updateMed(idx, 'genericName', e.target.value)} placeholder="Generic" className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <input value={med.dosage} onChange={(e) => updateMed(idx, 'dosage', e.target.value)} placeholder="500mg" className="sm:col-span-1 px-2 py-1.5 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <input value={med.frequency} onChange={(e) => updateMed(idx, 'frequency', e.target.value)} placeholder="1+0+1" className="sm:col-span-2 px-2 py-1.5 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <input value={med.duration} onChange={(e) => updateMed(idx, 'duration', e.target.value)} placeholder="7 days" className="sm:col-span-1 px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <input value={med.instructions} onChange={(e) => updateMed(idx, 'instructions', e.target.value)} placeholder="After meal" className="sm:col-span-2 px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <div className="sm:col-span-1 text-right">
                    <button type="button" onClick={() => setMedicines((prev) => prev.filter((_, i) => i !== idx))} className="p-1.5 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMedicines((prev) => [...prev, { ...EMPTY_MED }])}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Medicine Row
            </button>
          </div>

          {/* Advice, Follow-up & Signature */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Treatment Plan & Lifestyle Advice</label>
              <textarea rows={2} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Follow-Up Date</label>
              <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Doctor Digital Signature Text</label>
              <input value={digitalSignature} onChange={(e) => setDigitalSignature(e.target.value)} placeholder="Dr. Full Name" className="w-full px-3 py-2 text-sm font-serif italic rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('finalized')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Finalize & Lock Prescription'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PRESCRIPTION HISTORY LIST
  // =========================================================================
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Rx number, patient, doctor, or diagnosis..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => startNew(null)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg whitespace-nowrap self-start sm:self-auto"
        >
          <FilePlus2 className="w-3.5 h-3.5" /> Create Prescription
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filteredRx.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">No digital prescriptions authored yet.</p>
            <button type="button" onClick={() => startNew(null)} className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg">
              Write First Prescription
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Rx Number</th>
                  <th className="py-3 px-4 font-medium">Patient</th>
                  <th className="py-3 px-4 font-medium">Doctor</th>
                  <th className="py-3 px-4 font-medium">Diagnosis & Meds</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredRx.map((rx) => (
                  <tr key={rx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {rx.rxNumber}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-white">{rx.patientName}</p>
                      <p className="text-xs text-slate-500 font-mono">{rx.patientCode || '—'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">{rx.doctorName}</td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{rx.diagnosis || 'General Visit'}</p>
                      <p className="text-slate-500">{rx.medicines.length} medicine(s) · {rx.templateType.replace('_', ' ')}</p>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {rx.status === 'finalized' ? (
                        <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium">
                          <Lock className="w-3 h-3" /> Finalized
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Draft</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setActiveRx(rx); setMode('preview'); }}
                          title="View & Print PDF"
                          className="p-1.5 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {rx.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => loadIntoEditor(rx, false)}
                            title="Edit Draft"
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => loadIntoEditor(rx, true)}
                          title="Duplicate Prescription"
                          className="p-1.5 text-slate-500 hover:text-teal-600"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
