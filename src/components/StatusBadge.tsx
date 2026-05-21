import React from 'react';

interface Props {
  status: string;
}

// Internal value 'lead' displays as "Unsold" to dealers.
const LABELS: Record<string, string> = {
  lead: 'Unsold',
  sold: 'Sold',
  inactive: 'Inactive',
};

const COLORS: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700',
  sold: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export const StatusBadge = ({ status }: Props) => {
  const label = LABELS[status] ?? status;
  const color = COLORS[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {label}
    </span>
  );
};
