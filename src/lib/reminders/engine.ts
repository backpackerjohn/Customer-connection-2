import { Customer } from '../../types';
import { ReminderConfig } from './config';

export type ReminderKind = 
  | 'cadence' 
  | 'birthday' 
  | 'manual' 
  | 'followUp24h' 
  | 'referral48to72h' 
  | 'anniversary' 
  | 'holiday';

export interface DueReminder {
  customerId: string;
  dueDate: string; // YYYY-MM-DD
  reasons: ReminderKind[];
  labels: string[];
  isOverdue: boolean;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateString(s: string): Date {
  const dateStr = s.includes('T') ? s.split('T')[0] : s;
  const parts = dateStr.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function getDaysDiff(s1: string, s2: string): number {
  const d1 = parseDateString(s1);
  const d2 = parseDateString(s2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function rollNextCadence(today: Date, mode: 'lead' | 'buyer', config: ReminderConfig): string {
  const d = new Date(today);
  if (mode === 'lead') {
    const min = config.lead.cadenceDays.min;
    const max = config.lead.cadenceDays.max;
    const randDays = Math.floor(Math.random() * (max - min + 1)) + min;
    d.setDate(d.getDate() + randDays);
  } else {
    const min = config.buyer.cadenceMonths.min;
    const max = config.buyer.cadenceMonths.max;
    const randMonths = Math.floor(Math.random() * (max - min + 1)) + min;
    d.setMonth(d.getMonth() + randMonths);
  }
  return formatDateISO(d);
}

export function getDueReminders(customer: Customer, today: Date, config: ReminderConfig): DueReminder[] {
  if (!customer.id) return [];

  const todayStr = formatDateISO(today);
  const individualReminders: { dueDate: string; reason: ReminderKind; label?: string }[] = [];

  const hasPurchaseDate = 'purchaseDate' in customer && typeof customer.purchaseDate === 'string' && customer.purchaseDate.length > 0;

  // Look up holidays for today.getFullYear() and today.getFullYear() + 1
  const currentYearHolidays = config.holidays(today.getFullYear());
  const nextYearHolidays = config.holidays(today.getFullYear() + 1);
  const allHolidays = [...currentYearHolidays, ...nextYearHolidays];
  const combineWindowForHolidays = hasPurchaseDate ? config.buyer.combineWindowDays : config.lead.combineWindowDays;

  for (const h of allHolidays) {
    if (h.dateISO >= todayStr && getDaysDiff(todayStr, h.dateISO) <= combineWindowForHolidays) {
      individualReminders.push({
        dueDate: h.dateISO,
        reason: 'holiday',
        label: h.name
      });
    }
  }

  if (hasPurchaseDate) {
    const purchaseDate = parseDateString(customer.purchaseDate!);
    const daysSincePurchase = Math.floor((today.getTime() - purchaseDate.getTime()) / 86400000);
    const mode = daysSincePurchase < config.freshBuyer.windowDays ? 'freshBuyer' : 'buyer';

    if (mode === 'freshBuyer') {
      // 1. followUp24h: dueDate = purchaseDate + followUpHours; one-shot; fires until closed
      const followUpDueDateStr = formatDateISO(new Date(purchaseDate.getTime() + config.freshBuyer.followUpHours * 3600000));
      const lastContactStr = customer.lastContactedAt ? formatDateISO(new Date(customer.lastContactedAt)) : '';
      const isFollowUpClosed = lastContactStr && lastContactStr >= followUpDueDateStr;
      
      if (!isFollowUpClosed) {
        individualReminders.push({ dueDate: followUpDueDateStr, reason: 'followUp24h' });
      }

      // 2. referral48to72h: due if hoursSincePurchase >= min hours and referralAskedAt is not set
      const hoursSincePurchase = (today.getTime() - purchaseDate.getTime()) / 3600000;
      if (hoursSincePurchase >= config.freshBuyer.referralWindowHours.min && !customer.referralAskedAt) {
        const refDueDateStr = formatDateISO(new Date(purchaseDate.getTime() + config.freshBuyer.referralWindowHours.min * 3600000));
        individualReminders.push({ dueDate: refDueDateStr, reason: 'referral48to72h' });
      }

      // 3. Birthday
      if (customer.dob) {
        const todayMMDD = todayStr.substring(5, 10);
        const dobMMDD = customer.dob.substring(5, 10);
        if (todayMMDD === dobMMDD) {
          individualReminders.push({ dueDate: todayStr, reason: 'birthday', label: 'Birthday' });
        }
      }

      // 4. Manual
      if (customer.manualReminders && Array.isArray(customer.manualReminders)) {
        for (const rem of customer.manualReminders) {
          if (rem.date && rem.date <= todayStr) {
            individualReminders.push({ 
              dueDate: rem.date, 
              reason: 'manual', 
              label: rem.reason 
            });
          }
        }
      }

      if (individualReminders.length === 0) return [];

      // Sort ascending by target date
      individualReminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      // Fresh buyers get NO combining — return each prescribed reminder as its own DueReminder
      return individualReminders.map(item => ({
        customerId: customer.id!,
        dueDate: item.dueDate,
        reasons: [item.reason],
        labels: item.label ? [item.label] : [],
        isOverdue: item.dueDate < todayStr
      }));
    } else {
      // mode === 'buyer'
      // 1. Cadence
      const nextCadence = customer.nextCadenceDue;
      if (!nextCadence) {
        const startStr = customer.lastContactedAt ? formatDateISO(new Date(customer.lastContactedAt)) : customer.purchaseDate!;
        const defaultCadence = rollNextCadence(parseDateString(startStr), 'buyer', config);
        if (defaultCadence <= todayStr) {
          individualReminders.push({ dueDate: defaultCadence, reason: 'cadence' });
        }
      } else if (nextCadence <= todayStr) {
        individualReminders.push({ dueDate: nextCadence, reason: 'cadence' });
      }

      // 2. Anniversary: yearly MM-DD equal, yearsSincePurchase >= 1
      const todayMMDD = todayStr.substring(5, 10);
      const purchaseMMDD = customer.purchaseDate!.substring(5, 10);
      const purchaseYear = parseDateString(customer.purchaseDate!).getFullYear();
      const todayYear = today.getFullYear();
      if (todayMMDD === purchaseMMDD && todayYear > purchaseYear) {
        individualReminders.push({ dueDate: todayStr, reason: 'anniversary' });
      }

      // 3. Birthday
      if (customer.dob) {
        const todayMMDD = todayStr.substring(5, 10);
        const dobMMDD = customer.dob.substring(5, 10);
        if (todayMMDD === dobMMDD) {
          individualReminders.push({ dueDate: todayStr, reason: 'birthday', label: 'Birthday' });
        }
      }

      // 4. Manual
      if (customer.manualReminders && Array.isArray(customer.manualReminders)) {
        for (const rem of customer.manualReminders) {
          if (rem.date && rem.date <= todayStr) {
            individualReminders.push({ 
              dueDate: rem.date, 
              reason: 'manual', 
              label: rem.reason 
            });
          }
        }
      }
    }
  } else {
    // Lead behavior (unchanged)
    // 1. Cadence
    const nextCadence = customer.nextCadenceDue;
    if (!nextCadence) {
      individualReminders.push({ dueDate: todayStr, reason: 'cadence' });
    } else if (nextCadence <= todayStr) {
      individualReminders.push({ dueDate: nextCadence, reason: 'cadence' });
    }

    // 2. Birthday
    if (customer.dob) {
      const todayMMDD = todayStr.substring(5, 10);
      const dobMMDD = customer.dob.substring(5, 10);
      if (todayMMDD === dobMMDD) {
        individualReminders.push({ dueDate: todayStr, reason: 'birthday', label: 'Birthday' });
      }
    }

    // 3. Manual
    if (customer.manualReminders && Array.isArray(customer.manualReminders)) {
      for (const rem of customer.manualReminders) {
        if (rem.date && rem.date <= todayStr) {
          individualReminders.push({ 
            dueDate: rem.date, 
            reason: 'manual', 
            label: rem.reason 
          });
        }
      }
    }
  }

  if (individualReminders.length === 0) return [];

  // Sort ascending by target date
  individualReminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const combineWindow = hasPurchaseDate ? config.buyer.combineWindowDays : config.lead.combineWindowDays;
  const groups: typeof individualReminders[] = [];

  for (const rem of individualReminders) {
    let merged = false;
    for (const group of groups) {
      const minDate = group[0].dueDate;
      if (getDaysDiff(minDate, rem.dueDate) <= combineWindow) {
        group.push(rem);
        merged = true;
        break;
      }
    }
    if (!merged) {
      groups.push([rem]);
    }
  }

  return groups.map(group => {
    group.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const earliestDueDate = group[0].dueDate;

    const reasonsSet = new Set<ReminderKind>();
    for (const item of group) {
      reasonsSet.add(item.reason);
    }
    const reasons = Array.from(reasonsSet);

    const labelsSet = new Set<string>();
    for (const item of group) {
      if (item.label) {
        labelsSet.add(item.label);
      }
    }
    const labels = Array.from(labelsSet);
    const isOverdue = earliestDueDate < todayStr;

    return {
      customerId: customer.id!,
      dueDate: earliestDueDate,
      reasons,
      labels,
      isOverdue
    };
  });
}

export function recordContact(
  customer: Customer,
  when: Date,
  closedKinds: ReminderKind[],
  config: ReminderConfig
): Customer {
  const whenStr = formatDateISO(when);
  const updated = { ...customer };

  updated.lastContactedAt = when.toISOString();

  if (closedKinds.includes('cadence')) {
    const mode = 'purchaseDate' in customer && customer.purchaseDate ? 'buyer' : 'lead';
    updated.nextCadenceDue = rollNextCadence(when, mode, config);
  }

  if (closedKinds.includes('manual') && updated.manualReminders) {
    updated.manualReminders = updated.manualReminders.filter(rem => rem.date > whenStr);
  }

  return updated;
}

export function computeNextCadenceDue(customer: Customer, config: ReminderConfig): string {
  let nextDue = customer.nextCadenceDue || rollNextCadence(new Date(), 'purchaseDate' in customer && customer.purchaseDate ? 'buyer' : 'lead', config);
  
  if (customer.manualReminders && Array.isArray(customer.manualReminders)) {
    for (const rem of customer.manualReminders) {
      if (rem.date && rem.date < nextDue) {
        nextDue = rem.date;
      }
    }
  }
  return nextDue;
}
