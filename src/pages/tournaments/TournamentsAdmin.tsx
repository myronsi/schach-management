import React, { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const API = 'https://sc-laufenburg.de/api/tournaments.php';

interface TournamentItem {
  id: number;
  type: string;
  year: string;
  first: string;
  second?: string;
  third?: string;
}

const TOURNAMENT_TYPES = [
  { value: 'vereinsmeister', label: 'Vereinsmeister' },
  { value: 'pokalsieger', label: 'Pokalsieger' },
  { value: 'nikolausblitz', label: 'Nikolausblitz' },
  { value: 'blitzsieger', label: 'Blitzsieger' },
];

const TYPES_WITH_ONLY_FIRST = ['pokalsieger', 'blitzsieger'];

const fetchTournaments = async (type?: string): Promise<TournamentItem[]> => {
  const url = type && type !== 'all' ? `${API}?type=${type}` : API;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch tournaments');
  return res.json();
};

const postTournament = async (payload: any) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Failed to save');
  }
  return data;
};

const TournamentsAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TournamentItem | null>(null);
  const [form, setForm] = useState<Partial<TournamentItem>>({});
  const [currentFilter, setCurrentFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  
  const filterOptions = [
    { value: 'all', label: 'Alle Turniere' },
    ...TOURNAMENT_TYPES.map(t => ({ value: t.value, label: t.label }))
  ];

  const { data, isLoading, error } = useQuery<TournamentItem[], Error>({ 
    queryKey: ['tournaments', currentFilter], 
    queryFn: () => fetchTournaments(currentFilter)
  });

  const handleFilterChange = (filter: string) => {
    setCurrentFilter(filter);
    setFilterOpen(false);
  };
  
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

  const showSecondThird = !TYPES_WITH_ONLY_FIRST.includes(form.type || '');

  const requiredFieldsFilled = Boolean(
    form.type && String(form.type).trim() !== '' &&
    form.year && String(form.year).trim() !== '' &&
    form.first && String(form.first).trim() !== ''
  );

  const hasChanges = () => {
    if (!editing) return true;
    const keys: (keyof TournamentItem)[] = ['type', 'year', 'first', 'second', 'third'];
    for (const k of keys) {
      const fVal = (form as any)[k] ?? '';
      const eVal = (editing as any)[k] ?? '';
      if (String(fVal) !== String(eVal)) return true;
    }
    return false;
  };

  const saveDisabled = !(requiredFieldsFilled && (editing ? hasChanges() : true));

  const fetchTournamentById = async (id: number): Promise<TournamentItem> => {
    const res = await fetch(`${API}?id=${id}`);
    if (!res.ok) throw new Error('Failed to fetch tournament');
    return res.json();
  };

  const createUpdate = useMutation<any, Error, any>({
    mutationFn: postTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast({ title: 'Erfolg', description: 'Turnier gespeichert' });
      setOpen(false);
      setEditing(null);
      setForm({});
    },
    onError: () => {
      toast({ 
        title: 'Fehler', 
        description: 'Konnte nicht speichern',
        variant: 'destructive'
      });
    }
  });

  const startCreate = () => {
    setEditing(null);
    const maxId = (data || []).reduce((m, it) => Math.max(m, it.id || 0), 0);
    const newId = maxId + 1 || 1;
    setForm({ id: newId, year: new Date().getFullYear().toString() });
    setOpen(true);
  };

  const startEdit = async (item: TournamentItem) => {
    try {
      const full = await fetchTournamentById(item.id);
      setEditing(full);
      setForm({ ...full });
      setOpen(true);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Konnte Turnier nicht laden' });
    }
  };

  const save = () => {
    const payload = { ...form } as any;
    if (form.id) payload.id = form.id;
    
    if (TYPES_WITH_ONLY_FIRST.includes(form.type || '')) {
      payload.second = '';
      payload.third = '';
    }

    createUpdate.mutate(payload);
  };

  const handleDelete = async (item: TournamentItem) => {
    const typeName = TOURNAMENT_TYPES.find(t => t.value === item.type)?.label || item.type;
    showConfirm(
      'Turnier löschen',
      `Möchten Sie das Turnier "${typeName} ${item.year}" wirklich löschen?`,
      async () => {
        try {
          const res = await fetch(API, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id }),
          });
          
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ['tournaments'] });
            showAlert('Erfolg', 'Turnier wurde erfolgreich gelöscht', 'success');
          } else {
            showAlert('Fehler', 'Fehler beim Löschen', 'error');
          }
        } catch (err) {
          showAlert('Fehler', 'Netzwerkfehler', 'error');
        }
      }
    );
  };

  const getTournamentTypeName = (type: string) => {
    return TOURNAMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Turniere</h1>
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
                            onSelect={() => handleFilterChange(option.value)}
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
              
              <Button onClick={startCreate} className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="sm:inline">Neues Turnier</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center">Lade Turniere...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Turniere
              </CardContent>
            </Card>
          ) : (data || []).length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                {currentFilter === 'all' ? (
                  'Keine Turniere vorhanden. Erstellen Sie das erste Turnier.'
                ) : (
                  `Keine Turniere für "${filterOptions.find(opt => opt.value === currentFilter)?.label}" gefunden.`
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(data || []).map((t: TournamentItem) => (
                <Card key={t.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {getTournamentTypeName(t.type)} {t.year}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-700">
                          <p><strong>1. Platz:</strong> {t.first}</p>
                          {t.second && <p><strong>2. Platz:</strong> {t.second}</p>}
                          {t.third && <p><strong>3. Platz:</strong> {t.third}</p>}
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(t)}
                          className="flex items-center justify-center gap-1 w-full sm:w-auto"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="sm:inline">Bearbeiten</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(t)}
                          className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 w-full sm:w-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sm:inline">Löschen</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Turnier bearbeiten' : 'Neues Turnier'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tournament-type">Turniertyp <span className="text-red-500">*</span></Label>
                  <Select 
                    value={form.type || ''} 
                    onValueChange={(value) => setForm({...form, type: value})}
                  >
                    <SelectTrigger 
                      id="tournament-type"
                      className={!form.type || String(form.type).trim() === '' ? 'border-red-300' : ''}
                    >
                      <SelectValue placeholder="Turniertyp auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOURNAMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tournament-year">Jahr <span className="text-red-500">*</span></Label>
                  <Input 
                    id="tournament-year" 
                    placeholder="Jahr" 
                    value={form.year || ''} 
                    onChange={(e) => setForm({...form, year: e.target.value})}
                    className={!form.year || String(form.year).trim() === '' ? 'border-red-300' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tournament-first">1. Platz <span className="text-red-500">*</span></Label>
                  <Input 
                    id="tournament-first" 
                    placeholder="Gewinner" 
                    value={form.first || ''} 
                    onChange={(e) => setForm({...form, first: e.target.value})}
                    className={!form.first || String(form.first).trim() === '' ? 'border-red-300' : ''}
                  />
                </div>

                {showSecondThird && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="tournament-second">2. Platz</Label>
                      <Input 
                        id="tournament-second" 
                        placeholder="Zweiter Platz" 
                        value={form.second || ''} 
                        onChange={(e) => setForm({...form, second: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tournament-third">3. Platz</Label>
                      <Input 
                        id="tournament-third" 
                        placeholder="Dritter Platz" 
                        value={form.third || ''} 
                        onChange={(e) => setForm({...form, third: e.target.value})}
                      />
                    </div>
                  </>
                )}
                
                {!showSecondThird && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                    <strong>Hinweis:</strong> Bei diesem Turniertyp gibt es nur einen 1. Platz.
                  </div>
                )}
                
                <Button 
                  type="button"
                  onClick={save} 
                  disabled={saveDisabled}
                  className="w-full"
                >
                  {editing ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
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

export default TournamentsAdmin;
