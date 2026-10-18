import { parseDateString, todayLocal } from '@/lib/date';

export interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  type?: string;
  is_recurring?: number;
  updated_at?: string;
  updated_by?: string;
}

export type FilterType = 'future' | 'past' | 'today';

export const filterOptions = [
  { value: 'future', label: 'Zukünftige Ereignisse' },
  { value: 'today', label: 'Ereignisse heute' },
  { value: 'past', label: 'Vergangene Ereignisse' }
];

export const filterEvents = (eventsToFilter: Event[], filter: FilterType) => {
  const todayStr = todayLocal();

  switch (filter) {
    case 'today':
      return eventsToFilter.filter(event => {
        if (!event.date) return false;
        if (event.date.includes(':')) {
          const [start, end] = event.date.split(':');
          return start <= todayStr && todayStr <= end;
        }
        return event.date === todayStr;
      });
    case 'past':
      return eventsToFilter.filter(event => {
        if (!event.date) return false;
        if (event.date.includes(':')) {
          const end = event.date.split(':')[1];
          return end < todayStr;
        }
        return event.date < todayStr;
      });
    case 'future':
    default:
      return eventsToFilter.filter(event => {
        if (!event.date) return false;
        if (event.date.includes(':')) {
          const end = event.date.split(':')[1];
          return end >= todayStr;
        }
        return event.date >= todayStr;
      });
  }
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes(':')) {
    const [start, end] = dateStr.split(':');
    const s = parseDateString(start);
    const e = parseDateString(end);
    const sStr = s.toLocaleDateString('de-DE');
    const eStr = e.toLocaleDateString('de-DE');
    return `${sStr} — ${eStr}`;
  }
  const date = parseDateString(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const getEventTypeColor = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'training': return 'bg-blue-50 border-blue-200';
    case 'tournament': return 'bg-green-50 border-green-200';
    case 'meeting': return 'bg-yellow-50 border-yellow-200';
    case 'holiday': return 'bg-red-50 border-red-200';
    case 'special': return 'bg-purple-50 border-purple-200';
    default: return 'bg-gray-50 border-gray-200';
  }
};
