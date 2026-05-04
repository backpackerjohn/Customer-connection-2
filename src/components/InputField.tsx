import React from 'react';

interface Props {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

export const InputField = ({ label, value, onChange, type = "text", placeholder = "" }: Props) => (
  <div className="space-y-1.5 flex-1">
    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1 leading-none">{label}</label>
    <input 
      type={type}
      placeholder={placeholder}
      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 transition-all font-medium text-sm"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);
