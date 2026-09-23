import React from 'react';
import { Users, Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer, Lender } from '../../types';
import { InputField } from '../../components/InputField';
import { Toggle } from '../../components/Toggle';
import { VinLookupButtons } from '../../components/VinLookupButtons';

import { TradeEquityPanel } from '../../components/TradeEquityPanel';
import { PayoffLenderPanel } from '../../components/PayoffLenderPanel';

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
    },
    options?: { skipCache?: boolean }
  ) => void;
  isEstimatingTradeValue: boolean;
  valuationError: string | null;
  onCapture?: () => void;
  /** Shared lender library for the payoff sheet's bank half. */
  lenders: Lender[];
  userId: string;
}

export function TradeInSection({ customer, onChange, onTradeEstimate, isEstimatingTradeValue, valuationError, onCapture, lenders, userId }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
          <Users size={18} />
        </div>
        <h2 className="text-xl font-bold">Trade-in</h2>
        {onCapture && (
          <button
            type="button"
            onClick={onCapture}
            className="ml-auto p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
            aria-label="Snap trade-in photo"
          >
            <Camera size={16} />
          </button>
        )}
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
                  <PayoffLenderPanel customer={customer} onChange={onChange} lenders={lenders} userId={userId} />
                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">This deal</p>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="Payoff Amount" 
                        value={customer.payoffAmount} 
                        onChange={v => onChange({ payoffAmount: v })} 
                      />
                      <InputField 
                        label="20-Day Payoff" 
                        value={customer.payoff20Day} 
                        onChange={v => onChange({ payoff20Day: v })} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="Per Diem" 
                        value={customer.payoffPerDiem} 
                        onChange={v => onChange({ payoffPerDiem: v })} 
                      />
                      <InputField 
                        label="Account #" 
                        value={customer.payoffAccountNumber} 
                        onChange={v => onChange({ payoffAccountNumber: v })} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="Monthly Payment" 
                        value={customer.monthlyPayment} 
                        onChange={v => onChange({ monthlyPayment: v })} 
                      />
                      <InputField 
                        label="Months Remaining" 
                        value={customer.monthsRemaining} 
                        onChange={v => onChange({ monthsRemaining: v })} 
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <TradeEquityPanel 
              customer={customer} 
              onChange={onChange} 
              onEstimate={onTradeEstimate}
              isEstimating={isEstimatingTradeValue}
              valuationError={valuationError}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
