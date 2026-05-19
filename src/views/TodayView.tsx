import React from 'react';
import { Bell } from 'lucide-react';
import { Customer } from '../types';
import { getDueReminders, ReminderKind } from '../lib/reminders/engine';
import { REMINDER_CONFIG } from '../lib/reminders/config';
import { TextedCheckbox } from '../components/TextedCheckbox';
import { RescheduleButton } from '../components/RescheduleButton';

interface Props {
  customers: Customer[];
  onTexted: (customerId: string, when: Date, closedKinds: ReminderKind[]) => void;
  onReschedule: (customerId: string, date: string, reason: string) => void;
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

export function TodayView({ customers, onTexted, onReschedule }: Props) {
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

            return (
              <div 
                key={customer.id} 
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-lg text-gray-900 truncate">
                      {customer.firstName} {customer.middleInitial ? customer.middleInitial + ' ' : ''}{customer.lastName}
                    </h3>
                    
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                      {formattedReasons}
                    </span>

                    {isOverdue && overdueText && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100 animate-pulse">
                        {overdueText}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1 font-medium">
                    {customer.phone && <span>{customer.phone}</span>}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
