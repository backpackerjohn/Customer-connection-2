import React from 'react';
import { CreditCard } from 'lucide-react';
import { Customer } from '../../types';
import { InputField } from '../../components/InputField';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
}

export function InsuranceSection({ customer, onChange }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
          <CreditCard size={18} />
        </div>
        <h2 className="text-xl font-bold">Insurance</h2>
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
