import React, { useState } from 'react';
import { ClipboardList, Loader2, Search, RefreshCw } from 'lucide-react';
import { Customer, TradeCheckIn } from '../../types';
import { InputField } from '../../components/InputField';
import { Toggle } from '../../components/Toggle';
import { deriveTradeStockNumber, tradeStockNumberFor } from '../../lib/tradeStockNumber';
import { buyersGuideForCustomer } from '../../lib/buyersGuideRules';
import { VIN_FACT_GROUPS, EQUIPMENT_GROUPS, setBox, SheetGroup } from '../../lib/tradeCheckInSheet';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
  /** Decode the trade VIN and run the grounded equipment lookup. App owns the async work. */
  onLookup: () => void;
  isLookingUp: boolean;
  lookupError: string | null;
}

const EMPTY: TradeCheckIn = { equipment: [], unsure: [] };

const TRUCK_HINT_BOXES = ['Cabin - Regular', 'Cabin - Extended', 'Cabin - Quad', 'Cabin - Crew', 'Bed - Long', 'Bed - Short'];

export function TradeCheckInSection({ customer, onChange, onLookup, isLookingUp, lookupError }: Props) {
  const ci = customer.tradeCheckIn ?? EMPTY;
  const [showTruck, setShowTruck] = useState(false);
  const ticked = new Set(ci.equipment);
  const unsure = new Set(ci.unsure);
  const isTruck = showTruck || ci.equipment.some(b => TRUCK_HINT_BOXES.includes(b)) || ci.unsure.some(b => TRUCK_HINT_BOXES.includes(b));

  const patch = (p: Partial<TradeCheckIn>) => onChange({ tradeCheckIn: { ...ci, ...p } });

  const tap = (box: string) => {
    if (ticked.has(box)) {
      patch({ equipment: setBox(ci.equipment, box, false) });
    } else {
      patch({ equipment: setBox(ci.equipment, box, true), unsure: ci.unsure.filter(b => b !== box) });
    }
  };

  const renderGroup = (g: SheetGroup) => {
    if (g.truckOnly && !isTruck) return null;
    return (
      <div key={g.id} className="space-y-2">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{g.label}</div>
        <div className="flex flex-wrap gap-1.5">
          {g.boxes.map(box => {
            const on = ticked.has(box);
            const maybe = !on && unsure.has(box);
            return (
              <button
                key={box}
                type="button"
                onClick={() => tap(box)}
                title={maybe ? 'Optional on this trim. Tap to tick if the car has it.' : on ? 'Will print. Tap to clear.' : 'Tap to tick.'}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
                  on ? 'bg-gray-900 text-white border-gray-900'
                  : maybe ? 'bg-amber-50 text-amber-800 border-amber-300 border-dashed'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {maybe ? `${box} ?` : box}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const decision = buyersGuideForCustomer(customer);
  const canLookup = !isLookingUp && (
    (customer.tradeVin ?? '').trim().length === 17 ||
    (!!customer.tradeYear && !!customer.tradeMake && !!customer.tradeModel)
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
          <ClipboardList size={18} />
        </div>
        <h2 className="text-xl font-bold">Trade Check-In</h2>
      </div>
      <div className="card p-6 space-y-6">
        {/* B-line + stock number + Buyers Guide */}
        <div className="flex items-center justify-between py-1">
          <div>
            <div className="font-semibold text-gray-700">B-line trade</div>
            <div className="text-xs text-gray-400">Buyers Guide only, no Check-In Sheet</div>
          </div>
          <Toggle active={!!customer.tradeIsBLine} onToggle={() => onChange({ tradeIsBLine: !customer.tradeIsBLine })} />
        </div>
        <div className="space-y-1.5">
          <InputField
            label="Trade Stock #"
            value={tradeStockNumberFor(customer)}
            placeholder={customer.vehicleStock ? '' : 'Enter the new vehicle stock # first'}
            onChange={v => onChange({ tradeStockNumber: v.trim().toUpperCase() === deriveTradeStockNumber(customer.vehicleStock) ? '' : v })}
          />
          <div className="text-[11px] text-gray-400 ml-1">
            {customer.tradeStockNumber?.trim()
              ? <>Manual override. Auto would be <span className="font-mono">{deriveTradeStockNumber(customer.vehicleStock) || '—'}</span>.</>
              : customer.vehicleStock
                ? <>Auto from new stock <span className="font-mono">{customer.vehicleStock.toUpperCase()}</span>. Edit to override.</>
                : 'Derived from the new vehicle stock number once it is entered.'}
          </div>
        </div>
        <div className={`text-xs rounded-xl px-3 py-2.5 border ${decision.kind === 'warranty' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
          <span className="font-bold">Buyers Guide:</span> {decision.reason}
        </div>

        {customer.tradeIsBLine ? (
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">B-line: the Check-In Sheet is skipped, so nothing below is needed.</div>
        ) : (
          <>
            {/* Lookup */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-700">Equipment from the VIN</div>
                  <div className="text-xs text-gray-400">
                    {ci.lookedUpAt
                      ? <>Looked up {new Date(ci.lookedUpAt).toLocaleDateString()}{ci.trim ? ` for the ${ci.trim} trim` : ''}{ci.sources ? ` · ${ci.sources}` : ''}</>
                      : 'Decodes the VIN, then looks up standard and optional equipment for the trim.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLookup}
                  disabled={!canLookup}
                  className="shrink-0 inline-flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-40 active:scale-95 transition-all"
                >
                  {isLookingUp ? <Loader2 size={14} className="animate-spin" /> : ci.lookedUpAt ? <RefreshCw size={14} /> : <Search size={14} />}
                  {isLookingUp ? 'Looking up…' : ci.lookedUpAt ? 'Refresh' : 'Look up'}
                </button>
              </div>
              {lookupError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{lookupError}</div>}
              <div className="text-[11px] text-gray-400">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-900 align-middle mr-1" /> will print &nbsp;
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-dashed border-amber-400 bg-amber-50 align-middle mr-1" /> optional on this trim, confirm at the car &nbsp;
                Detail, UCI, Salvage, Associate, Manager: filled by hand.
              </div>
            </div>

            {/* Specs */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Engine" value={ci.engine} onChange={v => patch({ engine: v })} />
                <InputField label="CYL" value={ci.cylinders} onChange={v => patch({ cylinders: v })} />
                <InputField label="Trans Speeds" value={ci.transmissionSpeeds} onChange={v => patch({ transmissionSpeeds: v })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Exterior Color" value={ci.extColor} onChange={v => patch({ extColor: v })} />
                <InputField label="Interior Color" value={ci.intColor} onChange={v => patch({ intColor: v })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Premium Audio Brand" value={ci.premiumAudioBrand} onChange={v => patch({ premiumAudioBrand: v })} />
                <InputField label="Other Smartphone App" value={ci.smartphoneAppName} onChange={v => patch({ smartphoneAppName: v })} />
              </div>
            </div>

            {/* VIN facts */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              {VIN_FACT_GROUPS.map(renderGroup)}
              {!isTruck && (
                <button type="button" onClick={() => setShowTruck(true)} className="text-[11px] font-bold text-gray-400 hover:text-gray-700">
                  + Show truck options (cab, bed, liner)
                </button>
              )}
            </div>

            {/* Equipment */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              {EQUIPMENT_GROUPS.map(renderGroup)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
