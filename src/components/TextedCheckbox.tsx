import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Check } from 'lucide-react';
import { ReminderKind } from '../lib/reminders/engine';

interface Props {
  customerId: string;
  closedKinds: ReminderKind[];
  onTexted: (customerId: string, when: Date, closedKinds: ReminderKind[]) => void;
}

export function TextedCheckbox({ customerId, closedKinds, onTexted }: Props) {
  const [checked, setChecked] = useState(false);
  const [showBackfill, setShowBackfill] = useState(false);
  const [backfillDate, setBackfillDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleToggle = () => {
    if (showBackfill) return;
    
    // If a click is already pending, the second click cancels it.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setChecked(false);
      return;
    }
    
    setChecked(true);
    timeoutRef.current = setTimeout(() => {
      onTexted(customerId, new Date(), closedKinds);
      setChecked(false);
      timeoutRef.current = null;
    }, 1500);
  };

  const handleBackfillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backfillDate) return;
    const dateObj = new Date(backfillDate + 'T12:00:00');
    onTexted(customerId, dateObj, closedKinds);
    setShowBackfill(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="relative flex items-center justify-center w-6 h-6 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-gray-900 transition-colors bg-white">
            <input 
              type="checkbox" 
              checked={checked} 
              onChange={handleToggle}
              className="sr-only" 
            />
            {checked && (
              <Check size={16} className="text-gray-900 stroke-[3]" />
            )}
          </label>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Texted</span>
        </div>
        
        <button
          type="button"
          onClick={() => setShowBackfill(!showBackfill)}
          className={`text-xs flex items-center gap-1 font-medium transition-colors ${showBackfill ? 'text-gray-900 font-semibold' : 'text-gray-400 hover:text-gray-650'}`}
        >
          <Calendar size={13} />
          {showBackfill ? 'Close Backfill' : 'Backfill'}
        </button>
      </div>

      {showBackfill && (
        <form onSubmit={handleBackfillSubmit} className="flex items-center gap-2 mt-1 animate-fadeIn">
          <input 
            type="date"
            value={backfillDate}
            onChange={(e) => setBackfillDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-gray-950 bg-white"
          />
          <button 
            type="submit"
            className="text-xs bg-gray-900 hover:bg-gray-850 text-white rounded-lg px-2.5 py-1.5 font-medium transition-colors shadow-sm"
          >
            Confirm
          </button>
        </form>
      )}
    </div>
  );
}
