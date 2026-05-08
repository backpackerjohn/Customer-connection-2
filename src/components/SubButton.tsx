import React from 'react';

interface Props {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const SubButton = ({ icon, label, onClick, disabled }: Props) => (
  <button 
    onClick={!disabled ? onClick : undefined}
    disabled={disabled}
    className={`flex flex-col items-center gap-1.5 transition-opacity ${
      disabled ? 'opacity-30' : 'opacity-60 hover:opacity-100'
    }`}
  >
    <div className="p-2.5 bg-white shadow-sm border border-gray-100 rounded-xl">
      {icon}
    </div>
    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">{label}</span>
  </button>
);
