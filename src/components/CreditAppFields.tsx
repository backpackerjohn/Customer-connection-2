import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { CreditApp, CreditApplicant, CreditReference, Customer } from '../types';
import { InputField } from './InputField';
import { CREDIT_TYPES, IDENTITY_KEYS, RESIDENTIAL_STATUSES, applicantView, hasJointApplicant, underTwoYears } from '../lib/creditApp';
import { stripUndefined } from '../lib/lenders';
import { normalizeImageForVision } from '../lib/imageNormalizer';
import { processCustomerChat } from '../services/aiService';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
}

/**
 * Every credit application field except the SSNs, which are typed only at
 * print time (see CreditAppSheet). Applicant identity edits write back to the
 * customer profile; everything else lives in customer.creditApp.
 */
export function CreditAppFields({ customer, onChange }: Props) {
  const app: CreditApp = customer.creditApp ?? {};
  const setApp = (patch: Partial<CreditApp>) => onChange({ creditApp: stripUndefined({ ...app, ...patch }) });

  /** Identity keys go to the profile, everything else to creditApp.applicant. */
  const onApplicant = (patch: Partial<CreditApplicant>) => {
    const profile: Record<string, unknown> = {};
    const details: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) ((IDENTITY_KEYS as readonly string[]).includes(k) ? profile : details)[k] = v;
    const next: Partial<Customer> = { ...(profile as Partial<Customer>) };
    if (Object.keys(details).length) {
      next.creditApp = stripUndefined({ ...app, applicant: stripUndefined({ ...(app.applicant ?? {}), ...(details as Partial<CreditApplicant>) }) });
    }
    onChange(next);
  };
  const onCo = (patch: Partial<CreditApplicant>) => setApp({ coApplicant: stripUndefined({ ...(app.coApplicant ?? {}), ...patch }) });

  const refs: CreditReference[] = [0, 1, 2, 3].map(i => app.references?.[i] ?? {});
  const setRef = (i: number, patch: Partial<CreditReference>) =>
    setApp({ references: refs.map((r, j) => (j === i ? stripUndefined({ ...r, ...patch }) : r)) });

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Type of credit</p>
        <Chips options={CREDIT_TYPES} value={app.creditType} onChange={v => setApp({ creditType: v })} />
        <p className="text-xs text-gray-400">Choosing a Joint type adds the joint applicant below. Adding a co-signer later is just changing this. Anything typed for them is kept if you switch back.</p>
      </div>

      <ApplicantSection title="Applicant" a={applicantView(customer)} onChange={onApplicant} />

      {hasJointApplicant(app) && (
        <ApplicantSection title="Joint applicant" a={app.coApplicant ?? {}} onChange={onCo} allowLicensePhoto />
      )}

      <div className="card p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">References · A = applicant, B = joint applicant, J = joint</p>
        {refs.map((r, i) => (
          <div key={i} className="space-y-2 pt-2 border-t border-gray-100 first:border-0 first:pt-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">{i < 2 ? `Nearest relative ${i + 1}` : `Personal friend ${i - 1}`}</span>
              <Chips options={[{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'J', label: 'J' }]} value={r.whose} onChange={v => setRef(i, { whose: v })} small />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Name" value={r.name} onChange={v => setRef(i, { name: v })} />
              <InputField label="Phone" value={r.phone} onChange={v => setRef(i, { phone: v })} />
            </div>
            <InputField label="Address" value={r.address} onChange={v => setRef(i, { address: v })} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange, small }: { options: { id: T; label: string }[]; value?: T; onChange: (v: T | undefined) => void; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(on ? undefined : o.id)}
            className={`${small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-2 text-xs'} rounded-full font-bold border transition-colors ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Identity keys a license photo can supply (never phone or email). */
const LICENSE_KEYS: (keyof CreditApplicant)[] = ['firstName', 'middleInitial', 'lastName', 'dob', 'address', 'city', 'state', 'zip'];

function ApplicantSection({ title, a, onChange, allowLicensePhoto }: { title: string; a: CreditApplicant; onChange: (patch: Partial<CreditApplicant>) => void; allowLicensePhoto?: boolean }) {
  const [showPrevAddr, setShowPrevAddr] = useState(!!(a.prevAddress || a.prevCity));
  const [showPrevEmp, setShowPrevEmp] = useState(!!a.prevEmployer);
  const [reading, setReading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const f = (k: keyof CreditApplicant) => (v: string) => onChange({ [k]: v });
  // Lenders want these when under two years, so open them automatically.
  const needPrevAddr = underTwoYears(a.yearsAtAddress);
  const needPrevEmp = underTwoYears(a.employedYears);

  /** Read the joint applicant's license and fill only their identity fields. The photo is not stored. */
  const readLicense = async (file: File) => {
    setReading(true); setPhotoError(null);
    try {
      const normalized = await normalizeImageForVision(file);
      const res = await processCustomerChat('', {}, [], { inlineData: { data: normalized.base64, mimeType: normalized.mimeType } }, 'license');
      const patch: Partial<CreditApplicant> = {};
      for (const k of LICENSE_KEYS) {
        const v = res.updatedFields[k];
        if (typeof v === 'string' && v.trim()) (patch as Record<string, string>)[k] = v.trim();
      }
      if (!Object.keys(patch).length) throw new Error('No name or address could be read from that photo.');
      onChange(patch);
    } catch (err) {
      console.error('Joint applicant license read failed:', err);
      setPhotoError(err instanceof Error ? err.message : 'Could not read the license.');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <h3 className="text-base font-bold">{title}</h3>
        {allowLicensePhoto && (
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void readLicense(file); }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={reading}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold disabled:opacity-40"
              aria-label="Read the joint applicant's license">
              {reading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} License photo
            </button>
          </>
        )}
      </div>
      {photoError && <p className="text-xs text-red-600 px-2">{photoError}</p>}
      <div className="card p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Identity</p>
        <div className="grid grid-cols-[1fr_4rem_1fr] gap-4">
          <InputField label="First" value={a.firstName} onChange={f('firstName')} />
          <InputField label="M.I." value={a.middleInitial} onChange={f('middleInitial')} />
          <InputField label="Last" value={a.lastName} onChange={f('lastName')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Date of birth" type="date" value={a.dob} onChange={f('dob')} />
          <InputField label="Mobile" value={a.phone} onChange={f('phone')} />
        </div>
        <InputField label="Email" value={a.email} onChange={f('email')} />
        <InputField label="Street address" value={a.address} onChange={f('address')} />
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
          <InputField label="City" value={a.city} onChange={f('city')} />
          <InputField label="State" value={a.state} onChange={v => onChange({ state: v.toUpperCase() })} />
          <InputField label="Zip" value={a.zip} onChange={f('zip')} />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Residence</p>
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Years there" value={a.yearsAtAddress} onChange={f('yearsAtAddress')} />
          <InputField label="Months" value={a.monthsAtAddress} onChange={f('monthsAtAddress')} />
          <InputField label="Rent / mortgage $" value={a.housingPayment} onChange={f('housingPayment')} />
        </div>
        <Chips options={RESIDENTIAL_STATUSES} value={a.residentialStatus} onChange={v => onChange({ residentialStatus: v })} />
        {needPrevAddr
          ? <p className="text-xs font-bold text-amber-700">Under 2 years at this address: the lender needs the previous address.</p>
          : <button type="button" onClick={() => setShowPrevAddr(s => !s)} className="text-xs font-bold text-blue-700 underline">
              {showPrevAddr ? 'Hide' : 'Add'} previous address (if under 2 years here)
            </button>}
        {(showPrevAddr || needPrevAddr) && (
          <div className="space-y-4">
            <InputField label="Previous street address" value={a.prevAddress} onChange={f('prevAddress')} />
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
              <InputField label="City" value={a.prevCity} onChange={f('prevCity')} />
              <InputField label="State" value={a.prevState} onChange={v => onChange({ prevState: v.toUpperCase() })} />
              <InputField label="Zip" value={a.prevZip} onChange={f('prevZip')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Years there" value={a.prevYears} onChange={f('prevYears')} />
              <InputField label="Months" value={a.prevMonths} onChange={f('prevMonths')} />
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Employment</p>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Employer" value={a.employer} onChange={f('employer')} />
          <InputField label="Employer phone" value={a.employerPhone} onChange={f('employerPhone')} />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
          <InputField label="Job title" value={a.jobTitle} onChange={f('jobTitle')} />
          <InputField label="Years" value={a.employedYears} onChange={f('employedYears')} />
          <InputField label="Months" value={a.employedMonths} onChange={f('employedMonths')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Gross monthly salary $" value={a.grossMonthlySalary} onChange={f('grossMonthlySalary')} />
          <InputField label="Employer street" value={a.employerAddress} onChange={f('employerAddress')} />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
          <InputField label="City" value={a.employerCity} onChange={f('employerCity')} />
          <InputField label="State" value={a.employerState} onChange={v => onChange({ employerState: v.toUpperCase() })} />
          <InputField label="Zip" value={a.employerZip} onChange={f('employerZip')} />
        </div>
        {needPrevEmp
          ? <p className="text-xs font-bold text-amber-700">Under 2 years with this employer: the lender needs the previous employer.</p>
          : <button type="button" onClick={() => setShowPrevEmp(s => !s)} className="text-xs font-bold text-blue-700 underline">
              {showPrevEmp ? 'Hide' : 'Add'} previous employer (if under 2 years)
            </button>}
        {(showPrevEmp || needPrevEmp) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Previous employer" value={a.prevEmployer} onChange={f('prevEmployer')} />
              <InputField label="Phone" value={a.prevEmployerPhone} onChange={f('prevEmployerPhone')} />
            </div>
            <InputField label="Street" value={a.prevEmployerAddress} onChange={f('prevEmployerAddress')} />
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
              <InputField label="City" value={a.prevEmployerCity} onChange={f('prevEmployerCity')} />
              <InputField label="State" value={a.prevEmployerState} onChange={v => onChange({ prevEmployerState: v.toUpperCase() })} />
              <InputField label="Zip" value={a.prevEmployerZip} onChange={f('prevEmployerZip')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Years there" value={a.prevEmployedYears} onChange={f('prevEmployedYears')} />
              <InputField label="Months" value={a.prevEmployedMonths} onChange={f('prevEmployedMonths')} />
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Other income (optional)</p>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Source" value={a.otherIncomeSource} onChange={f('otherIncomeSource')} placeholder="e.g. child support" />
          <InputField label="Monthly amount $" value={a.otherIncomeMonthly} onChange={f('otherIncomeMonthly')} />
        </div>
      </div>
    </div>
  );
}
