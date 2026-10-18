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
import AuditMeta from '@/components/AuditMeta';
import { apiUrl } from '@/lib/api';
import { ApiError, deleteJson, describeApiError, postJson } from '@/lib/api-errors';
import { formatDateForAPI, formatDateTimeForAPI, parseDateString, todayLocal } from '@/lib/date';
import { EditLockCancelledError, EditLockError, openWithLock, useEditLock } from '@/lib/editLock';
import { hasFieldChanges } from '@/lib/form';
import { useAlertDialog, useConfirmDialog } from '@/hooks/useDialogs';
import { usePendingIds } from '@/hooks/usePendingIds';

const API = apiUrl('news.php');

interface NewsItem {
  id: number;
  slug: string;
  title: string;
  description?: string;
  content?: string;
  date: string;
  image?: string;
  link?: string;
  updated_at?: string;
  updated_by?: string;
}

const fetchNews = async (): Promise<NewsItem[]> => {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch news');
  return res.json();
};

type NewsPayload = Partial<NewsItem> & { expected_updated_at?: string };

const postNews = (payload: NewsPayload) => postJson<{ id?: number }>(API, payload);

const NEWS_FIELDS: (keyof NewsItem)[] = ['slug', 'title', 'description', 'content', 'date', 'image', 'link'];

const isSlugExistsError = (error: Error) =>
  (error instanceof ApiError && error.code === 'slug_exists') || error.message === 'Slug already exists';

const NewsAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const editLock = useEditLock('news');
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<NewsItem[], Error>({ queryKey: ['news'], queryFn: fetchNews });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState<Partial<NewsItem>>({});
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  const { showAlert, alertProps } = useAlertDialog();
  const { showConfirm, confirmProps } = useConfirmDialog();
  const { isPending: isDeleting, runPending } = usePendingIds<number>();

  const requiredFieldsFilled = Boolean(
    form.slug && String(form.slug).trim() !== '' &&
    form.title && String(form.title).trim() !== '' &&
    form.date && String(form.date).trim() !== '' &&
    form.description && String(form.description).trim() !== '' &&
    form.content && String(form.content).trim() !== ''
  );

  const hasChanges = () => !editing || hasFieldChanges(form, editing, NEWS_FIELDS);

  const saveDisabled = !(requiredFieldsFilled && (editing ? hasChanges() : true));

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

  const createUpdate = useMutation<Awaited<ReturnType<typeof postNews>>, Error, NewsPayload>({
    mutationFn: postNews,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({ title: 'Erfolg', description: 'News gespeichert' });
      await editLock.release();
      setOpen(false);
      setEditing(null);
      setForm({});
    },
    onError: (error: Error) => {
      if (isSlugExistsError(error)) {
        toast({
          title: 'Slug existiert bereits',
          description: 'Dieser Slug existiert bereits. Bitte wählen Sie einen anderen Slug.',
          variant: 'destructive'
        });
        return;
      }
      const { title, description } = describeApiError(error, 'Konnte nicht speichern');
      toast({ title, description, variant: 'destructive' });
    }
  });

  const startCreate = () => {
    setEditing(null);
    setForm({ date: todayLocal(), content: '' });
    setSelectedDate(new Date());
    setOpen(true);
  };

  const startEdit = async (item: NewsItem) => {
    try {
      const full = await openWithLock(editLock, item.id, () => fetchNewsBySlug(item.slug));
      setEditing(full);
      const datePart = full.date ? String(full.date).split(' ')[0] : todayLocal();
      setForm({ ...full, date: datePart });
      const parsed = parseDateString(datePart);
      setSelectedDate(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
      setOpen(true);
    } catch (err) {
      if (err instanceof EditLockCancelledError) return;
      if (err instanceof EditLockError) {
        toast({ title: 'Bearbeitung gesperrt', description: err.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Fehler', description: 'Konnte News nicht laden' });
    }
  };

  const save = () => {
    if (createUpdate.isPending) return;
    const payload: NewsPayload = { ...form };
    if (editing) {
      payload.id = editing.id;
      if (editing.updated_at) payload.expected_updated_at = editing.updated_at;
    } else {
      // New entries get their id from the server.
      delete payload.id;
    }
    if (!payload.date) {
      payload.date = formatDateTimeForAPI(new Date());
    } else if (payload.date.length === 10) {
      payload.date = `${payload.date} 00:00:00`;
    }
    createUpdate.mutate(payload);
  };

  const handleDelete = async (item: NewsItem) => {
    showConfirm(
      'Nachricht löschen',
      `Möchten Sie die Nachricht "${item.title}" wirklich löschen?`,
      () => runPending(item.id, async () => {
        try {
          await deleteJson(API, { id: item.id, expected_updated_at: item.updated_at });
          queryClient.invalidateQueries({ queryKey: ['news'] });
          showAlert('Erfolg', 'Nachricht wurde erfolgreich gelöscht', 'success');
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
                        <AuditMeta updatedAt={n.updated_at} updatedBy={n.updated_by} />
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
                          disabled={isDeleting(n.id)}
                          className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 w-full sm:w-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sm:inline">{isDeleting(n.id) ? 'Wird gelöscht...' : 'Löschen'}</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={open} onOpenChange={(value) => { if (!value) void editLock.release(); setOpen(value); }}>
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

export default NewsAdmin;
