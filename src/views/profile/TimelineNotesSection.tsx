import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Customer, Note } from '../../types';

interface Props {
  customer: Customer;
  notes: Note[];
  newNote: string;
  onNewNoteChange: (note: string) => void;
  onAddNote: () => void;
}

export function TimelineNotesSection({ customer, notes, newNote, onNewNoteChange, onAddNote }: Props) {
  return (
    <section className="space-y-4">
      {customer.id && null}
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
          <MessageSquare size={18} />
        </div>
        <h2 className="text-xl font-bold">Timeline & Notes</h2>
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
              className="bg-gray-900 text-white p-2 rounded-xl disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
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
