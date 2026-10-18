import React, { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import AuditMeta from '@/components/AuditMeta';
import { apiUrl } from '@/lib/api';
import { deleteJson, describeApiError, postJson } from '@/lib/api-errors';
import { EditLockCancelledError, EditLockError, openWithLock, useEditLock } from '@/lib/editLock';
import { hasFieldChanges } from '@/lib/form';
import { useAlertDialog, useConfirmDialog } from '@/hooks/useDialogs';
import { usePendingIds } from '@/hooks/usePendingIds';

const API = apiUrl('fastinfo.php');

interface FastInfoItem {
  id: number;
  icon: string;
  label: string;
  targetValue: number;
  delay: number;
  updated_at?: string;
  updated_by?: string;
}

const fetchFastInfo = async (): Promise<FastInfoItem[]> => {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch fast info');
  return res.json();
};

type FastInfoItemPayload = Partial<FastInfoItem> & { expected_updated_at?: string };

const postFastInfo = (payload: FastInfoItemPayload) => postJson<{ id?: number | string }>(API, payload);

const FASTINFO_FIELDS: (keyof FastInfoItem)[] = ['icon', 'label', 'targetValue', 'delay'];

const FastInfoAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const editLock = useEditLock('fastinfo');
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FastInfoItem | null>(null);
  const [form, setForm] = useState<Partial<FastInfoItem>>({});

  const { data, isLoading, error } = useQuery<FastInfoItem[], Error>({ 
    queryKey: ['fastinfo'], 
    queryFn: fetchFastInfo
  });

  const { showAlert, alertProps } = useAlertDialog();
  const { showConfirm, confirmProps } = useConfirmDialog();
  const { isPending: isDeleting, runPending } = usePendingIds<number>();

  const requiredFieldsFilled = Boolean(
    form.icon && String(form.icon).trim() !== '' &&
    form.label && String(form.label).trim() !== '' &&
    form.targetValue && form.targetValue > 0
  );

  const hasChanges = () => !editing || hasFieldChanges(form, editing, FASTINFO_FIELDS);

  const saveDisabled = !(requiredFieldsFilled && (editing ? hasChanges() : true));

  const fetchFastInfoById = async (id: number): Promise<FastInfoItem> => {
    const res = await fetch(`${API}?id=${id}`);
    if (!res.ok) throw new Error('Failed to fetch fast info item');
    return res.json();
  };

  const createUpdate = useMutation<Awaited<ReturnType<typeof postFastInfo>>, Error, FastInfoItemPayload>({
    mutationFn: postFastInfo,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['fastinfo'] });
      toast({ title: 'Erfolg', description: 'Fast Info gespeichert' });
      await editLock.release();
      setOpen(false);
      setEditing(null);
      setForm({});
    },
    onError: (error: Error) => {
      const { title, description } = describeApiError(error, 'Konnte nicht speichern');
      toast({ title, description, variant: 'destructive' });
    }
  });

  const startCreate = () => {
    setEditing(null);
    setForm({ delay: 0, targetValue: 0 });
    setOpen(true);
  };

  const startEdit = async (item: FastInfoItem) => {
    try {
      const full = await openWithLock(editLock, item.id, () => fetchFastInfoById(item.id));
      setEditing(full);
      setForm({ ...full });
      setOpen(true);
    } catch (err) {
      if (err instanceof EditLockCancelledError) return;
      if (err instanceof EditLockError) { toast({ title: 'Bearbeitung gesperrt', description: err.message, variant: 'destructive' }); return; }
      toast({ title: 'Fehler', description: 'Konnte Schnellinfo nicht laden' });
    }
  };

  const save = () => {
    if (createUpdate.isPending) return;
    const payload: FastInfoItemPayload = { ...form };
    if (editing) {
      payload.id = editing.id;
      if (editing.updated_at) payload.expected_updated_at = editing.updated_at;
    } else {
      // New entries get their id from the server.
      delete payload.id;
    }
    
    if (payload.targetValue) payload.targetValue = Number(payload.targetValue);
    if (payload.delay !== undefined) payload.delay = Number(payload.delay);

    createUpdate.mutate(payload);
  };

  const handleDelete = async (item: FastInfoItem) => {
    showConfirm(
      'Schnellinfo löschen',
      `Möchten Sie "${item.label}" wirklich löschen?`,
      () => runPending(item.id, async () => {
        try {
          await deleteJson(API, { id: item.id, expected_updated_at: item.updated_at });
          queryClient.invalidateQueries({ queryKey: ['fastinfo'] });
          showAlert('Erfolg', 'Schnellinfo wurde erfolgreich gelöscht', 'success');
        } catch (err) {
          const { title, description } = describeApiError(err, 'Fehler beim Löschen');
          showAlert(title, description, 'error');
        }
      })
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Schnellinfo</h1>
            <Button onClick={startCreate} className="flex items-center gap-2 w-full sm:w-auto">
              <LucideIcons.Plus className="w-4 h-4" />
              <span className="sm:inline">Neue Schnellinfo</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center">Lade Schnellinfo...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Schnellinfo
              </CardContent>
            </Card>
          ) : (data || []).length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Keine Schnellinfo vorhanden. Erstellen Sie die erste Schnellinfo.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(data || []).map((item: FastInfoItem) => (
                <Card key={item.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {LucideIcons[item.icon as keyof typeof LucideIcons] ? (
                            React.createElement(LucideIcons[item.icon as keyof typeof LucideIcons] as LucideIcon, { className: "w-6 h-6 text-blue-600" })
                          ) : (
                            <div className="text-2xl">{item.icon}</div>
                          )}
                          <h3 className="text-lg font-semibold text-gray-900">
                            {item.label}
                          </h3>
                        </div>
                        <div className="space-y-1 text-sm text-gray-700">
                          <p className="flex items-center gap-2">
                            <LucideIcons.TrendingUp className="w-4 h-4" />
                            <strong>Zielwert:</strong> {item.targetValue.toLocaleString()}
                          </p>
                          <p><strong>Verzögerung:</strong> {item.delay}ms</p>
                          <AuditMeta updatedAt={item.updated_at} updatedBy={item.updated_by} />
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(item)}
                          className="flex items-center justify-center gap-1 w-full sm:w-auto"
                        >
                          <LucideIcons.Edit className="w-4 h-4" />
                          <span className="sm:inline">Bearbeiten</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          disabled={isDeleting(item.id)}
                          className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 w-full sm:w-auto"
                        >
                          <LucideIcons.Trash2 className="w-4 h-4" />
                          <span className="sm:inline">{isDeleting(item.id) ? 'Wird gelöscht...' : 'Löschen'}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={open} onOpenChange={(value) => { if (!value) void editLock.release(); setOpen(value); }}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editing ? 'Schnellinfo bearbeiten' : 'Neue Schnellinfo'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fastinfo-icon">Icon <span className="text-red-500">*</span></Label>
                  <Input 
                    id="fastinfo-icon" 
                    placeholder="z.B. Users, BarChart2, TrendingUp" 
                    value={form.icon || ''} 
                    onChange={(e) => setForm({...form, icon: e.target.value})}
                    className={!form.icon || String(form.icon).trim() === '' ? 'border-red-300' : ''}
                  />
                  <p className="text-xs text-gray-500">
                    Geben Sie den Namen eines Lucide-Icons ein (Groß-/Kleinschreibung beachten). Verfügbare Icons finden Sie unter <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">lucide.dev/icons</a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fastinfo-label">Beschriftung <span className="text-red-500">*</span></Label>
                  <Input 
                    id="fastinfo-label" 
                    placeholder="z.B. Mitglieder oder Turniere" 
                    value={form.label || ''} 
                    onChange={(e) => setForm({...form, label: e.target.value})}
                    className={!form.label || String(form.label).trim() === '' ? 'border-red-300' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fastinfo-targetValue">Zielwert <span className="text-red-500">*</span></Label>
                  <Input 
                    id="fastinfo-targetValue" 
                    type="number"
                    min="1"
                    placeholder="z.B. 150" 
                    value={form.targetValue || ''} 
                    onChange={(e) => setForm({...form, targetValue: parseInt(e.target.value) || 0})}
                    className={!form.targetValue || form.targetValue <= 0 ? 'border-red-300' : ''}
                  />
                  <p className="text-xs text-gray-500">
                    Der Wert, bis zu dem hochgezählt wird
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fastinfo-delay">Verzögerung (ms)</Label>
                  <Input 
                    id="fastinfo-delay" 
                    type="number"
                    min="0"
                    placeholder="0" 
                    value={form.delay ?? ''} 
                    onChange={(e) => setForm({...form, delay: parseInt(e.target.value) || 0})}
                  />
                  <p className="text-xs text-gray-500">
                    Verzögerung vor der Animation in Millisekunden (0 = keine Verzögerung)
                  </p>
                </div>
                
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  <strong>Hinweis:</strong> Die Items werden nach der Verzögerung (delay) sortiert angezeigt.
                </div>
                
                <Button 
                  type="button"
                  onClick={save} 
                  disabled={saveDisabled || createUpdate.isPending}
                  className="w-full"
                >
                  {createUpdate.isPending ? (editing ? 'Wird gespeichert...' : 'Wird erstellt...') : (editing ? 'Speichern' : 'Erstellen')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <AlertMessage {...alertProps} />
      
      <ConfirmDialog
        {...confirmProps}
        confirmText="Löschen"
        variant="destructive"
      />
    </div>
  );
};

export default FastInfoAdmin;
