import React from 'react';
import { MessageSquare, Plus, Calendar, Bell, Trash2 } from 'lucide-react';
import { Customer, Note } from '../../types';

interface Props {
  customer: Customer;
  notes: Note[];
  newNote: string;
  onNewNoteChange: (note: string) => void;
  onAddNote: () => void;
  onChange: (patch: Partial<Customer>) => void;
}

export function TimelineNotesSection({ customer, notes, newNote, onNewNoteChange, onAddNote, onChange }: Props) {
  const handleDeleteReminder = (indexToDelete: number) => {
    if (!customer.manualReminders) return;
    const updated = customer.manualReminders.filter((_, idx) => idx !== indexToDelete);
    onChange({ manualReminders: updated });
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Never';
    try {
      if (isoStr.includes('-') && !isoStr.includes('T')) {
        const parts = isoStr.split('-');
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return date.toLocaleDateString([], { dateStyle: 'medium' });
      }
      return new Date(isoStr).toLocaleDateString([], { dateStyle: 'medium' });
    } catch {
      return isoStr;
    }
  };

  return (
    <section className="space-y-4">
      {customer.id && null}
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
          <MessageSquare size={18} />
        </div>
        <h2 className="text-xl font-bold">Timeline & Notes</h2>
      </div>

      {/* Cadence & Reminders Card */}
      <div className="card p-6 space-y-4 bg-white border border-gray-100 rounded-2xl shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Relationship Cadence</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Last Contacted</span>
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" />
              {formatDate(customer.lastContactedAt)}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Next Cadence Due</span>
            <span className="text-sm font-semibold text-gray-850 flex items-center gap-1.5">
              <Bell size={14} className="text-gray-400" />
              {formatDate(customer.nextCadenceDue)}
            </span>
          </div>
        </div>

        {customer.purchaseDate && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Referral Status</span>
            <span className="font-semibold text-gray-800">
              {customer.referralAskedAt ? `Referral asked: ${formatDate(customer.referralAskedAt)}` : 'Referral not yet asked'}
            </span>
          </div>
        )}

        {/* Custom Follow-Ups Sub-section */}
        <div className="pt-2 border-t border-gray-100 space-y-3">
          <span className="text-[10px] font-bold text-gray-405 uppercase tracking-widest block">Custom Follow-Ups</span>
          
          {!customer.manualReminders || customer.manualReminders.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No custom follow-up reminders scheduled.</p>
          ) : (
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
              {customer.manualReminders.map((rem, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg text-xs hover:bg-neutral-100/60 transition-colors">
                  <div className="min-w-0">
                    <span className="font-semibold text-neutral-700 block">{formatDate(rem.date)}</span>
                    <span className="text-neutral-500 font-medium truncate block">{rem.reason}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteReminder(idx)}
                    className="text-neutral-400 hover:text-red-650 p-1 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer"
                    title="Delete Reminder"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="card overflow-hidden">
        {/* Add Note Input */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="Add a discovery note..."
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none transition-all"
              value={newNote}
              onChange={(e) => onNewNoteChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddNote()}
            />
            <button 
              onClick={onAddNote}
              disabled={!newNote.trim()}
              className="bg-gray-900 text-white p-2 rounded-xl disabled:opacity-30 disabled:grayscale transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Notes Feed */}
        <div className="divide-y divide-gray-50 flex flex-col max-h-[400px] overflow-y-auto">
          {notes.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <MessageSquare size={24} className="mx-auto opacity-20" />
              <p className="text-xs font-medium uppercase tracking-widest">No notes yet</p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="p-4 space-y-2 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    note.type === 'ai' ? 'text-indigo-500' : 'text-gray-400'
                  }`}>
                    {note.type === 'ai' ? 'Ai Discovery' : 'Manual Entry'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pending...'}
                  </span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
