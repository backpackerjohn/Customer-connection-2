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

  if (hasPurchaseDate) {
    const purchaseDate = parseDateString(customer.purchaseDate!);
    const daysSincePurchase = Math.floor((today.getTime() - purchaseDate.getTime()) / 86400000);
    const isFreshBuyer = daysSincePurchase < config.freshBuyer.windowDays;

    if (isFreshBuyer) {
      // --- FRESH BUYER MODE ---
      // 1. followUp24h (FIX 6 with timestamp comparison)
      const purchaseTime = purchaseDate.getTime();
      const lastContactTime = customer.lastContactedAt ? new Date(customer.lastContactedAt).getTime() : 0;
      const isFollowUpClosed = lastContactTime > purchaseTime;

      const followUpDueDateStr = formatDateISO(new Date(purchaseDate.getTime() + config.freshBuyer.followUpHours * 3600000));
      if (!isFollowUpClosed) {
        individualReminders.push({ dueDate: followUpDueDateStr, reason: 'followUp24h' });
      }

      // 2. referral48to72h
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
    }
  }

  // --- NON-FRESH-BUYER MODE (either Lead or standard Buyer) ---

  // 1. Cadence
  if (hasPurchaseDate) {
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
  } else {
    // Lead behavior
    const nextCadence = customer.nextCadenceDue;
    if (!nextCadence) {
      individualReminders.push({ dueDate: todayStr, reason: 'cadence' });
    } else if (nextCadence <= todayStr) {
      individualReminders.push({ dueDate: nextCadence, reason: 'cadence' });
    }
  }

  // 2. Manual Reminders
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

  // 3. Calendar Reminders with candidate window (Grace Period + Combine Window)
  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
  const gracePeriodDays = config.calendarReminders?.gracePeriodDays ?? 7;
  const combineWindow = hasPurchaseDate ? config.buyer.combineWindowDays : config.lead.combineWindowDays;

  const minDate = new Date(today);
  minDate.setDate(today.getDate() - gracePeriodDays);
  const minDateStr = formatDateISO(minDate);

  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + combineWindow);
  const maxDateStr = formatDateISO(maxDate);

  const lastContactedPart = customer.lastContactedAt ? formatDateISO(new Date(customer.lastContactedAt)) : '';

  function addCandidate(dateISO: string, reason: ReminderKind, label?: string) {
    if (dateISO < minDateStr || dateISO > maxDateStr) {
      return;
    }
    const handled = !!lastContactedPart && lastContactedPart >= dateISO;
    if (!handled) {
      individualReminders.push({
        dueDate: dateISO,
        reason,
        label
      });
    }
  }

  // Birthday Candidates
  if (customer.dob) {
    const dobMMDD = customer.dob.substring(5, 10);
    for (const year of years) {
      addCandidate(`${year}-${dobMMDD}`, 'birthday', 'Birthday');
    }
  }

  // Anniversary Candidates
  if (hasPurchaseDate && customer.purchaseDate) {
    const purchaseMMDD = customer.purchaseDate.substring(5, 10);
    const purchaseDateObj = parseDateString(customer.purchaseDate);
    const firstAnniversaryDate = new Date(purchaseDateObj);
    firstAnniversaryDate.setFullYear(purchaseDateObj.getFullYear() + 1);
    const firstAnniversaryStr = formatDateISO(firstAnniversaryDate);

    if (today >= firstAnniversaryDate) {
      for (const year of years) {
        const dateISO = `${year}-${purchaseMMDD}`;
        if (dateISO >= firstAnniversaryStr) {
          addCandidate(dateISO, 'anniversary');
        }
      }
    }
  }

  // Holiday Candidates
  for (const year of years) {
    const holidaysForYear = config.holidays(year);
    for (const h of holidaysForYear) {
      addCandidate(h.dateISO, 'holiday', h.name);
    }
  }

  if (individualReminders.length === 0) return [];

  // Sort ascending by target date
  individualReminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Combine adjacent/nearby reminders
  const groups: typeof individualReminders[] = [];
  for (const rem of individualReminders) {
    let merged = false;
    for (const group of groups) {
      const minDateInGroup = group[0].dueDate;
      if (getDaysDiff(minDateInGroup, rem.dueDate) <= combineWindow) {
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

  const mode = 'purchaseDate' in customer && customer.purchaseDate ? 'buyer' : 'lead';
  updated.nextCadenceDue = rollNextCadence(when, mode, config);

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
