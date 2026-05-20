import React, { useState } from 'react';
import { CalendarRange, X } from 'lucide-react';

interface Props {
  customerId: string;
  onReschedule: (customerId: string, date: string, reason: string) => void;
  label?: string;
  title?: string;
}

export function RescheduleButton({ customerId, onReschedule, label = 'Reschedule', title = 'Reschedule Follow Up' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('Rescheduled follow up');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason.trim()) return;
    onReschedule(customerId, date, reason.trim());
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs text-gray-505 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 font-medium transition-colors bg-white flex items-center gap-1.5 shadow-xs shrink-0"
      >
        <CalendarRange size={14} />
        {label}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg text-gray-900">{title}</h4>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block">
                  New Follow Up Date
                </label>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-gray-950 bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block block">
                  Reason
                </label>
                <input 
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-gray-950 bg-white"
                  placeholder="e.g. Call back on Monday"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full text-sm bg-gray-900 hover:bg-gray-850 text-white font-semibold rounded-xl py-3 transition-colors shadow-lg shadow-gray-900/10"
              >
                Save reminder
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
