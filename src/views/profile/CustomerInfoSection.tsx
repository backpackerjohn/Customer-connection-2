import React from 'react';
import { User as UserIcon } from 'lucide-react';
import { Customer } from '../../types';
import { InputField } from '../../components/InputField';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
}

export function CustomerInfoSection({ customer, onChange }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
          <UserIcon size={18} />
        </div>
        <h2 className="text-xl font-bold">Customer Info</h2>
      </div>
      <div className="card p-6 space-y-6">
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2">
            <InputField 
              label="First Name" 
              value={customer.firstName} 
              onChange={v => onChange({ firstName: v })} 
            />
          </div>
          <div className="col-span-1">
            <InputField 
              label="M.I." 
              value={customer.middleInitial || ''} 
              onChange={v => onChange({ middleInitial: v })} 
            />
          </div>
          <div className="col-span-2">
            <InputField 
              label="Last Name" 
              value={customer.lastName} 
              onChange={v => onChange({ lastName: v })} 
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField 
            label="Date of Birth" 
            type="date"
            value={customer.dob} 
            onChange={v => onChange({ dob: v })} 
          />
          <InputField 
            label="Phone" 
            type="tel"
            value={customer.phone} 
            onChange={v => onChange({ phone: v })} 
          />
        </div>
        <InputField 
          label="Email" 
          type="email"
          value={customer.email} 
          onChange={v => onChange({ email: v })} 
        />
        <div className="space-y-4 pt-4 border-t border-gray-50">
          <InputField 
            label="Street Address" 
            value={customer.address} 
            onChange={v => onChange({ address: v })} 
          />
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <InputField 
                label="City" 
                value={customer.city} 
                onChange={v => onChange({ city: v })} 
              />
            </div>
            <InputField 
              label="State" 
              value={customer.state} 
              onChange={v => onChange({ state: v })} 
            />
            <InputField 
              label="Zip" 
              value={customer.zip} 
              onChange={v => onChange({ zip: v })} 
            />
          </div>
        </div>
        <div className="space-y-4 pt-4 border-t border-gray-50">
          <InputField 
            label="Driver's License Number" 
            value={customer.dlNumber} 
            onChange={v => onChange({ dlNumber: v })} 
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField 
              label="DL State" 
              value={customer.dlState} 
              onChange={v => onChange({ dlState: v })} 
            />
            <InputField 
              label="DL Expiration" 
              type="date"
              value={customer.dlExpiration} 
              onChange={v => onChange({ dlExpiration: v })} 
            />
          </div>
        </div>
        {(customer.leadSource || customer.leadGeneratedDate || customer.pendingInterestNotes) && (
          <div className="space-y-3 pt-4 border-t border-gray-50">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lead Origin</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {customer.leadSource && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</div>
                  <div className="text-gray-900">{customer.leadSource}</div>
                </div>
              )}
              {customer.leadGeneratedDate && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lead Generated</div>
                  <div className="text-gray-900">{customer.leadGeneratedDate}</div>
                </div>
              )}
            </div>
            {customer.pendingInterestNotes && (
              <div className="text-xs text-amber-800 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                <span className="font-semibold">Source listed additional interests:</span> {customer.pendingInterestNotes}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
