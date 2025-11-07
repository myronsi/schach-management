import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ChildItem, MediaItem } from './types';
import { BASE_URL } from './constants';
import { uploadFiles, scanDirectory as scanDirectoryAPI } from './api';
import { buildFullSrc } from './utils';

export const useMediaForm = () => {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<MediaItem>>({});
  const [childrenList, setChildrenList] = useState<ChildItem[]>([]);
  const [newChildSrc, setNewChildSrc] = useState('');
  const [newChildDescription, setNewChildDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<string[]>([]);

  const addChild = () => {
    const trimmedSrc = newChildSrc.trim();
    if (trimmedSrc !== '' && form.title) {
      const fullSrc = buildFullSrc(trimmedSrc, BASE_URL);
      
      const newChild: ChildItem = {
        src: fullSrc,
        title: form.title,
        description: newChildDescription.trim() || undefined
      };
      setChildrenList([...childrenList, newChild]);
      setNewChildSrc('');
      setNewChildDescription('');
    }
  };

  const removeChild = (index: number) => {
    const updated = childrenList.filter((_, i) => i !== index);
    setChildrenList(updated);
    
    if (index === 0 && updated.length > 0) {
      setForm({
        ...form,
        src: updated[0].src
      });
    }
  };

  const updateChild = (index: number, field: keyof ChildItem, value: string) => {
    const updated = [...childrenList];
    updated[index] = { ...updated[index], [field]: value };
    setChildrenList(updated);
    
    if (index === 0 && field === 'src') {
      setForm({
        ...form,
        src: value
      });
    }
  };

  const moveChildUp = (index: number) => {
    if (index === 0) return;
    const updated = [...childrenList];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setChildrenList(updated);
    
    if (index === 1) {
      setForm({
        ...form,
        src: updated[0].src
      });
    }
  };

  const moveChildDown = (index: number) => {
    if (index === childrenList.length - 1) return;
    const updated = [...childrenList];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setChildrenList(updated);
    
    if (index === 0) {
      setForm({
        ...form,
        src: updated[0].src
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !form.title) return;

    setUploading(true);
    try {
      const data = await uploadFiles(form.title, files);
      
      if (data.success) {
        let successMsg = `${data.uploaded_count || data.files.length} Datei(en) hochgeladen`;
        if (data.target_path) {
          successMsg += ` nach ${data.target_path}`;
        }
        if (data.errors && data.errors.length > 0) {
          successMsg += `\n\nWarnungen: ${data.errors.join(', ')}`;
        }
        
        toast({ 
          title: 'Erfolg', 
          description: successMsg
        });
        
        if (data.files && data.files.length > 0) {
          const newChildren: ChildItem[] = data.files.map((filePath: string) => ({
            src: BASE_URL + 'photos/' + filePath,
            title: form.title || '',
            description: undefined
          }));
          
          setChildrenList([...childrenList, ...newChildren]);
          
          if (!form.src || form.src.trim() === '') {
            setForm({ ...form, src: BASE_URL + 'photos/' + data.files[0] });
          }
        }
        
        return { success: true };
      } else {
        return { success: false, error: data };
      }
    } catch (error: any) {
      toast({ 
        title: 'Fehler', 
        description: error.message || 'Upload fehlgeschlagen',
        variant: 'destructive'
      });
      return { success: false };
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const scanDirectory = async () => {
    if (!form.title) {
      toast({ 
        title: 'Fehler', 
        description: 'Bitte geben Sie zuerst einen Titel ein',
        variant: 'destructive'
      });
      return;
    }

    setScanning(true);
    try {
      const data = await scanDirectoryAPI(form.title);
      
      if (data.success) {
        setScannedFiles(data.files || []);
        const fileCount = data.files?.length || 0;
        const message = fileCount > 0 
          ? `${fileCount} Datei(en) gefunden in ${data.scanned_path || ''}` 
          : data.message || 'Keine Dateien gefunden';
        
        toast({ 
          title: 'Erfolg', 
          description: message 
        });
      } else {
        return { success: false, error: data };
      }
    } catch (error: any) {
      toast({ 
        title: 'Fehler', 
        description: error.message || 'Scan fehlgeschlagen',
        variant: 'destructive'
      });
    } finally {
      setScanning(false);
    }
  };

  const importScannedFiles = () => {
    if (scannedFiles.length === 0) return;

    const newChildren: ChildItem[] = scannedFiles.map((filePath: string) => ({
      src: BASE_URL + 'photos/' + filePath,
      title: form.title || '',
      description: undefined
    }));

    if (newChildren.length > 0) {
      setForm({ 
        ...form, 
        src: newChildren[0].src
      });
    }

    setChildrenList(newChildren);
    setScannedFiles([]);
    toast({ 
      title: 'Erfolg', 
      description: `${newChildren.length} Datei(en) importiert` 
    });
  };

  const importSingleFile = (filePath: string) => {
    const newChild: ChildItem = {
      src: BASE_URL + 'photos/' + filePath,
      title: form.title || '',
      description: undefined
    };

    setChildrenList([...childrenList, newChild]);
    
    if (!form.src || form.src.trim() === '') {
      setForm({ ...form, src: newChild.src });
    }

    setScannedFiles(scannedFiles.filter(f => f !== filePath));
    
    toast({ 
      title: 'Erfolg', 
      description: 'Datei importiert' 
    });
  };

  const resetForm = () => {
    setForm({});
    setChildrenList([]);
    setNewChildSrc('');
    setNewChildDescription('');
    setScannedFiles([]);
  };

  return {
    form,
    setForm,
    childrenList,
    setChildrenList,
    newChildSrc,
    setNewChildSrc,
    newChildDescription,
    setNewChildDescription,
    uploading,
    scanning,
    scannedFiles,
    addChild,
    removeChild,
    updateChild,
    moveChildUp,
    moveChildDown,
    handleFileUpload,
    scanDirectory,
    importScannedFiles,
    importSingleFile,
    resetForm
  };
};
