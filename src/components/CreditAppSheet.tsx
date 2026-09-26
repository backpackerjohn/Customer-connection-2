import React, { useState } from 'react';
import { Eye, EyeOff, FileDown, Loader2, X } from 'lucide-react';
import { Customer } from '../types';
import { CreditSsns, hasJointApplicant } from '../lib/creditApp';

interface Props {
  customer: Customer;
  /** Held in App memory for the open customer; typed here or on the profile card. */
  ssns: CreditSsns;
  onSsnsChange: (ssns: CreditSsns) => void;
  onGenerate: (ssns: CreditSsns) => void | Promise<void>;
  isGenerating: boolean;
  error: string | null;
  onClose: () => void;
}

/**
 * Print step for the credit application. The fields themselves live on the
 * profile's Credit Application card; this dialog only takes the SSNs, which
 * exist in this component's state for the one print and are gone on close.
 */
export function CreditAppSheet({ customer, ssns, onSsnsChange, onGenerate, isGenerating, error, onClose }: Props) {
  const app = customer.creditApp ?? {};
  const joint = hasJointApplicant(app);
  const ssn = ssns.applicant ?? '';
  const coSsn = ssns.coApplicant ?? '';
  const setSsn = (v: string) => onSsnsChange({ ...ssns, applicant: v || undefined });
  const setCoSsn = (v: string) => onSsnsChange({ ...ssns, coApplicant: v || undefined });
  const [show, setShow] = useState(false);
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer';
  const coName = [app.coApplicant?.firstName, app.coApplicant?.lastName].filter(Boolean).join(' ') || 'Joint applicant';

  const generate = () => onGenerate({
    applicant: ssn.trim() || undefined,
    coApplicant: joint ? coSsn.trim() || undefined : undefined,
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end sm:items-center justify-center p-4" role="dialog" aria-label="Print credit application" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Print credit application</h2>
            <p className="text-xs text-gray-500">{name}{joint ? ` + ${coName}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close"><X size={18} /></button>
        </div>

        <p className="text-xs text-gray-500">
          Fields come from the Credit Application card on the profile. The SSNs are held in memory while this customer is open and are never saved.
        </p>

        <SsnField label={`${name} · SSN`} value={ssn} onChange={setSsn} show={show} />
        {joint && <SsnField label={`${coName} · SSN`} value={coSsn} onChange={setCoSsn} show={show} />}
        <button type="button" onClick={() => setShow(s => !s)} className="flex items-center gap-1.5 text-xs text-gray-500">
          {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? 'Hide' : 'Show'} numbers
        </button>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button type="button" onClick={generate} disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm disabled:opacity-40">
          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Generate PDF
        </button>
      </div>
    </div>
  );
}

function SsnField({ label, value, onChange, show }: { label: string; value: string; onChange: (v: string) => void; show: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1 leading-none">{label}</label>
      <input type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="off" value={value} onChange={e => onChange(e.target.value)} placeholder="###-##-####"
        className="w-full bg-amber-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 transition-all font-medium text-sm tracking-widest" />
    </div>
  );
}
