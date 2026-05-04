import React from 'react';

interface Props {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

export const SubButton = ({ icon, label, onClick }: Props) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
  >
    <div className="p-2.5 bg-white shadow-sm border border-gray-100 rounded-xl">
      {icon}
    </div>
    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">{label}</span>
  </button>
);
