import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Edit, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { DatePicker } from '@/components/ui/date-picker';
import { TypeSelector } from '@/components/ui/type-selector';
import { TimeInput } from '@/components/ui/time-input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const API = 'https://viserix.com/events.php';

interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  type?: string;
}

type FilterType = 'future' | 'past' | 'today';

const filterOptions = [
  { value: 'future', label: 'Zukünftige Ereignisse' },
  { value: 'today', label: 'Ereignisse heute' },
  { value: 'past', label: 'Vergangene Ereignisse' }
];

export interface EventsListRef {
  refresh: () => void;
}

const EventsListEmbedded = forwardRef<EventsListRef, {}>((_props, ref) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Event>>({});
  const [originalEvent, setOriginalEvent] = useState<Event | null>(null);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('future');
  const [filterOpen, setFilterOpen] = useState(false);
  
  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'success' | 'error' | 'info';
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'info'
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  const showAlert = (title: string, description: string, variant: 'success' | 'error' | 'info' = 'info') => {
    setAlertDialog({
      open: true,
      title,
      description,
      variant
    });
  };

  const showConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      onConfirm
    });
  };

  const filterEvents = (eventsToFilter: Event[], filter: FilterType) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    switch (filter) {
      case 'today':
        return eventsToFilter.filter(event => event.date === todayStr);
      case 'past':
        return eventsToFilter.filter(event => event.date < todayStr);
      case 'future':
      default:
        return eventsToFilter.filter(event => event.date >= todayStr);
    }
  };

  const handleFilterChange = (filter: FilterType) => {
    setCurrentFilter(filter);
    setFilteredEvents(filterEvents(events, filter));
    setFilterOpen(false);
  };

  const loadEvents = async () => {
    try {
      const res = await fetch(`${API}?action=list`);
      if (res.ok) {
        const data = await res.json();
        const allEvents = data.events || [];
        setEvents(allEvents);
        setFilteredEvents(filterEvents(allEvents, currentFilter));
      }
    } catch (err) {
      console.error('Fehler beim Laden der Ereignisse:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setFilteredEvents(filterEvents(events, currentFilter));
  }, [events, currentFilter]);

  useImperativeHandle(ref, () => ({
    refresh: loadEvents
  }));

  const handleEdit = (event: Event) => {
    setEditingId(event.id);
    setEditForm(event);
    setOriginalEvent(event);
  };

  const hasChanges = () => {
    if (!originalEvent) return false;
    
    return (
      editForm.title !== originalEvent.title ||
      editForm.date !== originalEvent.date ||
      editForm.time !== originalEvent.time ||
      editForm.location !== originalEvent.location ||
      editForm.description !== originalEvent.description ||
      editForm.type !== originalEvent.type
    );
  };

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    try {
      const res = await fetch(`${API}?action=edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      
      if (res.ok) {
        await loadEvents();
        setEditingId(null);
        setEditForm({});
        setOriginalEvent(null);
        showAlert('Erfolg', 'Ereignis wurde erfolgreich gespeichert', 'success');
      } else {
        showAlert('Fehler', 'Fehler beim Speichern', 'error');
      }
    } catch (err) {
      showAlert('Fehler', 'Netzwerkfehler', 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    showConfirm(
      'Ereignis löschen',
      `Möchten Sie das Ereignis "${title}" wirklich löschen?`,
      async () => {
        try {
          const res = await fetch(`${API}?action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          
          if (res.ok) {
            await loadEvents();
            showAlert('Erfolg', 'Ereignis wurde erfolgreich gelöscht', 'success');
          } else {
            showAlert('Fehler', 'Fehler beim Löschen', 'error');
          }
        } catch (err) {
          showAlert('Fehler', 'Netzwerkfehler', 'error');
        }
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setOriginalEvent(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEventTypeColor = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'training': return 'bg-blue-50 border-blue-200';
      case 'tournament': return 'bg-green-50 border-green-200';
      case 'meeting': return 'bg-yellow-50 border-yellow-200';
      case 'holiday': return 'bg-red-50 border-red-200';
      case 'special': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Lade Ereignisse...</div>;
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Alle Ereignisse</h2>
          
          {/* Filter Dropdown */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={filterOpen}
                className="w-full sm:w-[200px] justify-between"
              >
                {filterOptions.find(option => option.value === currentFilter)?.label}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandList>
                  <CommandEmpty>Keine Filter gefunden.</CommandEmpty>
                  <CommandGroup>
                    {filterOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleFilterChange(option.value as FilterType)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            currentFilter === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-8 text-center text-gray-500">
            {events.length === 0 ? (
              <>
                Keine Ereignisse vorhanden. Verwenden Sie die Schaltflächen oben, um Ereignisse zu erstellen.
              </>
            ) : (
              <>
                Keine Ereignisse für "{filterOptions.find(opt => opt.value === currentFilter)?.label}" gefunden.
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => (
            <Card key={event.id} className={`${getEventTypeColor(event.type)} transition-all hover:shadow-md`}>
              <CardContent className="p-4 sm:p-6">
                {editingId === event.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <Label htmlFor="edit-title">Titel</Label>
                        <Input
                          id="edit-title"
                          placeholder="Titel"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-date">Datum</Label>
                        <div className="mt-1">
                          <DatePicker
                            value={editForm.date ? parseDateString(editForm.date) : undefined}
                            onChange={(date) => setEditForm({
                              ...editForm, 
                              date: date ? formatDateForAPI(date) : ''
                            })}
                            placeholder="Datum auswählen"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-time">Uhrzeit</Label>
                        <div className="mt-1">
                          <TimeInput
                            value={editForm.time || ''}
                            onChange={(time) => setEditForm({...editForm, time})}
                            placeholder="Uhrzeit auswählen"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-location">Ort</Label>
                        <Input
                          id="edit-location"
                          placeholder="Ort"
                          value={editForm.location || ''}
                          onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <div className="mt-1">
                          <TypeSelector
                            value={editForm.type || ''}
                            onChange={(type) => setEditForm({...editForm, type})}
                            placeholder="Typ auswählen"
                          />
                        </div>
                      </div>
                      
                      <div className="sm:col-span-2">
                        <Label htmlFor="edit-description">Beschreibung</Label>
                        <Input
                          id="edit-description"
                          placeholder="Beschreibung"
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        onClick={handleSaveEdit} 
                        size="sm" 
                        className="w-full sm:w-auto"
                        disabled={!hasChanges()}
                      >
                        Speichern
                      </Button>
                      <Button onClick={handleCancelEdit} variant="outline" size="sm" className="w-full sm:w-auto">Abbrechen</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                        {event.type && (
                          <span className="px-2 py-1 text-xs rounded-full bg-white bg-opacity-70 self-start">
                            {event.type}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span>{formatDate(event.date)}</span>
                        </div>
                        
                        {event.time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span>{event.time}</span>
                          </div>
                        )}
                        
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span className="break-words">{event.location}</span>
                          </div>
                        )}
                      </div>
                      
                      {event.description && (
                        <p className="mt-2 text-gray-700 break-words">{event.description}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(event)}
                        className="flex items-center justify-center gap-1 w-full sm:w-auto"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="sm:inline">Bearbeiten</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(event.id, event.title)}
                        className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 w-full sm:w-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:inline">Löschen</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Dialog Components */}
      <AlertMessage
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
        title={alertDialog.title}
        description={alertDialog.description}
        variant={alertDialog.variant}
      />
      
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Löschen"
        variant="destructive"
      />
    </div>
  );
});

export default EventsListEmbedded;