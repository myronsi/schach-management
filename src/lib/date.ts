const pad = (value: number) => String(value).padStart(2, '0');

export const formatDateForAPI = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatDateTimeForAPI = (date: Date): string =>
  `${formatDateForAPI(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

export const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.trim().slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const todayLocal = (): string => formatDateForAPI(new Date());

const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

export const addMonthsClamped = (start: Date, months: number): Date => {
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const day = Math.min(start.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), day);
};

export const addMonthsSameWeekday = (start: Date, months: number): Date => {
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const occurrence = Math.ceil(start.getDate() / 7);
  const firstMatch = 1 + ((start.getDay() - target.getDay() + 7) % 7);
  const lastMatch = firstMatch + Math.floor((daysInMonth(year, month) - firstMatch) / 7) * 7;
  return new Date(year, month, Math.min(firstMatch + (occurrence - 1) * 7, lastMatch));
};
