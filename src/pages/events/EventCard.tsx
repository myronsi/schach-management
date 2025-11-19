import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Edit, Trash2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { TypeSelector } from '@/components/ui/type-selector';
import { Label } from '@/components/ui/label';
import { httpUtils } from '@/lib/auth-utils';
import type { Event } from './eventUtils';
import { formatDate, getEventTypeColor, formatDateForAPI, parseDateString } from './eventUtils';

const API = 'https://sc-laufenburg.de/api/events.php';

interface EventCardProps {
  event: Event;
  onUpdate: () => void;
  onDelete: (id: string, title: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Event>>({});
  const [originalEvent, setOriginalEvent] = useState<Event | null>(null);
  const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
  const [editEndDate, setEditEndDate] = useState<Date | undefined>(undefined);
  
  // Check if current event has date range
  const hasDateRange = editForm.date?.includes(':') || event.date?.includes(':');

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
        onUpdate();
        setEditingId(null);
        setOriginalEvent(null);
        setEditForm({});
        setEditStartDate(undefined);
        setEditEndDate(undefined);
      } else {
        const errorBody = await res.text();
        console.error('Edit failed', errorBody);
        throw new Error('Edit failed');
      }
    } catch (err) {
      console.error('Network error', err);
      throw err;
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setOriginalEvent(null);
    setEditForm({});
    setEditStartDate(undefined);
    setEditEndDate(undefined);
  };

  return (
    <Card className={`${getEventTypeColor(event.type)} transition-all hover:shadow-md`}>
      <CardContent className="p-4 sm:p-6">
        {editingId === event.id ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="edit-title">Titel <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-title"
                  placeholder="Titel"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  className="mt-1"
                />
              </div>
              
              <div className={`grid grid-cols-1 ${originalEvent?.date?.includes(':') ? 'sm:grid-cols-2' : ''} gap-2`}>
                <div>
                  <Label htmlFor="edit-start-date">Startdatum <span className="text-red-500">*</span></Label>
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

                {originalEvent?.date?.includes(':') && (
                  <div>
                    <Label htmlFor="edit-end-date">Enddatum</Label>
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
                              setEditForm({ ...editForm, date: `${start}:${end}`, time: '', is_recurring: 0 });
                            } else {
                              setEditForm({ ...editForm, date: `${end}`, time: '', is_recurring: 0 });
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
                )}
              </div>
              
              {!hasDateRange && (
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
              )}
              
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
              {!hasDateRange && (
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
              )}
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
                onClick={() => onDelete(event.id, event.title)}
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
  );
};

export default EventCard;
