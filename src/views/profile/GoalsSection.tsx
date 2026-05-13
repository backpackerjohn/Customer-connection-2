import React from 'react';
import { Flag } from 'lucide-react';
import { Customer } from '../../types';
import { InputField } from '../../components/InputField';
import { Toggle } from '../../components/Toggle';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
}

export function GoalsSection({ customer, onChange }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
          <Flag size={18} />
        </div>
        <h2 className="text-xl font-bold">Goals</h2>
      </div>
      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <div className="font-bold">Paying Cash</div>
            <div className="text-sm text-gray-500">Customer is not financing</div>
          </div>
          <Toggle 
            active={customer.payingCash} 
            onToggle={() => onChange({ payingCash: !customer.payingCash })} 
          />
        </div>
        <InputField 
          label="Monthly Payment Range" 
          placeholder="e.g. $400 - $500"
          value={customer.goalsMonthlyPayment} 
          onChange={v => onChange({ goalsMonthlyPayment: v })} 
        />
        <div className="grid grid-cols-2 gap-4">
          <InputField 
            label="Money Down" 
            placeholder="$"
            value={customer.goalsMoneyDown} 
            onChange={v => onChange({ goalsMoneyDown: v })} 
          />
          <InputField 
            label="Estimated Credit Score" 
            placeholder="e.g. 720"
            value={customer.goalsCreditScore} 
            onChange={v => onChange({ goalsCreditScore: v })} 
          />
        </div>
      </div>
    </section>
  );
}
