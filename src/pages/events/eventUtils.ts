export interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  type?: string;
  is_recurring?: number;
}

export type FilterType = 'future' | 'past' | 'today';

export const filterOptions = [
  { value: 'future', label: 'Zukünftige Ereignisse' },
  { value: 'today', label: 'Ereignisse heute' },
  { value: 'past', label: 'Vergangene Ereignisse' }
];

export const filterEvents = (eventsToFilter: Event[], filter: FilterType) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

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
          const [_start, end] = event.date.split(':');
          return end < todayStr;
        }
        return event.date < todayStr;
      });
    case 'future':
    default:
      return eventsToFilter.filter(event => {
        if (!event.date) return false;
        if (event.date.includes(':')) {
          const [_start, end] = event.date.split(':');
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
    const s = new Date(start);
    const e = new Date(end);
    const sStr = s.toLocaleDateString('de-DE');
    const eStr = e.toLocaleDateString('de-DE');
    return `${sStr} — ${eStr}`;
  }
  const date = new Date(dateStr);
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

export const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};
