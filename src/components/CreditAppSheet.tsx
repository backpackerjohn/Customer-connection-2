import React, { useState } from 'react';
import { Eye, EyeOff, FileDown, Loader2, X } from 'lucide-react';
import { CreditApp, CreditApplicant, CreditReference, Customer } from '../types';
import { InputField } from './InputField';
import { Toggle } from './Toggle';
import { CREDIT_TYPES, CreditSsns, IDENTITY_KEYS, RESIDENTIAL_STATUSES, applicantView } from '../lib/creditApp';
import { stripUndefined } from '../lib/lenders';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
  onGenerate: (ssns: CreditSsns) => void | Promise<void>;
  isGenerating: boolean;
  error: string | null;
  onClose: () => void;
}

/**
 * Full-screen credit application editor. Applicant identity is the customer
 * profile (edits write back to it); residence, employment, income, references
 * and the co-applicant live in customer.creditApp. The two SSNs live only in
 * this component's state, go into the one PDF, and are gone when it closes.
 */
export function CreditAppSheet({ customer, onChange, onGenerate, isGenerating, error, onClose }: Props) {
  const app: CreditApp = customer.creditApp ?? {};
  const [ssn, setSsn] = useState('');
  const [coSsn, setCoSsn] = useState('');
  const [showSsn, setShowSsn] = useState(false);

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

  const generate = () => onGenerate({
    applicant: ssn.trim() || undefined,
    coApplicant: app.hasCoApplicant ? coSsn.trim() || undefined : undefined,
  });

  return (
    <div className="fixed inset-0 z-[60] bg-[#f5f5f5] overflow-y-auto" role="dialog" aria-label="Credit application">
      <div className="sticky top-0 z-10 bg-[#f5f5f5]/90 backdrop-blur-md border-b border-gray-200/60 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Credit Application</h2>
          <p className="text-xs text-gray-500">{[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer'}</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600" aria-label="Close"><X size={20} /></button>
      </div>

      <div className="max-w-2xl mx-auto p-6 pb-40 space-y-8">
        <section className="card p-6 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Type of credit</p>
          <Chips options={CREDIT_TYPES} value={app.creditType} onChange={v => setApp({ creditType: v })} />
          <div className="flex items-center justify-between pt-2">
            <span className="font-semibold text-gray-700">Co-applicant?</span>
            <Toggle active={!!app.hasCoApplicant} onToggle={() => setApp({ hasCoApplicant: !app.hasCoApplicant })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 pt-1 cursor-pointer select-none">
            <button type="button" onClick={() => setShowSsn(s => !s)} className="p-1 rounded hover:bg-gray-100" aria-label={showSsn ? 'Hide SSNs' : 'Show SSNs'}>
              {showSsn ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            SSNs are used for this print only and are never saved.
          </label>
        </section>

        <ApplicantSection title="Applicant" a={applicantView(customer)} onChange={onApplicant} ssn={ssn} onSsn={setSsn} showSsn={showSsn} />

        {app.hasCoApplicant && (
          <ApplicantSection title="Joint applicant" a={app.coApplicant ?? {}} onChange={onCo} ssn={coSsn} onSsn={setCoSsn} showSsn={showSsn} />
        )}

        <section className="card p-6 space-y-4">
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
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button type="button" onClick={generate} disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm disabled:opacity-40">
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Generate credit app
          </button>
          {error ? <span className="text-xs text-red-600">{error}</span> : <span className="text-xs text-gray-400">Fills the applicant and joint applicant sections. Dealer box stays blank.</span>}
        </div>
      </div>
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange, small }: { options: { id: T; label: string }[]; value?: T; onChange: (v: T | undefined) => void; small?: boolean }) {
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

function SsnField({ value, onChange, show }: { value: string; onChange: (v: string) => void; show: boolean }) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1 leading-none">SSN (not saved)</label>
      <input type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="off" value={value} onChange={e => onChange(e.target.value)} placeholder="###-##-####"
        className="w-full bg-amber-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 transition-all font-medium text-sm tracking-widest" />
    </div>
  );
}

function ApplicantSection({ title, a, onChange, ssn, onSsn, showSsn }: {
  title: string; a: CreditApplicant; onChange: (patch: Partial<CreditApplicant>) => void; ssn: string; onSsn: (v: string) => void; showSsn: boolean;
}) {
  const [showPrevAddr, setShowPrevAddr] = useState(!!(a.prevAddress || a.prevCity));
  const [showPrevEmp, setShowPrevEmp] = useState(!!a.prevEmployer);
  const f = (k: keyof CreditApplicant) => (v: string) => onChange({ [k]: v });
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold px-2">{title}</h3>
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
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Email" value={a.email} onChange={f('email')} />
          <SsnField value={ssn} onChange={onSsn} show={showSsn} />
        </div>
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
        <button type="button" onClick={() => setShowPrevAddr(s => !s)} className="text-xs font-bold text-blue-700 underline">
          {showPrevAddr ? 'Hide' : 'Add'} previous address (if under 2 years here)
        </button>
        {showPrevAddr && (
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
        <button type="button" onClick={() => setShowPrevEmp(s => !s)} className="text-xs font-bold text-blue-700 underline">
          {showPrevEmp ? 'Hide' : 'Add'} previous employer (if under 2 years)
        </button>
        {showPrevEmp && (
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
    </section>
  );
}
