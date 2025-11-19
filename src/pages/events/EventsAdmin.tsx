import React, { useState, useEffect } from 'react';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Edit, Trash2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { TypeSelector } from '@/components/ui/type-selector';
import { Label } from '@/components/ui/label';
import CreateEventDialog from '@/components/events/CreateEventDialog';
import EditEventDialog from '@/components/events/EditEventDialog';
import DeleteEventDialog from '@/components/events/DeleteEventDialog';
import { httpUtils } from '@/lib/auth-utils';

const API = 'https://sc-laufenburg.de/api/events.php';

interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  type?: string;
  is_recurring?: number;
}

type FilterType = 'future' | 'past' | 'today';

const filterOptions = [
  { value: 'future', label: 'Zukünftige Ereignisse' },
  { value: 'today', label: 'Ereignisse heute' },
  { value: 'past', label: 'Vergangene Ereignisse' }
];

const EventsList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Event>>({});
  const [originalEvent, setOriginalEvent] = useState<Event | null>(null);
  const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
  const [editEndDate, setEditEndDate] = useState<Date | undefined>(undefined);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('future');
  const [filterOpen, setFilterOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
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

  const handleFilterChange = (filter: FilterType) => {
    setCurrentFilter(filter);
    loadEvents(filter);
    setFilterOpen(false);
  };

  const handleEventSuccess = () => {
    loadEvents();
  };

  const hasChanges = () => {
    if (!originalEvent) return false;
    
    const changes = {
      title: editForm.title !== originalEvent.title,
      date: editForm.date !== originalEvent.date,
      time: editForm.time !== originalEvent.time,
      location: editForm.location !== originalEvent.location,
      description: editForm.description !== originalEvent.description,
      type: editForm.type !== originalEvent.type,
      is_recurring: Number(editForm.is_recurring ?? 0) !== Number(originalEvent.is_recurring ?? 0)
    };
    
    const hasAnyChanges = Object.values(changes).some(changed => changed);
    console.log('hasChanges check', { originalEvent, editForm, changes, hasAnyChanges });
    
    return hasAnyChanges;
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

  const loadEvents = async (filterParam?: FilterType) => {
    const filterToUse = filterParam ?? currentFilter;
    try {
      let action = 'list';
      if (filterToUse === 'future' || filterToUse === 'today') {
        action = 'upcoming';
      } else if (filterToUse === 'past') {
        action = 'past';
      }

      const res = await fetch(`${API}?action=${action}`);
      if (res.ok) {
        const data = await res.json();
        const allEvents = data.events || [];
        setEvents(allEvents);
        setFilteredEvents(filterEvents(allEvents, filterToUse));
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

  const handleEdit = (event: Event) => {
    setEditingId(event.id);
    setOriginalEvent(event);
    setEditForm(event);
    if (event.date && event.date.includes(':')) {
      const parts = event.date.split(':', 2);
      try {
        setEditStartDate(parseDateString(parts[0]));
        setEditEndDate(parseDateString(parts[1]));
      } catch (err) {
        setEditStartDate(undefined);
        setEditEndDate(undefined);
      }
    } else if (event.date) {
      try {
        setEditStartDate(parseDateString(event.date));
        setEditEndDate(undefined);
      } catch (err) {
        setEditStartDate(undefined);
        setEditEndDate(undefined);
      }
    } else {
      setEditStartDate(undefined);
      setEditEndDate(undefined);
    }
  };

  const handleSaveEdit = async () => {
    console.log('handleSaveEdit called', { editingId, editForm, hasChanges: hasChanges() });
    if (editingId === null) {
      console.log('No editingId, returning');
      return;
    }
    
    try {
      const payload: any = { 
        id: String(editingId)
      };
      
      if (editForm.title !== undefined) payload.title = editForm.title;
      if (editForm.date !== undefined) payload.date = editForm.date;
      if (editForm.time !== undefined) payload.time = editForm.time;
      if (editForm.location !== undefined) payload.location = editForm.location;
      if (editForm.description !== undefined) payload.description = editForm.description;
      if (editForm.type !== undefined) payload.type = editForm.type;
      if (editForm.is_recurring !== undefined) payload.is_recurring = editForm.is_recurring;
      
      console.log('Sending edit request', payload);
      const res = await httpUtils.post(`${API}?action=edit`, payload);
      console.log('Edit response', { ok: res.ok, status: res.status });
      
      if (res.ok) {
        await loadEvents();
        setEditingId(null);
        setOriginalEvent(null);
        setEditForm({});
        setEditStartDate(undefined);
        setEditEndDate(undefined);
        showAlert('Erfolg', 'Ereignis wurde erfolgreich gespeichert', 'success');
      } else {
        const errorBody = await res.text();
        console.error('Edit failed', errorBody);
        showAlert('Fehler', 'Fehler beim Speichern', 'error');
      }
    } catch (err) {
      console.error('Network error', err);
      showAlert('Fehler', 'Netzwerkfehler', 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    showConfirm(
      'Ereignis löschen',
      `Möchten Sie das Ereignis "${title}" wirklich löschen?`,
      async () => {
        try {
          const res = await httpUtils.post(`${API}?action=delete`, { id });
          
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
    setOriginalEvent(null);
    setEditForm({});
    setEditStartDate(undefined);
    setEditEndDate(undefined);
  };

  const formatDate = (dateStr: string) => {
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
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="p-8">
          <div className="text-center">Lade Ereignisse...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ereignisse</h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
              
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Neues Ereignis
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Neues Ereignis erstellen</DialogTitle>
                  </DialogHeader>
                  <CreateEventDialog 
                    onSuccess={handleEventSuccess} 
                    onClose={() => setCreateDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-yellow-600 text-white hover:bg-yellow-700 w-full sm:w-auto">
                    <Edit className="mr-2 h-4 w-4" />
                    Ereignisse bearbeiten
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Ereignisse bearbeiten</DialogTitle>
                  </DialogHeader>
                  <EditEventDialog 
                    onSuccess={handleEventSuccess}
                    onClose={() => setEditDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-red-600 text-white hover:bg-red-700 w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Ereignisse löschen
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Ereignisse löschen</DialogTitle>
                  </DialogHeader>
                  <DeleteEventDialog 
                    onSuccess={handleEventSuccess}
                    onClose={() => setDeleteDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                {events.length === 0 ? (
                  'Keine Ereignisse vorhanden. Erstellen Sie das erste Ereignis.'
                ) : (
                  `Keine Ereignisse für "${filterOptions.find(opt => opt.value === currentFilter)?.label}" gefunden.`
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
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor="edit-start-date">Startdatum</Label>
                              <div className="mt-1">
                                <DatePicker
                                  id="edit-start-date"
                                  value={editStartDate ?? (editForm.date && !editForm.date.includes(':') ? parseDateString(editForm.date) : undefined)}
                                  onChange={(date) => {
                                    setEditStartDate(date);
                                    if (date) {
                                      const start = formatDateForAPI(date);
                                      if (editEndDate) {
                                        setEditForm({ ...editForm, date: `${start}:${formatDateForAPI(editEndDate)}` });
                                      } else {
                                        setEditForm({ ...editForm, date: start });
                                      }
                                    } else {
                                      setEditForm({ ...editForm, date: '' });
                                    }
                                  }}
                                  placeholder="Startdatum auswählen"
                                />
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="edit-end-date">Enddatum (optional)</Label>
                              <div className="mt-1">
                                <DatePicker
                                  id="edit-end-date"
                                  value={editEndDate ?? (editForm.date && editForm.date.includes(':') ? parseDateString(editForm.date.split(':')[1]) : undefined)}
                                  onChange={(date) => {
                                    setEditEndDate(date);
                                    if (date) {
                                      const start = editStartDate ? formatDateForAPI(editStartDate) : (editForm.date && editForm.date.includes(':') ? editForm.date.split(':')[0] : editForm.date || '');
                                      const end = formatDateForAPI(date);
                                      if (start) {
                                        setEditForm({ ...editForm, date: `${start}:${end}` });
                                      } else {
                                        setEditForm({ ...editForm, date: `${end}` });
                                      }
                                    } else {
                                      if (editStartDate) {
                                        setEditForm({ ...editForm, date: formatDateForAPI(editStartDate) });
                                      } else {
                                        setEditForm({ ...editForm, date: '' });
                                      }
                                    }
                                  }}
                                  placeholder="Enddatum auswählen"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="edit-time">Uhrzeit</Label>
                            <Input
                              id="edit-time"
                              type="time"
                              step="1"
                              value={editForm.time || ''}
                              onChange={(e) => setEditForm({...editForm, time: e.target.value})}
                              className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                            />
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
                          <div className="flex items-center gap-2">
                            <input
                              id="edit-is-recurring"
                              type="checkbox"
                              checked={Boolean(editForm.is_recurring)}
                              onChange={(e) => setEditForm({ ...editForm, is_recurring: e.target.checked ? 1 : 0 })}
                              className="h-4 w-4"
                            />
                            <Label htmlFor="edit-is-recurring" className="mb-0">Wiederkehrend</Label>
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
        </div>
      </div>
      
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
};

export default EventsList;