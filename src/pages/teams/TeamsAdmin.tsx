import React, { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { httpUtils } from '@/lib/auth-utils';

const API = 'https://sc-laufenburg.de/api/teams.php';

interface TeamItem {
  id: number;
  name: string;
  league: string;
  image?: string;
  url?: string;
  captain?: string;
  contact?: string;
  nextMatch?: string;
  venue?: string;
  record?: string;
  squad?: string;
  notes?: string;
  founded?: number;
}

interface TeamDescription {
  id: number;
  name: string;
  text: string;
}

const fetchTeams = async (): Promise<TeamItem[]> => {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch teams');
  return res.json();
};

const fetchDescription = async (): Promise<TeamDescription> => {
  const res = await fetch(`${API}?id=0`);
  if (!res.ok) throw new Error('Failed to fetch description');
  return res.json();
};

const postTeam = async (payload: any) => {
  const res = await httpUtils.post(API, payload);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Failed to save');
  }
  return data;
};

const TeamsAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<TeamItem[], Error>({ queryKey: ['teams'], queryFn: fetchTeams });
  const { data: description } = useQuery<TeamDescription, Error>({ queryKey: ['description'], queryFn: fetchDescription });
  const [open, setOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [editing, setEditing] = useState<TeamItem | null>(null);
  const [form, setForm] = useState<Partial<TeamItem>>({});
  
  const [descForm, setDescForm] = useState<TeamDescription>({ id: 0, name: '', text: '' });
  
  const [recordW, setRecordW] = useState<number>(0);
  const [recordD, setRecordD] = useState<number>(0);
  const [recordL, setRecordL] = useState<number>(0);
  
  const [squadPlayers, setSquadPlayers] = useState<string[]>([]);
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  
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

  const requiredFieldsFilled = Boolean(
    form.name && String(form.name).trim() !== '' &&
    form.league && String(form.league).trim() !== ''
  );

  const hasChanges = () => {
    if (!editing) return true;
    const keys: (keyof TeamItem)[] = ['name', 'league', 'image', 'url', 'captain', 'contact', 'nextMatch', 'venue', 'record', 'squad', 'notes', 'founded'];
    for (const k of keys) {
      const fVal = (form as any)[k] ?? '';
      const eVal = (editing as any)[k] ?? '';
      if (String(fVal) !== String(eVal)) return true;
    }
    return false;
  };

  const saveDisabled = !(requiredFieldsFilled && (editing ? hasChanges() : true));

  const fetchTeamById = async (id: number): Promise<TeamItem> => {
    const res = await fetch(`${API}?id=${id}`);
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  };

  const createUpdate = useMutation<any, Error, any>({
    mutationFn: postTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Erfolg', description: 'Team gespeichert' });
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

  const updateDescription = useMutation<any, Error, any>({
    mutationFn: postTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['description'] });
      toast({ title: 'Erfolg', description: 'Beschreibung gespeichert' });
      setDescriptionOpen(false);
    },
    onError: () => {
      toast({ 
        title: 'Fehler', 
        description: 'Konnte Beschreibung nicht speichern',
        variant: 'destructive'
      });
    }
  });

  const startEditDescription = () => {
    if (description) {
      setDescForm({ ...description });
    } else {
      setDescForm({ id: 0, name: 'Mannschaften Beschreibung', text: '' });
    }
    setDescriptionOpen(true);
  };

  const hasDescriptionChanges = () => {
    if (!description) {
      return Boolean(descForm.name || descForm.text);
    }
    return descForm.name !== description.name || descForm.text !== description.text;
  };

  const saveDescription = () => {
    updateDescription.mutate(descForm);
  };

  const startCreate = () => {
    setEditing(null);
    const maxId = (data || []).reduce((m, it) => Math.max(m, it.id || 0), 0);
    const newId = maxId + 1 || 1;
    setForm({ id: newId, record: '{}', squad: '[]', founded: new Date().getFullYear() });
    
    setRecordW(0);
    setRecordD(0);
    setRecordL(0);
    setSquadPlayers([]);
    setNewPlayerName('');
    
    setOpen(true);
  };

  const startEdit = async (item: TeamItem) => {
    try {
      const full = await fetchTeamById(item.id);
      setEditing(full);
      setForm({ ...full });
      
      try {
        const recordData = JSON.parse(full.record || '{}');
        setRecordW(recordData.w || 0);
        setRecordD(recordData.d || 0);
        setRecordL(recordData.l || 0);
      } catch {
        setRecordW(0);
        setRecordD(0);
        setRecordL(0);
      }
      
      try {
        const squadData = JSON.parse(full.squad || '[]');
        setSquadPlayers(Array.isArray(squadData) ? squadData : []);
      } catch {
        setSquadPlayers([]);
      }
      setNewPlayerName('');
      
      setOpen(true);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Konnte Team nicht laden' });
    }
  };

  const save = () => {
    const payload = { ...form } as any;
    if (form.id) payload.id = form.id;
    
    payload.record = JSON.stringify({
      w: recordW || 0,
      d: recordD || 0,
      l: recordL || 0
    });
    
    payload.squad = JSON.stringify(squadPlayers);

    createUpdate.mutate(payload);
  };
  
  const addPlayer = () => {
    if (newPlayerName.trim() !== '') {
      setSquadPlayers([...squadPlayers, newPlayerName.trim()]);
      setNewPlayerName('');
    }
  };
  
  const removePlayer = (index: number) => {
    setSquadPlayers(squadPlayers.filter((_, i) => i !== index));
  };

  const handleDelete = async (item: TeamItem) => {
    showConfirm(
      'Team löschen',
      `Möchten Sie das Team "${item.name}" wirklich löschen?`,
      async () => {
        try {
          const res = await httpUtils.delete(API, { id: item.id });
          
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            showAlert('Erfolg', 'Team wurde erfolgreich gelöscht', 'success');
          } else {
            showAlert('Fehler', 'Fehler beim Löschen', 'error');
          }
        } catch (err) {
          showAlert('Fehler', 'Netzwerkfehler', 'error');
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mannschaften</h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={startEditDescription} variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
                <Edit className="w-4 h-4" />
                <span className="sm:inline">Beschreibung bearbeiten</span>
              </Button>
              <Button onClick={startCreate} className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="sm:inline">Neue Mannschaft</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center">Lade Mannschaften...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Mannschaften
              </CardContent>
            </Card>
          ) : (data || []).length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Keine Teams vorhanden. Erstellen Sie das erste Team.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(data || []).map((t: TeamItem) => (
                <Card key={t.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.name}</h3>
                        <div className="text-sm text-gray-600 mb-2">
                          {t.league} {t.founded ? `• Gegründet ${t.founded}` : ''}
                        </div>
                        {t.captain && <p className="mt-1 text-sm text-gray-700">Kapitän: {t.captain}</p>}
                        {t.venue && <p className="mt-1 text-sm text-gray-700">Spielort: {t.venue}</p>}
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

          <Dialog open={descriptionOpen} onOpenChange={setDescriptionOpen}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Mannschaften Beschreibung bearbeiten</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="desc-name">Titel</Label>
                  <Input 
                    id="desc-name" 
                    placeholder="Titel" 
                    value={descForm.name || ''} 
                    onChange={(e) => setDescForm({...descForm, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc-text">Beschreibung (HTML)</Label>
                  <RichTextEditor
                    id="desc-text"
                    value={descForm.text || ''}
                    onChange={(html) => setDescForm({...descForm, text: html})}
                    placeholder="Beschreibung eingeben..."
                    forceLTR={false}
                  />
                </div>
                
                <Button 
                  type="button"
                  onClick={saveDescription} 
                  disabled={!hasDescriptionChanges()}
                  className="w-full"
                >
                  Speichern
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Mannschaft bearbeiten' : 'Neue Mannschaft'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Name <span className="text-red-500">*</span></Label>
                  <Input 
                    id="team-name" 
                    placeholder="Mannschaftsname" 
                    value={form.name || ''} 
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className={!form.name || String(form.name).trim() === '' ? 'border-red-300' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-league">Liga <span className="text-red-500">*</span></Label>
                  <Input 
                    id="team-league" 
                    placeholder="Liga" 
                    value={form.league || ''} 
                    onChange={(e) => setForm({...form, league: e.target.value})}
                    className={!form.league || String(form.league).trim() === '' ? 'border-red-300' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-founded">Gründungsjahr</Label>
                  <Input 
                    id="team-founded" 
                    type="number" 
                    placeholder="Jahr" 
                    value={form.founded || ''} 
                    onChange={(e) => setForm({...form, founded: e.target.value ? parseInt(e.target.value) : 0})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-captain">Kapitän</Label>
                  <Input 
                    id="team-captain" 
                    placeholder="Kapitän" 
                    value={form.captain || ''} 
                    onChange={(e) => setForm({...form, captain: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-contact">Kontakt</Label>
                  <Input 
                    id="team-contact" 
                    placeholder="Kontakt" 
                    value={form.contact || ''} 
                    onChange={(e) => setForm({...form, contact: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-venue">Spielort</Label>
                  <Input 
                    id="team-venue" 
                    placeholder="Spielort" 
                    value={form.venue || ''} 
                    onChange={(e) => setForm({...form, venue: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-nextMatch">Nächstes Spiel</Label>
                  <Input 
                    id="team-nextMatch" 
                    placeholder="Nächstes Spiel" 
                    value={form.nextMatch || ''} 
                    onChange={(e) => setForm({...form, nextMatch: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-image">Bild URL</Label>
                  <Input 
                    id="team-image" 
                    placeholder="Bild URL" 
                    value={form.image || ''} 
                    onChange={(e) => setForm({...form, image: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-url">Team URL</Label>
                  <Input 
                    id="team-url" 
                    placeholder="Team URL" 
                    value={form.url || ''} 
                    onChange={(e) => setForm({...form, url: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ergebnisse</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="record-w" className="text-xs text-gray-600">Siege (W)</Label>
                      <Input 
                        id="record-w" 
                        type="number" 
                        min="0"
                        placeholder="0" 
                        value={recordW || ''} 
                        onChange={(e) => setRecordW(e.target.value ? parseInt(e.target.value) : 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="record-d" className="text-xs text-gray-600">Unentschieden (D)</Label>
                      <Input 
                        id="record-d" 
                        type="number" 
                        min="0"
                        placeholder="0" 
                        value={recordD || ''} 
                        onChange={(e) => setRecordD(e.target.value ? parseInt(e.target.value) : 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="record-l" className="text-xs text-gray-600">Niederlagen (L)</Label>
                      <Input 
                        id="record-l" 
                        type="number" 
                        min="0"
                        placeholder="0" 
                        value={recordL || ''} 
                        onChange={(e) => setRecordL(e.target.value ? parseInt(e.target.value) : 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Kader</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Spielername eingeben" 
                      value={newPlayerName} 
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addPlayer();
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      onClick={addPlayer}
                      variant="outline"
                      className="shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {squadPlayers.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto border rounded-md p-2">
                      {squadPlayers.map((player, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
                        >
                          <span>{player}</span>
                          <button
                            type="button"
                            onClick={() => removePlayer(index)}
                            className="text-red-600 hover:text-red-700 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-notes">Notizen</Label>
                  <Textarea 
                    id="team-notes" 
                    placeholder="Notizen" 
                    value={form.notes || ''} 
                    onChange={(e) => setForm({...form, notes: e.target.value})}
                    className="min-h-[100px]"
                  />
                </div>
                
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

export default TeamsAdmin;
