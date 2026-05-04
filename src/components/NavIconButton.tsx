import React from 'react';

interface Props {
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export const NavIconButton = ({ icon, active = false, onClick }: Props) => (
  <button 
    onClick={onClick}
    className={`p-2 transition-colors ${active ? 'text-gray-900' : 'text-gray-400'}`}
  >
    {icon}
  </button>
);
