import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { Customer } from '../../types';
import { CreditAppFields } from '../../components/CreditAppFields';
import { CREDIT_TYPES, hasJointApplicant } from '../../lib/creditApp';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
}

/**
 * Profile card for the credit application fields. Collapsed by default with a
 * one-line summary so the profile stays short; open it to fill residence,
 * employment, income, references and the joint applicant. Printing (with the
 * SSNs) is AI menu → Credit App.
 */
export function CreditAppSection({ customer, onChange }: Props) {
  const app = customer.creditApp ?? {};
  const filled = !!(app.creditType || app.applicant?.employer || app.applicant?.yearsAtAddress || hasJointApplicant(app) || app.references?.some(r => r?.name));
  const [open, setOpen] = useState(false);
  const summary = [
    CREDIT_TYPES.find(t => t.id === app.creditType)?.label,
    app.applicant?.employer ? `works at ${app.applicant.employer}` : undefined,
    hasJointApplicant(app) ? `joint with ${[app.coApplicant?.firstName, app.coApplicant?.lastName].filter(Boolean).join(' ') || 'co-applicant'}` : undefined,
  ].filter(Boolean).join(' · ');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
          <CreditCard size={18} />
        </div>
        <h2 className="text-xl font-bold">Credit Application</h2>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold"
          aria-expanded={open}
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? 'Close' : filled ? 'Edit' : 'Fill out'}
        </button>
      </div>
      {!open && (
        <div className="card p-4 text-sm text-gray-500">
          {summary || 'Nothing entered yet. Name, birth date, mobile, email and address come from Customer Info; the rest is filled here.'}
          <span className="block text-xs text-gray-400 mt-1">Print with the SSNs from the Ai menu → Credit App. SSNs are never saved.</span>
        </div>
      )}
      {open && <CreditAppFields customer={customer} onChange={onChange} />}
    </section>
  );
}
