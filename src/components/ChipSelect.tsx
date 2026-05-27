import React from 'react';

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T | undefined;
  options: ChipOption<T>[];
  onChange: (value: T | undefined) => void;
  allowClear?: boolean;
}

export function ChipSelect<T extends string>({ value, options, onChange, allowClear = false }: Props<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (active && allowClear) onChange(undefined);
              else onChange(opt.value);
            }}
            className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
