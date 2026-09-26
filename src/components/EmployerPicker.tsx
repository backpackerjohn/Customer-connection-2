import React, { useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { EmployerDetails, Near } from '../lib/employers';
import { lookupEmployer, EmployerCandidate } from '../services/employerLookupService';

interface Props {
  label: string;
  value?: string;
  onNameChange: (v: string) => void;
  /** Called with the chosen location; the caller maps it onto the right job's fields. */
  onPick: (e: EmployerDetails) => void;
  /** Search center: the applicant's home, then the store. */
  near: Near;
}

/**
 * Employer name box with a Find button. Find searches for that business near
 * the applicant's home and lists the matching locations, closest first; a tap
 * fills name, phone, street, city, state and zip. Nothing is stored beyond
 * the customer's own credit application.
 */
export function EmployerPicker({ label, value, onNameChange, onPick, near }: Props) {
  const [candidates, setCandidates] = useState<EmployerCandidate[] | null>(null);
  const [verified, setVerified] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = value ?? '';
  const nearText = [near.city, near.state].filter(Boolean).join(', ');

  const find = async () => {
    if (isSearching || name.trim().length < 2) return;
    setIsSearching(true); setError(null); setCandidates(null);
    try {
      const res = await lookupEmployer(name, near);
      setCandidates(res.candidates);
      setVerified(res.verified);
      if (!res.candidates.length) setError(`Nothing found for "${name.trim()}" near ${nearText}. Check the spelling or type the details.`);
    } catch (err) {
      setError(err instanceof Error ? `Search failed (${err.message})` : 'Search failed.');
    } finally { setIsSearching(false); }
  };

  const pick = (c: EmployerCandidate) => { onPick(c); setCandidates(null); setError(null); };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="space-y-1.5 flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1 leading-none">{label}</label>
          <input type="text" value={name} onChange={e => onNameChange(e.target.value)} autoComplete="off"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void find(); } }}
            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 transition-all font-medium text-sm" />
        </div>
        <button type="button" onClick={find} disabled={isSearching || name.trim().length < 2}
          className="shrink-0 flex items-center gap-1.5 px-3 py-3 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-40"
          aria-label={`Find ${label.toLowerCase()} near ${nearText}`}>
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Find
        </button>
      </div>
      {!candidates && !error && <p className="text-[11px] text-gray-400 px-1">Find searches near {nearText || 'the store'}.</p>}
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}
      {candidates && candidates.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-[11px] text-gray-500">
            <span><MapPin size={12} className="inline mr-1" />Locations near {nearText}{verified ? '' : ' · from memory, check before trusting'}</span>
            <button type="button" onClick={() => setCandidates(null)} aria-label="Dismiss"><X size={14} /></button>
          </div>
          {candidates.map((c, i) => (
            <button key={i} type="button" onClick={() => pick(c)} className="w-full text-left px-3 py-2.5 border-t border-gray-100 hover:bg-gray-50">
              <div className="text-sm font-semibold">{c.name}</div>
              <div className="text-xs text-gray-500">{[c.address, [c.city, c.state].filter(Boolean).join(', '), c.zip].filter(Boolean).join(' · ')}</div>
              <div className="text-xs text-gray-500">{c.phone ?? <span className="text-gray-400">no phone listed</span>}{c.note ? ` · ${c.note}` : ''}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
