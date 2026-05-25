import React from 'react';
import { motion } from 'motion/react';

interface Props {
  status: 'idle' | 'saving' | 'synced' | 'error';
  isDirty: boolean;
}

export const SaveStatusIndicator = ({ status, isDirty }: Props) => {
  if (status === 'saving') return (
    <div className="flex items-center gap-1.5 text-blue-600 font-bold uppercase tracking-tighter text-[10px]">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" />
      Saving...
    </div>
  );
  if (status === 'synced') return (
    <div className="flex items-center gap-1.5 text-green-600 font-bold uppercase tracking-tighter text-[10px]">
      <div className="w-1.5 h-1.5 bg-green-600 rounded-full shadow-[0_0_8px_rgba(22,163,74,0.5)]" />
      Synced
    </div>
  );
  if (status === 'error') return (
    <div id="save-status-error" className="flex items-center gap-1.5 text-red-600 font-bold uppercase tracking-tighter text-[10px]">
      Error Saving
    </div>
  );
  if (isDirty) return (
    <div id="save-status-dirty" className="flex items-center gap-1.5 text-amber-600 font-bold uppercase tracking-tighter text-[10px]">
      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
      Unsaved Changes
    </div>
  );
  return null;
};
