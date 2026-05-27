import React from 'react';

interface SegOption<T extends string> {
  value: T;
  label: string;
  activeClass?: string;
}

interface Props<T extends string> {
  value: T;
  options: SegOption<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="inline-flex rounded-full bg-gray-100 p-0.5 border border-gray-200">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full transition-colors ${
              active ? (opt.activeClass ?? 'bg-gray-900 text-white') : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
