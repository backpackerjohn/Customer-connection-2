import React from 'react';
import { LEAD_SOURCE_TAXONOMY, findLeadSourceGroup, LeadSourceValue } from '../lib/leadSource';

interface Props {
  value: LeadSourceValue | undefined;
  onChange: (value: LeadSourceValue | undefined) => void;
}

export function LeadSourceChips({ value, onChange }: Props) {
  const selectedGroup = findLeadSourceGroup(value);

  const chipClass = (state: 'selected' | 'group' | 'default') => {
    const base = 'text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border transition-colors';
    if (state === 'selected') return `${base} bg-gray-900 text-white border-gray-900`;
    if (state === 'group') return `${base} bg-gray-200 text-gray-800 border-gray-300`;
    return `${base} bg-white text-gray-600 border-gray-200 hover:bg-gray-50`;
  };

  const pick = (v: LeadSourceValue) => {
    if (v === value) onChange(undefined);
    else onChange(v);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {LEAD_SOURCE_TAXONOMY.map(group => {
          const isExact = value === group.value;
          const isGroup = !isExact && selectedGroup?.value === group.value;
          return (
            <button
              key={group.value}
              type="button"
              onClick={() => pick(group.value)}
              className={chipClass(isExact ? 'selected' : isGroup ? 'group' : 'default')}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {selectedGroup && selectedGroup.children.length > 0 && (
        <div className="flex flex-wrap gap-2 ml-1 pl-3 border-l-2 border-gray-200">
          {selectedGroup.children.map(child => (
            <button
              key={child.value}
              type="button"
              onClick={() => pick(child.value)}
              className={chipClass(value === child.value ? 'selected' : 'default')}
            >
              {child.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
