const pad = (value: number) => String(value).padStart(2, '0');

/** Formats a Date as local `yyyy-MM-dd` (no UTC conversion). */
export const formatDateForAPI = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Formats a Date as local `yyyy-MM-dd HH:mm:ss` (no UTC conversion). */
export const formatDateTimeForAPI = (date: Date): string =>
  `${formatDateForAPI(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/** Parses a `yyyy-MM-dd` string (optionally followed by a time part) as a local date at midnight. */
export const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.trim().slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Today's local date as `yyyy-MM-dd`. */
export const todayLocal = (): string => formatDateForAPI(new Date());

const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

/**
 * Returns the same day-of-month `months` months after `start`, clamped to the last day of the
 * target month (e.g. 31 Jan + 1 month -> 28/29 Feb instead of overflowing into March).
 */
export const addMonthsClamped = (start: Date, months: number): Date => {
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const day = Math.min(start.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), day);
};

/**
 * Returns the date `months` months after `start` that falls on the same weekday occurrence
 * (e.g. 2nd Tuesday). A 5th occurrence that does not exist in the target month is clamped to the
 * last occurrence of that weekday in the target month.
 */
export const addMonthsSameWeekday = (start: Date, months: number): Date => {
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const occurrence = Math.ceil(start.getDate() / 7); // 1..5
  const firstMatch = 1 + ((start.getDay() - target.getDay() + 7) % 7);
  const lastMatch = firstMatch + Math.floor((daysInMonth(year, month) - firstMatch) / 7) * 7;
  return new Date(year, month, Math.min(firstMatch + (occurrence - 1) * 7, lastMatch));
};
