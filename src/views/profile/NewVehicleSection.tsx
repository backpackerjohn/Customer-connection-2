import React from 'react';
import { CarFront } from 'lucide-react';
import { Customer } from '../../types';
import { InputField } from '../../components/InputField';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
}

export function NewVehicleSection({ customer, onChange }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
          <CarFront size={18} />
        </div>
        <h2 className="text-xl font-bold">New Vehicle</h2>
      </div>
      <div className="card p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <InputField 
            label="Stock #" 
            value={customer.vehicleStock} 
            onChange={v => onChange({ vehicleStock: v })} 
          />
          <InputField 
            label="Year" 
            value={customer.vehicleYear} 
            onChange={v => onChange({ vehicleYear: v })} 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField 
            label="Make" 
            value={customer.vehicleMake} 
            onChange={v => onChange({ vehicleMake: v })} 
          />
          <InputField 
            label="Model" 
            value={customer.vehicleModel} 
            onChange={v => onChange({ vehicleModel: v })} 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField 
            label="VIN" 
            value={customer.vehicleVin} 
            onChange={v => onChange({ vehicleVin: v })} 
          />
          <InputField 
            label="Miles" 
            value={customer.vehicleMiles} 
            onChange={v => onChange({ vehicleMiles: v })} 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField 
            label="Purchase Date" 
            type="date"
            value={customer.purchaseDate ? customer.purchaseDate.split('T')[0] : ''} 
            onChange={v => onChange({ purchaseDate: v })} 
          />
        </div>
      </div>
    </section>
  );
}
