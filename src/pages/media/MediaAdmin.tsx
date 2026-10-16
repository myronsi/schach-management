import React, { useState } from 'react';
import { EditLockCancelledError, EditLockError, useEditLock } from '@/lib/editLock';
import { describeApiError } from '@/lib/api-errors';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import type { ChildItem, MediaItem } from './types';
import { fetchMedia, fetchMediaById, deleteMedia, postMedia } from './api';
import type { MediaPayload } from './api';
import { useMediaForm } from './useMediaForm';
import { MediaCard } from './MediaCard';
import { MediaWizard } from './MediaWizard';
import { parseChildren, stripBaseUrl, buildFullSrc } from './utils';
import { BASE_URL } from './constants';
import { useAlertDialog, useConfirmDialog } from '@/hooks/useDialogs';

const MediaAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const editLock = useEditLock('media');
  const { data, isLoading, error } = useQuery<MediaItem[], Error>({ 
    queryKey: ['media'], 
    queryFn: fetchMedia 
  });
  
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  
  const { showAlert, alertProps } = useAlertDialog();
  const { showConfirm, confirmProps } = useConfirmDialog();
  

  const mediaForm = useMediaForm();

  const createUpdate = useMutation<Awaited<ReturnType<typeof postMedia>>, Error, MediaPayload>({
    mutationFn: postMedia,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      await editLock.release();
      setOpen(false);
      setEditing(null);
      mediaForm.resetForm();
    },
    onError: (error: Error) => {
      const { title, description } = describeApiError(error, error.message || 'Konnte nicht speichern');
      showAlert(title, description, 'error');
    }
  });

  const startCreate = () => {
    setEditing(null);
    mediaForm.resetForm();
    mediaForm.setForm({ src: '', title: '', description: '' });
    setOpen(true);
  };

  const startEdit = async (item: MediaItem) => {
    try {
      await editLock.acquire(item.id);
      const full = await fetchMediaById(item.id);
      setEditing(full);
      mediaForm.resetForm();
      
      const fullSrc = buildFullSrc(full.src, BASE_URL);
      mediaForm.setForm({ 
        ...full,
        src: fullSrc
      });
      
      const parsedChildren = parseChildren(full.children);
      const childrenWithFullUrls = parsedChildren.map(child => ({
        ...child,
        src: buildFullSrc(child.src, BASE_URL)
      }));
      mediaForm.setChildrenList(childrenWithFullUrls);
      setOpen(true);
    } catch (err) {
      if (err instanceof EditLockCancelledError) return;
      if (err instanceof EditLockError) { showAlert('Bearbeitung gesperrt', err.message, 'error'); return; }
      void editLock.release();
      showAlert('Fehler', 'Konnte Media nicht laden', 'error');
    }
  };

  const handleSave = () => {
    let processedChildren: ChildItem[] = [...mediaForm.childrenList];
    
    const internalSrc = mediaForm.form.src ? stripBaseUrl(mediaForm.form.src, BASE_URL) : '';
    
    if (processedChildren.length === 0 && internalSrc && mediaForm.form.title) {
      processedChildren = [{
        src: internalSrc,
        title: mediaForm.form.title,
        description: undefined
      }];
    } else {
      processedChildren = processedChildren.map((child, index) => {
        if (index === 0) {
          return {
            ...child,
            src: internalSrc || stripBaseUrl(child.src, BASE_URL)
          };
        }
        return {
          ...child,
          src: stripBaseUrl(child.src, BASE_URL)
        };
      });
    }

    const payload: MediaPayload = {
      ...mediaForm.form,
      src: internalSrc,
      description: undefined,
      children: JSON.stringify(processedChildren)
    };

    if (editing) {
      payload.id = editing.id;
      if (editing.updated_at) payload.expected_updated_at = editing.updated_at;
    } else {
      // New entries get their id from the server.
      delete payload.id;
    }
    
    createUpdate.mutate(payload);
  };

  const handleDelete = (item: MediaItem) => {
    showConfirm(
      'Media löschen',
      `Möchten Sie das Media-Element "${item.title}" wirklich löschen?`,
      async () => {
        try {
          await deleteMedia(item.id, item.updated_at);
          queryClient.invalidateQueries({ queryKey: ['media'] });
          showAlert('Erfolg', 'Media wurde erfolgreich gelöscht', 'success');
        } catch (err) {
          const { title, description } = describeApiError(err, 'Fehler beim Löschen');
          showAlert(title, description, 'error');
        }
      }
    );
  };

  const handleCancel = () => {
    void editLock.release();
    setOpen(false);
    setEditing(null);
    mediaForm.resetForm();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Media</h1>
            <Button onClick={startCreate} className="flex items-center gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              <span className="sm:inline">Neues Media</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center">Lade Media...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Media
              </CardContent>
            </Card>
          ) : (data || []).length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Keine Media vorhanden. Erstellen Sie das erste Media-Element.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(data || []).map((m: MediaItem) => (
                <MediaCard
                  key={m.id}
                  media={m}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          <MediaWizard
            open={open}
            onOpenChange={(value) => { if (!value) void editLock.release(); setOpen(value); }}
            editing={editing}
            form={mediaForm.form}
            childrenList={mediaForm.childrenList}
            newChildSrc={mediaForm.newChildSrc}
            newChildDescription={mediaForm.newChildDescription}
            uploading={mediaForm.uploading}
            scanning={mediaForm.scanning}
            scannedFiles={mediaForm.scannedFiles}
            onFormChange={(field: 'src' | 'title', value: string) => 
              mediaForm.setForm({ ...mediaForm.form, [field]: value })
            }
            onNewChildSrcChange={mediaForm.setNewChildSrc}
            onNewChildDescriptionChange={mediaForm.setNewChildDescription}
            onAddChild={mediaForm.addChild}
            onRemoveChild={mediaForm.removeChild}
            onUpdateChild={mediaForm.updateChild}
            onMoveChildUp={mediaForm.moveChildUp}
            onMoveChildDown={mediaForm.moveChildDown}
            onFileUpload={mediaForm.handleFileUpload}
            onScanDirectory={mediaForm.scanDirectory}
            onImportScannedFiles={mediaForm.importScannedFiles}
            onImportSingleFile={mediaForm.importSingleFile}
            onSubmit={handleSave}
            onCancel={handleCancel}
          />
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

export default MediaAdmin;
