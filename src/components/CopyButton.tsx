import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  value: string;
  label?: string;
  className?: string;
}

/**
 * Small button that copies `value` to the clipboard and flashes a checkmark
 * for ~1.2 seconds. If `label` is provided, shows icon + label text;
 * otherwise icon only (use the `title` attribute for hover tooltip).
 */
export function CopyButton({ value, label, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Copy ${label || 'text'}`}
      className={`inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded-md hover:bg-gray-100 ${className}`}
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {label && <span className="font-medium">{copied ? 'Copied' : label}</span>}
    </button>
  );
}
