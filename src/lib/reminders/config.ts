function formatYMD(year: number, month: number, day: number): string {
  const mm = month < 10 ? `0${month}` : `${month}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${year}-${mm}-${dd}`;
}

function getEasterDateString(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return formatYMD(year, month, day);
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): string {
  if (nth > 0) {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const d = new Date(year, month - 1, day);
      if (d.getMonth() !== month - 1) break;
      if (d.getDay() === weekday) {
        count++;
        if (count === nth) {
          return formatYMD(year, month, day);
        }
      }
    }
  } else {
    for (let day = 31; day >= 1; day--) {
      const d = new Date(year, month - 1, day);
      if (d.getMonth() === month - 1 && d.getDay() === weekday) {
        return formatYMD(year, month, day);
      }
    }
  }
  return "";
}

export const REMINDER_CONFIG = {
  lead: {
    cadenceDays: { min: 26, max: 30 },
    combineWindowDays: 7,
  },
  freshBuyer: {
    windowDays: 7,
    followUpHours: 24,
    referralWindowHours: { min: 48, max: 72 },
  },
  buyer: {
    cadenceMonths: { min: 3, max: 6 },
    combineWindowDays: 7,
  },
  holidays: (year: number): Array<{ dateISO: string; name: string }> => {
    return [
      { dateISO: formatYMD(year, 1, 1), name: "New Year's Day" },
      { dateISO: formatYMD(year, 2, 14), name: "Valentine's Day" },
      { dateISO: getEasterDateString(year), name: "Easter" },
      { dateISO: getNthWeekdayOfMonth(year, 5, 0, 2), name: "Mother's Day" },
      { dateISO: getNthWeekdayOfMonth(year, 5, 1, -1), name: "Memorial Day" },
      { dateISO: getNthWeekdayOfMonth(year, 6, 0, 3), name: "Father's Day" },
      { dateISO: formatYMD(year, 7, 4), name: "Independence Day" },
      { dateISO: getNthWeekdayOfMonth(year, 9, 1, 1), name: "Labor Day" },
      { dateISO: formatYMD(year, 10, 31), name: "Halloween" },
      { dateISO: getNthWeekdayOfMonth(year, 11, 4, 4), name: "Thanksgiving" },
      { dateISO: formatYMD(year, 12, 24), name: "Christmas Eve" },
      { dateISO: formatYMD(year, 12, 25), name: "Christmas Day" },
      { dateISO: formatYMD(year, 12, 31), name: "New Year's Eve" },
    ];
  }
};

export type ReminderConfig = typeof REMINDER_CONFIG;
