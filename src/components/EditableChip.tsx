import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T | undefined;
  options: Option<T>[];
  onChange: (newValue: T | undefined) => void;
  placeholder?: string;        // shown when value is undefined; defaults to "—"
  color?: 'blue' | 'emerald' | 'gray' | 'amber';
  allowClear?: boolean;        // if true, popover offers a "— None —" option
  disabled?: boolean;
}

const COLOR_CLASSES: Record<NonNullable<Props<string>['color']>, string> = {
  blue: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-50',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  gray: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-50',
  amber: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-50',
};

export function EditableChip<T extends string>({
  value,
  options,
  onChange,
  placeholder = '—',
  color = 'gray',
  allowClear = false,
  disabled = false,
}: Props<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [isOpen]);

  const currentLabel = options.find(o => o.value === value)?.label ?? placeholder;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(prev => !prev);
        }}
        disabled={disabled}
        className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 transition-colors ${COLOR_CLASSES[color]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span>{currentLabel}</span>
        <ChevronDown size={11} className="opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 min-w-[10rem] bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          {allowClear && (
            <button
              type="button"
              onClick={() => { onChange(undefined); setIsOpen(false); }}
              className="w-full text-left text-xs px-3 py-2 text-gray-500 hover:bg-gray-50 flex items-center justify-between italic"
            >
              <span>— None —</span>
              {value === undefined && <Check size={12} className="text-gray-400" />}
            </button>
          )}
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className="w-full text-left text-xs px-3 py-2 text-gray-800 hover:bg-gray-50 flex items-center justify-between"
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={12} className="text-gray-700" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
