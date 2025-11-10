import React, { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Edit, Plus, Trash2, RefreshCcw } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { httpUtils } from '@/lib/auth-utils';

const API = 'https://sc-laufenburg.de/api/news.php';

interface NewsItem {
  id: number;
  slug: string;
  title: string;
  description?: string;
  content?: string;
  date: string;
  image?: string;
  link?: string;
}

const fetchNews = async (): Promise<NewsItem[]> => {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch news');
  return res.json();
};

const postNews = async (payload: any) => {
  const res = await httpUtils.post(API, payload);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Failed to save');
  }
  return data;
};

const NewsAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<NewsItem[], Error>({ queryKey: ['news'], queryFn: fetchNews });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState<Partial<NewsItem>>({});
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
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
    form.slug && String(form.slug).trim() !== '' &&
    form.title && String(form.title).trim() !== '' &&
    form.date && String(form.date).trim() !== '' &&
    form.description && String(form.description).trim() !== '' &&
    form.content && String(form.content).trim() !== ''
  );

  const hasChanges = () => {
    if (!editing) return true;
    const keys: (keyof NewsItem)[] = ['slug', 'title', 'description', 'content', 'date', 'image', 'link'];
    for (const k of keys) {
      const fVal = (form as any)[k] ?? '';
      const eVal = (editing as any)[k] ?? '';
      if (String(fVal) !== String(eVal)) return true;
    }
    return false;
  };

  const saveDisabled = !(requiredFieldsFilled && (editing ? hasChanges() : true));

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setForm({ ...form, date: formatDateForAPI(date) });
    }
  };

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

  const fetchNewsBySlug = async (slug: string): Promise<NewsItem> => {
    const res = await fetch(`${API}?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Failed to fetch news item');
    return res.json();
  };

  const createUpdate = useMutation<any, Error, any>({
    mutationFn: postNews,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ title: 'Erfolg', description: 'News gespeichert' });
      setOpen(false);
      setEditing(null);
      setForm({});
    },
    onError: (error: Error) => {
      if (error.message === 'Slug already exists') {
        toast({ 
          title: 'Fehler', 
          description: 'Dieser Slug existiert bereits. Bitte wählen Sie einen anderen Slug.',
          variant: 'destructive'
        });
      } else {
        toast({ 
          title: 'Fehler', 
          description: 'Konnte nicht speichern',
          variant: 'destructive'
        });
      }
    }
  });

  const startCreate = () => {
    setEditing(null);
    const maxId = (data || []).reduce((m, it) => Math.max(m, it.id || 0), 0);
    const newId = maxId + 1 || 1;
    const todayStr = new Date().toISOString().slice(0, 10);
    setForm({ id: newId, date: todayStr, content: '' });
  setSelectedDate(new Date());
  setOpen(true);
  };

  const startEdit = async (item: NewsItem) => {
    try {
      const full = await fetchNewsBySlug(item.slug);
      setEditing(full);
      const today = new Date().toISOString().slice(0, 10);
      const datePart = full.date ? String(full.date).split(' ')[0] : today;
      setForm({ ...full, date: datePart });
      try {
        setSelectedDate(new Date(datePart));
      } catch (e) {
        setSelectedDate(new Date());
      }
      setOpen(true);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Konnte News nicht laden' });
    }
  };

  const save = () => {
    const payload = { ...form } as any;
    if (form.id) payload.id = form.id;
    const nowFull = new Date().toISOString().replace('T', ' ').split('.')[0];
    if (!payload.date) {
      payload.date = nowFull;
    } else if (typeof payload.date === 'string' && payload.date.length === 10) {
      payload.date = `${payload.date} 00:00:00`;
    }
    createUpdate.mutate(payload);
  };

  const handleDelete = async (item: NewsItem) => {
    showConfirm(
      'Nachricht löschen',
      `Möchten Sie die Nachricht "${item.title}" wirklich löschen?`,
      async () => {
        try {
          const res = await httpUtils.delete(API, { id: item.id });
          
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ['news'] });
            showAlert('Erfolg', 'Nachricht wurde erfolgreich gelöscht', 'success');
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Nachrichten</h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={startCreate} className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="sm:inline">Neue Nachricht</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center">Lade Nachrichten...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Nachrichten
              </CardContent>
            </Card>
          ) : (data || []).length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Keine Nachrichten vorhanden. Erstellen Sie die erste Nachricht.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(data || []).map((n: NewsItem) => (
                <Card key={n.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{n.title}</h3>
                        <div className="text-sm text-gray-600 mb-2">{n.slug} • {n.date}</div>
                        {n.description && <p className="mt-2 text-gray-700 break-words">{n.description}</p>}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(n)}
                          className="flex items-center justify-center gap-1 w-full sm:w-auto"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="sm:inline">Bearbeiten</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(n)}
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
                  <DialogTitle>{editing ? 'Nachricht bearbeiten' : 'Neue Nachricht'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="news-slug">Slug <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      id="news-slug"
                      placeholder="Slug"
                      value={form.slug || ''}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      className={`pr-10 ${!form.slug || String(form.slug).trim() === '' ? 'border-red-300' : ''}`}
                    />
                    <button
                      type="button"
                      aria-label="Slug aus Titel generieren"
                      title="Slug aus Titel generieren"
                      disabled={!form.title || String(form.title).trim() === ''}
                      onClick={() => {
                        const generated = slugify(String(form.title || ''));
                        setForm({ ...form, slug: generated });
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-40"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="news-title">Titel <span className="text-red-500">*</span></Label>
                  <Input 
                    id="news-title" 
                    placeholder="Titel" 
                    value={form.title || ''} 
                    onChange={(e) => setForm({...form, title: e.target.value})}
                    className={!form.title || String(form.title).trim() === '' ? 'border-red-300' : ''}
                  />
                </div>

                <DatePicker
                  id="date"
                  label="Datum"
                  value={selectedDate}
                  onChange={handleDateChange}
                  required
                />

                <div className="space-y-2">
                  <Label htmlFor="news-link">Link</Label>
                  <Input id="news-link" placeholder="Link" value={form.link || ''} onChange={(e) => setForm({...form, link: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="news-image">Bild URL</Label>
                  <Input id="news-image" placeholder="Bild URL" value={form.image || ''} onChange={(e) => setForm({...form, image: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="news-desc">Kurzbeschreibung <span className="text-red-500">*</span></Label>
                  <Textarea id="news-desc" placeholder="Kurzbeschreibung" value={form.description || ''} onChange={(e) => setForm({...form, description: e.target.value})} className="min-h-[120px] md:min-h-[160px] resize-vertical" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="news-content">Inhalt <span className="text-red-500">*</span></Label>
                  <RichTextEditor
                    id="news-content"
                    value={form.content || ''}
                    onChange={(html) => setForm({ ...form, content: html })}
                    className="mt-1"
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

export default NewsAdmin;
