import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypeSelector } from '@/components/ui/type-selector';
import { DatePicker } from '@/components/ui/date-picker';
import { TimeInput } from '@/components/ui/time-input';
import { httpUtils } from '@/lib/auth-utils';
import { apiUrl } from '@/lib/api';
import { readJson } from '@/lib/api-errors';
import { formatDateForAPI, todayLocal } from '@/lib/date';
import type { Event } from '@/pages/events/eventUtils';

type FormData = {
  title: string;
  time?: string;
  location?: string;
  description?: string;
};

const API = apiUrl('events.php');

interface EditByTitleResponse {
  success?: boolean;
  message?: string;
  error?: string;
  updated?: number;
}

interface EventUpdates {
  time?: string;
  location?: string;
  description?: string;
  type?: string;
  is_recurring?: number;
}

type EditableField = keyof EventUpdates;

interface EditEventDialogProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

const startDay = (event: Event) => event.date.split(':')[0];

/**
 * The event whose values pre-fill the form: the next upcoming one with this title, or else the
 * most recent past one. (The list is sorted by date ascending, so "first match" would be the oldest.)
 */
const referenceEvent = (events: Event[], title: string): Event | undefined => {
  const today = todayLocal();
  const matching = events.filter(event => event.title === title && event.date);
  return matching.find(event => startDay(event) >= today) ?? matching[matching.length - 1];
};

