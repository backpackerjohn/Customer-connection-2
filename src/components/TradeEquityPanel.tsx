import React from 'react';
import { Loader2, TrendingUp, Info, RefreshCw } from 'lucide-react';
import { Customer } from '../types';
import { InputField } from './InputField';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
  onEstimate: (
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
  isEstimating: boolean;
}

const CONDITIONS = [
  { id: 'excellent', label: 'Excellent' },
  { id: 'very_good', label: 'Very Good' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
] as const;

function formatRelativeTime(iso: string | undefined, now: number): string {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Math.floor((now - date.getTime()) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function humanizeCondition(condition?: string): string {
  if (!condition) return '';
  return condition.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function TradeEquityPanel({ customer, onChange, onEstimate, isEstimating }: Props) {
  const [now] = React.useState(() => Date.now());
  const canEstimate = customer.tradeVin && customer.tradeMileage && (customer.tradeValueCondition || true);
  const selectedCondition = customer.tradeValueCondition || 'good';

  const handleManualEdit = (patch: Partial<Customer>) => {
    onChange({
      ...patch,
      tradeValueSource: 'Manual override',
      tradeValueAt: new Date().toISOString()
    });
  };

  const payoff = parseFloat(customer.payoffAmount || '0');
  const lowVal = parseFloat(customer.tradeValueLow || '0');
  const highVal = parseFloat(customer.tradeValueHigh || '0');
  
  const hasEstimate = !!(customer.tradeValueLow || customer.tradeValueHigh);
  const lowEquity = lowVal - payoff;
  const highEquity = highVal - payoff;
  
  const isStale = React.useMemo(() => {
    if (!customer.tradeValueAt) return false;
    return (now - new Date(customer.tradeValueAt).getTime() > 86_400_000);
  }, [customer.tradeValueAt, now]);

  const getEstimateInput = () => ({
    vin: customer.tradeVin || '',
    year: customer.tradeYear || '',
    make: customer.tradeMake || '',
    model: customer.tradeModel || '',
    trim: customer.tradeTrim || '',
    mileage: customer.tradeMileage || '',
    condition: selectedCondition as 'excellent' | 'very_good' | 'good' | 'fair'
  });

  const equityColor = (lowEquity > 0 && highEquity > 0) 
    ? 'text-green-600' 
    : (lowEquity < 0 && highEquity < 0) 
      ? 'text-red-600' 
      : 'text-gray-700';

  return (
    <div className="bg-gray-50/70 border border-gray-200/50 rounded-xl p-4 ml-2 space-y-6">
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        <TrendingUp size={16} />
        <span className="text-sm font-bold uppercase tracking-wider">Trade Equity</span>
      </div>

      {/* Condition Selector */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-tight px-1">Condition</label>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map(c => {
            const isActive = customer.tradeValueCondition === c.id || (!customer.tradeValueCondition && c.id === 'good');
            return (
              <button
                key={c.id}
                onClick={() => onChange({ tradeValueCondition: c.id })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 ${
                  isActive 
                    ? 'bg-gray-800 text-white shadow-sm' 
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onEstimate(getEstimateInput())}
        disabled={isEstimating || !canEstimate}
        className="w-full h-12 rounded-xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-200/50 flex items-center justify-center gap-2 hover:bg-orange-600 disabled:bg-gray-300 disabled:shadow-none transition-all active:scale-95"
      >
        {isEstimating ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Searching KBB, Edmunds, NADA…</span>
          </>
        ) : (
          <span>Get Trade Estimate</span>
        )}
      </button>

      {/* Estimate Display */}
      {hasEstimate && (
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-gray-900">
              ${lowVal.toLocaleString()} – ${highVal.toLocaleString()}
            </div>
            <div className="flex flex-col text-xs text-gray-500 font-medium">
              <span>Per {customer.tradeValueSource}</span>
              <span>{humanizeCondition(selectedCondition)} condition</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span>Updated {formatRelativeTime(customer.tradeValueAt, now)}</span>
                <button
                  onClick={() => onEstimate(getEstimateInput(), { skipCache: true })}
                  disabled={isEstimating}
                  className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  title="Force refresh"
                >
                  <RefreshCw size={12} className={isEstimating ? 'animate-spin' : ''} />
                </button>
              </div>
              {isStale && (
                <div className="mt-1.5 self-start px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                  Older than 24h — consider refreshing
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-start gap-1.5 p-2 bg-blue-50/50 rounded-lg text-[10px] text-blue-600/70 border border-blue-100/50 leading-tight">
            <Info size={12} className="shrink-0 mt-0.5" />
            <p>Pending physical inspection — not a binding offer.</p>
          </div>
        </div>
      )}

      {/* Editable Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <InputField 
          label="Low Estimate" 
          value={customer.tradeValueLow} 
          onChange={v => handleManualEdit({ tradeValueLow: v })} 
        />
        <InputField 
          label="High Estimate" 
          value={customer.tradeValueHigh} 
          onChange={v => handleManualEdit({ tradeValueHigh: v })} 
        />
      </div>

      <div className="pt-2">
        <InputField 
          label="Customer Asking" 
          value={customer.customerDesiredTradeValue} 
          onChange={v => onChange({ customerDesiredTradeValue: v })} 
        />
      </div>

      {/* Equity Row */}
      {hasEstimate && (
        <div className={`pt-4 border-t border-gray-100 text-sm font-bold flex justify-between items-center ${equityColor}`}>
          <span>Estimated equity:</span>
          <span>
            ${lowEquity < 0 ? `(${Math.abs(lowEquity).toLocaleString()})` : lowEquity.toLocaleString()} 
            {' – '} 
            ${highEquity < 0 ? `(${Math.abs(highEquity).toLocaleString()})` : highEquity.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
