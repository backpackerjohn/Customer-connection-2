import React, { useState } from 'react';
import { BookmarkPlus, Check, Loader2, Search, X } from 'lucide-react';
import { Customer, Lender, PayoffLender } from '../types';
import { InputField } from './InputField';
import { exactLender, lenderFromSnapshot, matchLenders, snapshotDiffersFromLender, snapshotFromLender, stripUndefined } from '../lib/lenders';
import { createLender, updateLender } from '../services/lendersService';
import { lookupLender, LenderLookupResult } from '../services/lenderLookupService';

interface Props {
  customer: Customer;
  onChange: (patch: Partial<Customer>) => void;
  /** The shared lender library (subscribed in App). */
  lenders: Lender[];
  /** Signed-in dealer, stamped as createdBy on new library records. */
  userId: string;
}

/**
 * The bank half of the payoff sheet. The Lienholder box doubles as a picker
 * over the shared lender library; an unknown bank can be looked up on the web
 * and, once the dealer confirms it, saved to the library so it is never looked
 * up again. Bank details are copied onto the customer as a snapshot.
 */
export function PayoffLenderPanel({ customer, onChange, lenders, userId }: Props) {
  const name = customer.lienholder ?? '';
  const snap = customer.payoffLender;
  const [focused, setFocused] = useState(false);
  const [lookup, setLookup] = useState<LenderLookupResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const linked = snap?.lenderId ? lenders.find(l => l.id === snap.lenderId) ?? null : null;
  const exact = exactLender(lenders, name);
  const suggestions = focused && !linked ? matchLenders(lenders, name) : [];
  const drifted = linked ? snapshotDiffersFromLender(name, snap, linked) : false;
  const hasDetails = !!(snap?.phone || snap?.address);

  const setSnap = (patch: Partial<PayoffLender>) => onChange({ payoffLender: stripUndefined({ ...(snap ?? {}), ...patch }) });
  const applyLender = (l: Lender) => { onChange({ lienholder: l.name, payoffLender: snapshotFromLender(l) }); setLookup(null); setError(null); };
  const say = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(null), 2500); };

  const runLookup = async () => {
    if (isLookingUp || name.trim().length < 2) return;
    setIsLookingUp(true); setError(null); setLookup(null);
    try { setLookup(await lookupLender(name)); }
    catch (err) { setError(err instanceof Error ? `Lookup failed (${err.message})` : 'Lookup failed.'); }
    finally { setIsLookingUp(false); }
  };

  /** Save the current name + snapshot to the library (new record, or update the one it points to / matches). */
  const saveToLibrary = async (source: string, details: PayoffLender = snap ?? {}, lenderName = name) => {
    if (isSaving || !lenderName.trim()) return;
    setIsSaving(true); setError(null);
    try {
      const target = linked ?? exactLender(lenders, lenderName);
      const record = lenderFromSnapshot(lenderName, details, userId, { sources: source, verified: true });
      let id = target?.id;
      if (id) {
        const { createdBy: _cb, ...patch } = record; void _cb;
        await updateLender(id, patch);
      } else {
        id = await createLender(record);
      }
      onChange({ lienholder: record.name, payoffLender: stripUndefined({ ...details, state: record.state, lenderId: id }) });
      say(target ? 'Saved lender updated' : 'Saved to lender library');
    } catch (err) {
      console.error('Lender save failed:', err);
      setError('Could not save to the lender library. Check the Firestore rules are deployed.');
    } finally { setIsSaving(false); }
  };

  const useLookup = async () => {
    if (!lookup) return;
    const details: PayoffLender = stripUndefined({ phone: lookup.phone, address: lookup.address, city: lookup.city, state: lookup.state, zip: lookup.zip });
    const source = lookup.verified && lookup.sources.length ? lookup.sources.join(', ') : 'model knowledge, not web-verified';
    await saveToLibrary(source, details, lookup.name);
    setLookup(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex gap-2 items-end">
          <InputFieldWithFocus label="Lienholder / Bank" value={name} onChange={v => { onChange({ lienholder: v }); if (linked) setSnap({ lenderId: undefined }); }} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} />
          {!linked && !exact && (
            <button type="button" onClick={runLookup} disabled={isLookingUp || name.trim().length < 2}
              className="shrink-0 flex items-center gap-1.5 px-3 py-3 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-40" aria-label="Look up lender payoff details">
              {isLookingUp ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Look up
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {suggestions.map(l => (
              <li key={l.id}>
                <button type="button" onMouseDown={e => { e.preventDefault(); applyLender(l); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm">
                  <span className="font-semibold">{l.name}</span>
                  <span className="text-gray-400 ml-2 text-xs">{[l.city, l.state].filter(Boolean).join(', ')}{l.phone ? ` · ${l.phone}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status line */}
      <div className="text-xs px-1 min-h-[1rem]">
        {flash ? <span className="text-emerald-700 font-semibold">{flash}</span>
        : linked ? <span className="text-emerald-700 flex items-center gap-1"><Check size={12} /> Saved lender{linked.verified ? '' : ' (unverified)'}{linked.sources ? ` · ${linked.sources}` : ''}</span>
        : exact ? <button type="button" onClick={() => applyLender(exact)} className="text-blue-700 font-semibold underline">Use saved: {exact.name}</button>
        : name.trim() ? <span className="text-gray-400">Not in the lender library. Look it up, or type the details and save.</span>
        : null}
      </div>

      {error && <p className="text-xs text-red-600 px-1">{error}</p>}

      {/* Lookup result: confirm before anything is saved */}
      {lookup && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm">
          <div className="font-bold">{lookup.name}</div>
          <div>{lookup.phone ?? <span className="text-gray-400">phone not found</span>}</div>
          <div>{lookup.address ?? <span className="text-gray-400">overnight address not found</span>}</div>
          <div>{[lookup.city, lookup.state, lookup.zip].filter(Boolean).join(', ')}</div>
          {lookup.notes && <div className="text-xs text-amber-800">{lookup.notes}</div>}
          <div className="text-xs text-gray-500">{lookup.verified && lookup.sources.length ? `Sources: ${lookup.sources.join(', ')}` : 'From model knowledge, not web-verified. Check it before saving.'}</div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={useLookup} disabled={isSaving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold disabled:opacity-40">
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Use &amp; save to library
            </button>
            <button type="button" onClick={() => setLookup(null)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold"><X size={14} /> Discard</button>
          </div>
        </div>
      )}

      {/* Bank details on this deal (editable snapshot) */}
      <InputField label="Payoff Phone" value={snap?.phone} onChange={v => setSnap({ phone: v })} />
      <InputField label="Overnight Payoff Address" value={snap?.address} onChange={v => setSnap({ address: v })} placeholder="Street address, not a PO Box" />
      <div className="grid grid-cols-3 gap-4">
        <InputField label="City" value={snap?.city} onChange={v => setSnap({ city: v })} />
        <InputField label="State" value={snap?.state} onChange={v => setSnap({ state: v.toUpperCase() })} />
        <InputField label="Zip" value={snap?.zip} onChange={v => setSnap({ zip: v })} />
      </div>
      {name.trim() && hasDetails && (!linked || drifted) && (
        <button type="button" onClick={() => saveToLibrary('dealer')} disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs font-bold disabled:opacity-40">
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />} {linked ? 'Update saved lender' : 'Save to lender library'}
        </button>
      )}
    </div>
  );
}

/** InputField with focus callbacks, for the suggestion list. Same look as InputField. */
function InputFieldWithFocus({ label, value, onChange, onFocus, onBlur }: { label: string; value: string; onChange: (v: string) => void; onFocus: () => void; onBlur: () => void }) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1 leading-none">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} autoComplete="off"
        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 transition-all font-medium text-sm" />
    </div>
  );
}