const EditEventDialog: React.FC<EditEventDialogProps> = ({ onSuccess, onClose }) => {
  const { register, handleSubmit, setValue, watch, reset } = useForm<FormData>();
  const [response, setResponse] = useState<EditByTitleResponse | null>(null);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [titleOpen, setTitleOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  // Only fields the user actually touched are sent; untouched fields keep each event's own value.
  const [changedFields, setChangedFields] = useState<Set<EditableField>>(new Set());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markChanged = (field: EditableField) =>
    setChangedFields(prev => (prev.has(field) ? prev : new Set(prev).add(field)));
  const hasChanges = changedFields.size > 0;
  const dateRangeInvalid = !!(selectedStartDate && selectedEndDate && selectedStartDate > selectedEndDate);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch(`${API}?action=list`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Ereignisse:', err);
      }
    };
    loadEvents();
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleTitleSelect = (title: string) => {
    setSelectedTitle(title);
    setShowEditForm(true);
    setTitleOpen(false);
    setChangedFields(new Set());
    setSelectedStartDate(undefined);
    setSelectedEndDate(undefined);
    setStatus('');
    setResponse(null);

    const existingEvent = referenceEvent(events, title);
    reset({
      title,
      time: existingEvent?.time || '',
      location: existingEvent?.location || '',
      description: existingEvent?.description || '',
    });
    setSelectedType(existingEvent?.type || '');
    setIsRecurring(Number(existingEvent?.is_recurring) === 1);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    markChanged('type');
  };

  const onSubmit = async (data: FormData) => {
    if (!hasChanges || dateRangeInvalid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updates: EventUpdates = {};
      if (changedFields.has('time') && data.time) updates.time = data.time;
      if (changedFields.has('location') && data.location) updates.location = data.location;
      if (changedFields.has('description') && data.description) updates.description = data.description;
      if (changedFields.has('type') && selectedType) updates.type = selectedType;
      if (changedFields.has('is_recurring')) updates.is_recurring = isRecurring ? 1 : 0;

      const payload: { title?: string; updates: EventUpdates; start_date?: string; end_date?: string } = { title: data.title, updates: updates };
      // Without a start date the server applies the change from today on.
      if (selectedStartDate) payload.start_date = formatDateForAPI(selectedStartDate);
      if (selectedEndDate) payload.end_date = formatDateForAPI(selectedEndDate);

      const res = await httpUtils.post(`${API}?action=editByTitle`, payload);
      const result = await readJson<EditByTitleResponse>(res);
      if (res.ok && result.success !== false) {
        setResponse(result);
        setStatus('success');

        if (onSuccess) onSuccess();

        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          if (onClose) onClose();
        }, 1500);

      } else {
        setStatus('error');
        setResponse({ ...result, error: result.error || result.message || 'Fehler beim Speichern' });
      }
    } catch {
      setStatus('error');
      setResponse({ error: 'Netzwerkfehler' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const uniqueTitles = [...new Set(events.map(event => event.title))];
  const scopeText = selectedStartDate || selectedEndDate
    ? 'im gewählten Zeitraum'
    : 'ab heute';

  return (
    <div className="space-y-4">
      <div>
        <Label>Ereignis Titel auswählen <span className="text-red-500">*</span></Label>
        <Popover open={titleOpen} onOpenChange={setTitleOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={titleOpen}
              aria-required={true}
              className="w-full flex items-center justify-between px-3 py-2 border rounded bg-white text-left"
            >
              {selectedTitle || <span className="text-gray-400">Klicken Sie um Titel auszuwählen...</span>}
              <ChevronsUpDown className="opacity-50 ml-2 h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandList>
                <CommandEmpty>Keine Ereignisse gefunden.</CommandEmpty>
                <CommandGroup>
                  {uniqueTitles.map((title) => (
                    <CommandItem
                      key={title}
                      value={title}
                      onSelect={() => handleTitleSelect(title)}
                    >
                      {title}
                      <Check className={cn('ml-auto h-4 w-4', selectedTitle === title ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input type="hidden" {...register('title')} />

        {showEditForm && (
          <>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Hinweis:</strong> Nur die Felder, die Sie ändern, werden auf alle Ereignisse mit dem Titel "{selectedTitle}" {scopeText} übertragen.
                Alle anderen Angaben der einzelnen Ereignisse bleiben unverändert. Die Felder sind mit dem nächsten Termin vorausgefüllt.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DatePicker
                id="editStartDate"
                label="Anwenden ab (optional, sonst ab heute)"
                value={selectedStartDate}
                onChange={(d) => setSelectedStartDate(d)}
              />
              <DatePicker
                id="editEndDate"
                label="Anwenden bis (optional)"
                value={selectedEndDate}
                onChange={(d) => setSelectedEndDate(d)}
              />
            </div>
            {dateRangeInvalid && (
              <p className="text-sm text-red-600">Das Startdatum liegt nach dem Enddatum.</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="time">Uhrzeit</Label>
              <TimeInput
                value={watch('time') || ''}
                onChange={(time) => {
                  setValue('time', time);
                  markChanged('time');
                }}
                placeholder="Uhrzeit auswählen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ort</Label>
              <Input
                id="location"
                placeholder="Ort"
                {...register('location', { onChange: () => markChanged('location') })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                placeholder="Beschreibung"
                {...register('description', { onChange: () => markChanged('description') })}
              />
            </div>

            <TypeSelector
              id="type"
              value={selectedType}
              onChange={handleTypeChange}
            />

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked);
                  markChanged('is_recurring');
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Label htmlFor="is_recurring" className="cursor-pointer">
                Wiederkehrendes Ereignis (z.B. wöchentlich, monatlich)
              </Label>
            </div>
          </>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={!selectedTitle || !hasChanges || dateRangeInvalid || isSubmitting}
        >
          {isSubmitting ? (
            'Wird gespeichert...'
          ) : (
            showEditForm ? `Ereignisse ${scopeText} aktualisieren` : 'Ereignisse bearbeiten'
          )}
        </Button>
      </form>

      {status === 'success' && response && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800 font-semibold">Ereignisse gefunden und bearbeitet:</p>
          <p className="mt-2 text-sm text-green-700">
            {response.message || 'Ereignisse wurden erfolgreich bearbeitet'}
          </p>
        </div>
      )}

      {status === 'error' && response && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-semibold">Fehler:</p>
          <p className="text-sm text-red-700">{response.error}</p>
        </div>
      )}
    </div>
  );
};

export default EditEventDialog;
