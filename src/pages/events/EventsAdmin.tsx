import React, { useState, useEffect } from 'react';
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
import { httpUtils } from '@/lib/auth-utils';
import EventCard from './EventCard';
import type { Event, FilterType } from './eventUtils';
import { filterOptions, filterEvents } from './eventUtils';

const API = 'https://sc-laufenburg.de/api/events.php';

const EventsList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
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

  const handleFilterChange = (filter: FilterType) => {
    setCurrentFilter(filter);
    loadEvents(filter);
    setFilterOpen(false);
  };

  const handleEventSuccess = () => {
    loadEvents();
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