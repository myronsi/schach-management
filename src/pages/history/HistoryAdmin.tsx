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
import { httpUtils } from '@/lib/auth-utils';

const API = 'https://sc-laufenburg.de/api/history.php';

interface HistoryItem {
  id: string;
  date: string;
  text: string;
}

const fetchHistory = async (): Promise<HistoryItem[]> => {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
};

const postHistory = async (payload: any) => {
  const res = await httpUtils.post(API, payload);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Failed to save');
  }
  return data;
};

const HistoryAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<HistoryItem[], Error>({ 
    queryKey: ['history'], 
    queryFn: fetchHistory 
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HistoryItem | null>(null);
  const [form, setForm] = useState<Partial<HistoryItem>>({});
  
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

  const isValidDateFormat = (dateStr: string): boolean => {
    if (!dateStr || dateStr.trim() === '') return false;
    const trimmed = dateStr.trim();
    
    // yyyy.mm.dd
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) return true;
    // yyyy.mm
    if (/^\d{4}\.\d{2}$/.test(trimmed)) return true;
    // yyyy-yyyy
    if (/^\d{4}-\d{4}$/.test(trimmed)) return true;
    // yyyy.mm.dd-mm.dd (same year, different month/day range)
    if (/^\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}$/.test(trimmed)) return true;
    // yyyy
    if (/^\d{4}$/.test(trimmed)) return true;
    
    return false;
  };

  const requiredFieldsFilled = Boolean(
    form.id && String(form.id).trim() !== '' &&
    form.date && String(form.date).trim() !== '' &&
    isValidDateFormat(form.date) &&
    form.text && String(form.text).trim() !== ''
  );

  const hasChanges = () => {
    if (!editing) return true;
    const keys: (keyof HistoryItem)[] = ['id', 'date', 'text'];
    for (const k of keys) {
      const fVal = (form as any)[k] ?? '';
      const eVal = (editing as any)[k] ?? '';
      if (String(fVal) !== String(eVal)) return true;
    }
    return false;
  };

  const saveDisabled = !(requiredFieldsFilled && (editing ? hasChanges() : true));

  const createUpdate = useMutation<any, Error, any>({
    mutationFn: postHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      toast({ title: 'Erfolg', description: 'Historie gespeichert' });
      setOpen(false);
      setEditing(null);
      setForm({});
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Fehler', 
        description: 'Konnte nicht speichern: ' + error.message,
        variant: 'destructive'
      });
    }
  });

  const startCreate = () => {
    setEditing(null);
    const newId = Date.now().toString();
    setForm({ id: newId, date: '', text: '' });
    setOpen(true);
  };

  const startEdit = (item: HistoryItem) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const save = () => {
    createUpdate.mutate(form);
  };

  const handleDelete = async (item: HistoryItem) => {
    showConfirm(
      'Historie-Eintrag löschen',
      `Möchten Sie den Eintrag "${item.date}" wirklich löschen?`,
      async () => {
        try {
          const res = await httpUtils.delete(API, { id: item.id });
          
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ['history'] });
            showAlert('Erfolg', 'Historie-Eintrag wurde erfolgreich gelöscht', 'success');
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Geschichte</h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={startCreate} className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="sm:inline">Neuer Eintrag</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center">Lade Geschichte...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Geschichte
              </CardContent>
            </Card>
          ) : (data || []).length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Keine Einträge vorhanden. Erstellen Sie den ersten Eintrag.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(data || []).map((h: HistoryItem) => (
                <Card key={h.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{h.date}</h3>
                        <p className="mt-2 text-gray-700 break-words whitespace-pre-wrap">{h.text}</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(h)}
                          className="flex items-center justify-center gap-1 w-full sm:w-auto"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="sm:inline">Bearbeiten</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(h)}
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
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Geschichte-Eintrag bearbeiten' : 'Neuer Geschichte-Eintrag'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="history-date">Datum <span className="text-red-500">*</span></Label>
                  <Input 
                    id="history-date" 
                    placeholder="Format: yyyy.mm.dd, yyyy.mm, yyyy, yyyy-yyyy, oder yyyy.mm.dd-mm.dd" 
                    value={form.date || ''} 
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className={!form.date || String(form.date).trim() === '' || !isValidDateFormat(form.date) ? 'border-red-300' : ''}
                  />
                  {form.date && form.date.trim() !== '' && !isValidDateFormat(form.date) && (
                    <p className="text-sm text-red-600">
                      Ungültiges Format. Erlaubt: yyyy.mm.dd, yyyy.mm, yyyy, yyyy-yyyy, yyyy.mm.dd-mm.dd
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="history-text">Text <span className="text-red-500">*</span></Label>
                  <Textarea 
                    id="history-text" 
                    placeholder="Beschreibung des historischen Ereignisses" 
                    value={form.text || ''} 
                    onChange={(e) => setForm({...form, text: e.target.value})} 
                    className="min-h-[200px] md:min-h-[300px] resize-vertical" 
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

export default HistoryAdmin;
