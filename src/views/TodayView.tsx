import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { User } from 'firebase/auth';
import { Customer, Note } from '../types';
import { getDueReminders, ReminderKind } from '../lib/reminders/engine';
import { REMINDER_CONFIG } from '../lib/reminders/config';
import { TextedCheckbox } from '../components/TextedCheckbox';
import { RescheduleButton } from '../components/RescheduleButton';
import { CopyButton } from '../components/CopyButton';
import { renderTemplate, getDefaultModelYear } from '../lib/templateRenderer';
import { subscribeToNotes } from '../services/notesService';
import { handleFirestoreError, OperationType } from '../lib/firebase';

interface Props {
  customers: Customer[];
  onTexted: (customerId: string, when: Date, closedKinds: ReminderKind[]) => void;
  onReschedule: (customerId: string, date: string, reason: string) => void;
  user: User | null;
  onAddNote: (customerId: string, content: string) => Promise<void>;
}

const REASON_LABELS: Record<ReminderKind, string> = {
  cadence: 'Cadence',
  birthday: 'Birthday',
  manual: 'Manual Follow Up',
  followUp24h: '24h Follow Up',
  referral48to72h: 'Referral Check',
  anniversary: 'Anniversary',
  holiday: 'Holiday',
};

export function TodayView({ customers, onTexted, onReschedule, user, onAddNote }: Props) {
  const [template, setTemplate] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('todayTemplate') ?? '';
  });

  const [modelYear, setModelYear] = useState<string>(() => {
    if (typeof window === 'undefined') return getDefaultModelYear();
    return localStorage.getItem('latestModelYear') ?? getDefaultModelYear();
  });

  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem('todayTemplate', template);
    }, 500);
    return () => clearTimeout(t);
  }, [template]);

  useEffect(() => {
    if (modelYear) localStorage.setItem('latestModelYear', modelYear);
  }, [modelYear]);

  useEffect(() => {
    if (!expandedCustomerId || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedNotes([]);
      return;
    }
    const unsubscribe = subscribeToNotes(
      expandedCustomerId,
      user.uid,
      setExpandedNotes,
      (err) => handleFirestoreError(err, OperationType.LIST, `customers/${expandedCustomerId}/notes`)
    );
    return () => unsubscribe();
  }, [expandedCustomerId, user]);

  const toggleExpand = (customerId: string) => {
    setExpandedCustomerId(prev => prev === customerId ? null : customerId);
    setNewNoteText('');
  };

  const handleAddNoteClick = async () => {
    if (!expandedCustomerId || !newNoteText.trim()) return;
    await onAddNote(expandedCustomerId, newNoteText.trim());
    setNewNoteText('');
  };

  const today = new Date();

  const entries = customers
    .map(customer => {
      const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
      return {
        customer,
        reminders,
        primaryReminder: reminders[0]
      };
    })
    .filter(entry => entry.reminders.length > 0)
    .sort((a, b) => a.primaryReminder.dueDate.localeCompare(b.primaryReminder.dueDate));

  const getDaysOverdueText = (dueDateStr: string): string | null => {
    const parts = dueDateStr.split('-');
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - due.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (days <= 0) return null;
    return days === 1 ? '1 day overdue' : `${days} days overdue`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-24 md:pb-8">
      <header className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Today's Outreach</h2>
        <p className="text-gray-500">
          Dealers self-report via Checkbox. Keep cadences rolling and relationships strong.
        </p>
      </header>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Text Template</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Current model year:</label>
            <input
              type="number"
              value={modelYear}
              onChange={(e) => setModelYear(e.target.value)}
              min={2000}
              max={2100}
              step={1}
              className="w-20 text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Paste a template. Use [name], [trade model], [trade year], [vehicle model], [vehicle year], or [latest model year]."
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-gray-400 resize-y"
        />
        <p className="text-xs text-gray-400">
          Placeholders:{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[name]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[trade model]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[trade year]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[vehicle model]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[vehicle year]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[latest model year]</code>
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="py-20 text-center space-y-4 max-w-sm mx-auto">
          <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto shadow-xs border border-gray-100">
            <Bell className="text-neutral-300" size={24} />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-lg text-gray-900">All caught up!</p>
            <p className="text-gray-500 text-sm">
              No dealers need outreach today. New reminders will populate automatically based on your cadence rules.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-xs">
          {entries.map(({ customer, primaryReminder }) => {
            const holidayLabels = primaryReminder.labels.filter(lbl => 
              REMINDER_CONFIG.holidays(today.getFullYear()).some(h => h.name === lbl) ||
              REMINDER_CONFIG.holidays(today.getFullYear() + 1).some(h => h.name === lbl)
            );

            const formattedReasons = primaryReminder.reasons
              .map(kind => {
                if (kind === 'holiday' && holidayLabels.length > 0) {
                  return holidayLabels.join(' & ');
                }
                return REASON_LABELS[kind] || kind;
              })
              .join(' + ');

            const isOverdue = primaryReminder.isOverdue;
            const overdueText = getDaysOverdueText(primaryReminder.dueDate);

            const personalizedText = template.trim()
              ? renderTemplate(template, customer, modelYear)
              : '';

            return (
              <div 
                key={customer.id} 
                className="p-5 hover:bg-neutral-50/50 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-lg text-gray-900 truncate">
                      {customer.firstName} {customer.middleInitial ? customer.middleInitial + ' ' : ''}{customer.lastName}
                    </h3>
                    <CopyButton value={`${customer.firstName} ${customer.lastName}`.trim()} />
                    
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                      {formattedReasons}
                    </span>

                    {isOverdue && overdueText && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100 animate-pulse">
                        {overdueText}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-500 flex flex-wrap gap-x-3 gap-y-1 font-medium items-center">
                    {customer.phone && (
                      <span className="flex items-center gap-1">
                        {customer.phone}
                        <CopyButton value={customer.phone} />
                      </span>
                    )}
                    {customer.email && <span>{customer.email}</span>}
                    {primaryReminder.labels.filter(lbl => !holidayLabels.includes(lbl)).length > 0 && (
                      <span className="text-neutral-400 italic">
                        "{primaryReminder.labels.filter(lbl => !holidayLabels.includes(lbl)).join(', ')}"
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <RescheduleButton 
                    customerId={customer.id!}
                    onReschedule={onReschedule}
                  />
                  <div className="bg-neutral-50 border border-gray-150 rounded-xl px-4 py-2 transition-colors">
                    <TextedCheckbox 
                      customerId={customer.id!}
                      closedKinds={primaryReminder.reasons}
                      onTexted={onTexted}
                    />
                  </div>
                </div>
                </div>
                {personalizedText && (
                  <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">
                      {personalizedText}
                    </p>
                    <CopyButton 
                      value={personalizedText} 
                      label="Copy" 
                      className="bg-white border border-gray-200 shrink-0"
                    />
                  </div>
                )}

                {expandedCustomerId !== customer.id ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(customer.id!)}
                    className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-gray-400" />
                      Notes
                    </span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                ) : (
                  <div className="mt-3 border border-gray-100 rounded-xl bg-white overflow-hidden">
                    {/* Collapse header */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(customer.id!)}
                      className="w-full flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 text-xs font-medium text-gray-600 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-gray-400" />
                        Notes ({expandedNotes.length})
                      </span>
                      <ChevronUp size={14} className="text-gray-400" />
                    </button>

                    {/* Add-note input (mirrors TimelineNotesSection's add-note row exactly) */}
                    <div className="p-4 bg-gray-50/50 border-b border-gray-100">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a discovery note..."
                          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddNoteClick()}
                        />
                        <button
                          onClick={handleAddNoteClick}
                          disabled={!newNoteText.trim()}
                          className="bg-gray-900 text-white p-2 rounded-xl disabled:opacity-30 disabled:grayscale transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Notes feed (mirrors TimelineNotesSection's notes feed exactly) */}
                    <div className="divide-y divide-gray-50 flex flex-col max-h-[400px] overflow-y-auto">
                      {expandedNotes.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 space-y-2">
                          <MessageSquare size={24} className="mx-auto opacity-20" />
                          <p className="text-xs font-medium uppercase tracking-widest">No notes yet</p>
                        </div>
                      ) : (
                        expandedNotes.map((note) => (
                          <div key={note.id} className="p-4 space-y-2 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                note.type === 'ai' ? 'text-indigo-500' : 'text-gray-400'
                              }`}>
                                {note.type === 'ai' ? 'Ai Discovery' : 'Manual Entry'}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {note.createdAt?.seconds
                                  ? new Date(note.createdAt.seconds * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                                  : 'Pending...'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
