import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { httpUtils } from '@/lib/auth-utils';

const API = 'https://sc-laufenburg.de/api/documents.php';

interface DocumentItem {
  id: number;
  name: string;
  filename: string;
  filepath: string;
  category: string | null;
  description: string | null;
  file_size: number | null;
  upload_date: string;
  updated_at: string;
  is_active: boolean;
}

interface UploadedFile {
  filepath: string;
  filename: string;
  size: number;
  category: string;
}

const postDocument = async (payload: any) => {
  const res = await httpUtils.post(API, payload);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Failed to save');
  }
  return data;
};

export const useDocumentOperations = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<DocumentItem>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<UploadedFile[]>([]);
  const [scanPath, setScanPath] = useState<string>('');

  const createUpdate = useMutation<any, Error, any>({
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
    onError: () => {
      toast({ 
        title: 'Fehler', 
        description: 'Konnte nicht speichern',
        variant: 'destructive'
      });
    }
  });

  const save = () => {
    const payload = { ...form } as any;
    if (form.id) payload.id = form.id;
    
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
      const data = await res.json();

      if (data.success && data.files && data.files.length > 0) {
        setUploadedFiles(data.files);
        toast({
          title: 'Erfolg',
          description: `${data.uploaded_count} Datei(en) hochgeladen`
        });
      } else {
        toast({
          title: 'Fehler',
          description: 'Keine Dateien hochgeladen',
          variant: 'destructive'
        });
      }
    } catch (err) {
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
      const res = await fetch(`${API}?action=scan&path=${encodeURIComponent(scanPath)}`);
      const data = await res.json();

      if (data.success && data.files) {
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
    } catch (err) {
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
