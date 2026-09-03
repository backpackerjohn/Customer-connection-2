import React from 'react';
import { CreditCard, Camera } from 'lucide-react';
import { Customer } from '../../types';
import { InputField } from '../../components/InputField';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
  onCapture?: () => void;
}

export function InsuranceSection({ customer, onChange, onCapture }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
          <CreditCard size={18} />
        </div>
        <h2 className="text-xl font-bold">Insurance</h2>
        {onCapture && (
          <button
            type="button"
            onClick={onCapture}
            className="ml-auto p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
            aria-label="Snap insurance card photo"
          >
            <Camera size={16} />
          </button>
        )}
      </div>
      <div className="card p-6 space-y-6">
        <InputField 
          label="Insurance Company" 
          value={customer.insuranceCompany} 
          onChange={v => onChange({ insuranceCompany: v })} 
        />
        <InputField 
          label="Agent Name" 
          value={customer.agentName} 
          onChange={v => onChange({ agentName: v })} 
        />
      </div>
    </section>
  );
}
