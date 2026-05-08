import React from 'react';
import { Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../../types';
import { InputField } from '../../components/InputField';
import { Toggle } from '../../components/Toggle';
import { VinLookupButtons } from '../../components/VinLookupButtons';

import { TradeEquityPanel } from '../../components/TradeEquityPanel';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
  onTradeEstimate: (
    input: { 
      vin: string; 
      year: string; 
      make: string; 
      model: string; 
      trim: string; 
      mileage: string; 
      condition: 'excellent' | 'very_good' | 'good' | 'fair'; 
    },
    options?: { skipCache?: boolean }
  ) => void;
  isEstimatingTradeValue: boolean;
}

export function TradeInSection({ customer, onChange, onTradeEstimate, isEstimatingTradeValue }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
          <Users size={18} />
        </div>
        <h2 className="text-xl font-bold">Trade-in</h2>
      </div>
      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between py-2">
          <span className="font-semibold text-gray-700">Has trade-in?</span>
          <Toggle 
            active={customer.hasTradeIn} 
            onToggle={() => onChange({ hasTradeIn: !customer.hasTradeIn })} 
          />
        </div>

        {customer.hasTradeIn && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-6 pt-4 border-t border-gray-100 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Year" 
                value={customer.tradeYear} 
                onChange={v => onChange({ tradeYear: v })} 
              />
              <InputField 
                label="Make" 
                value={customer.tradeMake} 
                onChange={v => onChange({ tradeMake: v })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Model" 
                value={customer.tradeModel} 
                onChange={v => onChange({ tradeModel: v })} 
              />
              <InputField 
                label="Trim" 
                value={customer.tradeTrim} 
                onChange={v => onChange({ tradeTrim: v })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Mileage" 
                value={customer.tradeMileage} 
                onChange={v => onChange({ tradeMileage: v })} 
              />
              <div className="space-y-2">
                <InputField 
                  label="VIN" 
                  value={customer.tradeVin} 
                  onChange={v => onChange({ tradeVin: v })} 
                />
                <div className="flex justify-end">
                  <VinLookupButtons 
                    vin={customer.tradeVin ?? ''}
                    onResult={(results) => {
                      const patch: Partial<Customer> = {};
                      if (results.vin) patch.tradeVin = results.vin;
                      if (results.year) patch.tradeYear = results.year;
                      if (results.make) patch.tradeMake = results.make;
                      if (results.model) patch.tradeModel = results.model;
                      if (results.trim) patch.tradeTrim = results.trim;
                      onChange(patch);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-gray-700">Still owe on it?</span>
                <Toggle 
                  active={customer.stillOwe} 
                  onToggle={() => onChange({ stillOwe: !customer.stillOwe })} 
                />
              </div>

              {customer.stillOwe && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-6 overflow-hidden"
                >
                  <InputField 
                    label="Lienholder" 
                    value={customer.lienholder} 
                    onChange={v => onChange({ lienholder: v })} 
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField 
                      label="Payoff Amount" 
                      value={customer.payoffAmount} 
                      onChange={v => onChange({ payoffAmount: v })} 
                    />
                    <InputField 
                      label="Monthly Payment" 
                      value={customer.monthlyPayment} 
                      onChange={v => onChange({ monthlyPayment: v })} 
                    />
                  </div>
                  <InputField 
                    label="Months Remaining" 
                    value={customer.monthsRemaining} 
                    onChange={v => onChange({ monthsRemaining: v })} 
                  />
                </motion.div>
              )}
            </div>

            <TradeEquityPanel 
              customer={customer} 
              onChange={onChange} 
              onEstimate={onTradeEstimate}
              isEstimating={isEstimatingTradeValue}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
