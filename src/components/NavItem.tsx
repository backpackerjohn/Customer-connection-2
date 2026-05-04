import React from 'react';

interface Props {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export const NavItem = ({ icon, label, active = false, onClick }: Props) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all ${
      active ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:bg-gray-50'
    }`}
  >
    {icon}
    <span className="font-semibold">{label}</span>
  </div>
);
