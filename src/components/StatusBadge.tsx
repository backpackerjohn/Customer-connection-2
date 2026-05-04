import React from 'react';

interface Props {
  status: string;
}

export const StatusBadge = ({ status }: Props) => {
  const colors = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    lead: 'bg-blue-100 text-blue-700'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[status as keyof typeof colors]}`}>
      {status}
    </span>
  );
};
