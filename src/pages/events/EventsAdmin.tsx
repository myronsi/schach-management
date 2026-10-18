import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Trash2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CreateEventDialog from '@/components/events/CreateEventDialog';
import EditEventDialog from '@/components/events/EditEventDialog';
import DeleteEventDialog from '@/components/events/DeleteEventDialog';
import { apiUrl } from '@/lib/api';
import { describeApiError, postJson, readJson } from '@/lib/api-errors';
import EventCard from './EventCard';
import type { Event, FilterType } from './eventUtils';
import { filterOptions, filterEvents } from './eventUtils';
import { useAlertDialog, useConfirmDialog } from '@/hooks/useDialogs';

const API = apiUrl('events.php');

/** Events as returned by the API, tagged with the filter they were fetched for. */
interface LoadedEvents {
  filter: FilterType;
  events: Event[];
  failed: boolean;
}

const EventsList: React.FC = () => {
  const [loaded, setLoaded] = useState<LoadedEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('future');
  const [filterOpen, setFilterOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { showAlert, alertProps } = useAlertDialog();
  const { showConfirm, confirmProps } = useConfirmDialog();

  // Each load gets a sequence number and an AbortController so that a slow response for a
  // previously selected filter can never overwrite the result of the current one.
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const currentFilterRef = useRef<FilterType>(currentFilter);
  currentFilterRef.current = currentFilter;

  const loadEvents = useCallback(async (filterParam?: FilterType) => {
    const filterToUse = filterParam ?? currentFilterRef.current;
    const seq = ++requestSeqRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let action = 'list';
    if (filterToUse === 'future' || filterToUse === 'today') {
      action = 'upcoming';
    } else if (filterToUse === 'past') {
      action = 'past';
    }

    try {
      const res = await fetch(`${API}?action=${action}`, { signal: controller.signal });
      const data = await readJson<{ events?: Event[] }>(res);
      if (seq !== requestSeqRef.current) return; // stale response
      if (!res.ok || data.success === false) {
        setLoaded({ filter: filterToUse, events: [], failed: true });
        showAlert('Fehler', data.message || `Ereignisse konnten nicht geladen werden (HTTP ${res.status}).`, 'error');
        return;
      }
      setLoaded({ filter: filterToUse, events: data.events || [], failed: false });
    } catch (err) {
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      console.error('Fehler beim Laden der Ereignisse:', err);
      setLoaded({ filter: filterToUse, events: [], failed: true });
      showAlert('Fehler', 'Ereignisse konnten nicht geladen werden (Netzwerkfehler).', 'error');
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [showAlert]);

  const handleFilterChange = (filter: FilterType) => {
    setCurrentFilter(filter);
    currentFilterRef.current = filter;
    void loadEvents(filter);
    setFilterOpen(false);
  };

  const handleEventSuccess = () => {
    void loadEvents();
  };

  useEffect(() => {
    void loadEvents();
    return () => abortRef.current?.abort();
  }, [loadEvents]);

  // Only show data that was fetched for the selected filter; while the response for a newly selected
  // filter is pending, the old dataset is not re-filtered (which would briefly show "Keine Ereignisse").
  const isCurrent = loaded !== null && loaded.filter === currentFilter;
  const events = useMemo(() => (isCurrent ? loaded.events : []), [isCurrent, loaded]);
  const filteredEvents = useMemo(() => filterEvents(events, currentFilter), [events, currentFilter]);

  const handleDelete = async (id: string, title: string, expected_updated_at?: string) => {
    showConfirm(
      'Ereignis löschen',
      `Möchten Sie das Ereignis "${title}" wirklich löschen?`,
      async () => {
        try {
          await postJson(`${API}?action=delete`, { id, expected_updated_at }, 'Fehler beim Löschen');
          await loadEvents();
          showAlert('Erfolg', 'Ereignis wurde erfolgreich gelöscht', 'success');
        } catch (err) {
          const { title, description } = describeApiError(err, 'Fehler beim Löschen');
          showAlert(title, description, 'error');
        }
      }
    );
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
            <div className="flex flex-wrap gap-2">
              {/* Filter Dropdown */}
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={filterOpen}
                    className="justify-between min-w-[180px]"
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
                  <Button className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
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
                  <Button variant="outline" className="flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Bearbeiten
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
                  <Button variant="outline" className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                    Löschen
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

          {!isCurrent ? (
            <div className="text-center">Lade Ereignisse...</div>
          ) : loaded.failed ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Ereignisse
              </CardContent>
            </Card>
          ) : filteredEvents.length === 0 ? (
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
                <EventCard
                  key={event.id}
                  event={event}
                  onUpdate={handleEventSuccess}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Dialog Components */}
      <AlertMessage {...alertProps} />
      
      <ConfirmDialog
        {...confirmProps}
        confirmText="Löschen"
        variant="destructive"
      />
    </div>
  );
};

export default EventsList;