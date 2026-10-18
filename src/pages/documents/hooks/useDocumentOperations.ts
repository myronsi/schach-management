import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { httpUtils } from '@/lib/auth-utils';
import { apiUrl } from '@/lib/api';
import { describeApiError, postJson, readJson } from '@/lib/api-errors';
import type { DocumentForm, UploadedFile } from '../types';

const API = apiUrl('documents.php');

type DocumentPayload = DocumentForm & { expected_updated_at?: string };

const postDocument = (payload: DocumentPayload) => postJson<{ id?: number }>(API, payload);

interface UploadResponse {
  success?: boolean;
  files?: UploadedFile[];
  uploaded_count?: number;
}

interface ScanResponse {
  success?: boolean;
  files?: UploadedFile[];
  file_count?: number;
}

export const useDocumentOperations = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<DocumentForm>({});
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<UploadedFile[]>([]);
  const [scanPath, setScanPath] = useState<string>('');

  const createUpdate = useMutation<Awaited<ReturnType<typeof postDocument>>, Error, DocumentPayload>({
    mutationFn: postDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Erfolg', description: 'Dokument gespeichert' });
      setForm({});
      setUploadedFiles([]);
      setScannedFiles([]);
      setScanPath('');
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
    onError: (error: Error) => {
      const { title, description } = describeApiError(error, 'Konnte nicht speichern');
      toast({ title, description, variant: 'destructive' });
    }
  });

  /** Saves the form. `editing` is the document being edited, or null when creating a new one. */
  const save = (editing: { id: number; updated_at?: string } | null) => {
    if (createUpdate.isPending) return;
    const payload: DocumentPayload = { ...form };
    if (editing) {
      payload.id = editing.id;
      const expected = editing.updated_at ?? form.updated_at;
      if (expected) payload.expected_updated_at = expected;
    } else {
      // New documents get their id from the server.
      delete payload.id;
    }

    if (payload.file_size) payload.file_size = Number(payload.file_size);
    
    if (!payload.filename && payload.filepath) {
      payload.filename = payload.filepath.split('/').pop() || payload.filepath;
    }

    createUpdate.mutate(payload);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!form.category || form.category === 'none') {
      toast({
        title: 'Fehler',
        description: 'Bitte wählen Sie zuerst eine Kategorie aus',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('category', form.category);

    for (let i = 0; i < files.length; i++) {
      formData.append(`file${i}`, files[i]);
    }

    try {
      const res = await httpUtils.authenticatedFetch(API, {
        method: 'POST',
        body: formData
      });
      const data = await readJson<UploadResponse>(res);

      if (res.ok && data.success && data.files && data.files.length > 0) {
        setUploadedFiles(data.files);
        toast({
          title: 'Erfolg',
          description: `${data.uploaded_count} Datei(en) hochgeladen`
        });
      } else {
        toast({
          title: 'Fehler',
          description: data.message || 'Keine Dateien hochgeladen',
          variant: 'destructive'
        });
      }
    } catch {
      toast({
        title: 'Fehler',
        description: 'Upload fehlgeschlagen',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleImportFile = (file: UploadedFile) => {
    setForm({
      ...form,
      filepath: file.filepath,
      filename: file.filename,
      file_size: file.size,
      category: form.category || file.category,
      name: form.name || file.filename.replace(/\.[^/.]+$/, '')
    });
    toast({
      title: 'Importiert',
      description: `${file.filename} wurde in das Formular importiert`
    });
    setUploadedFiles([]);
  };

  const handleScanDirectory = async () => {
    if (!scanPath) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie einen Pfad ein',
        variant: 'destructive'
      });
      return;
    }

    setScanning(true);
    try {
      // Scanning requires authentication.
      const res = await httpUtils.authenticatedFetch(`${API}?action=scan&path=${encodeURIComponent(scanPath)}`);
      const data = await readJson<ScanResponse>(res);

      if (res.ok && data.success && data.files) {
        setScannedFiles(data.files);
        toast({
          title: 'Erfolg',
          description: `${data.file_count} Datei(en) gefunden`
        });
      } else {
        toast({
          title: 'Hinweis',
          description: data.message || 'Keine Dateien gefunden',
          variant: 'destructive'
        });
      }
    } catch {
      toast({
        title: 'Fehler',
        description: 'Scan fehlgeschlagen',
        variant: 'destructive'
      });
    } finally {
      setScanning(false);
    }
  };

  const resetForm = () => {
    setForm({});
    setUploadedFiles([]);
    setScannedFiles([]);
    setScanPath('');
  };

  return {
    form,
    setForm,
    saving: createUpdate.isPending,
    uploading,
    uploadedFiles,
    setUploadedFiles,
    scanning,
    scannedFiles,
    setScannedFiles,
    scanPath,
    setScanPath,
    save,
    handleFileUpload,
    handleImportFile,
    handleScanDirectory,
    resetForm,
  };
};
