import React from 'react';

interface Props {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export const MenuButton = ({ icon, label, active, onClick }: Props) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 min-w-[64px] transition-all ${active ? 'text-gray-900 scale-110' : 'text-gray-400 grayscale'}`}
  >
    <div className={`p-2 rounded-2xl transition-colors ${active ? 'bg-gray-100' : 'bg-transparent'}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-tighter text-center leading-none ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
);
