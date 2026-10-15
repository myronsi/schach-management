import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { httpUtils } from '@/lib/auth-utils';
import { isConflictError, conflictDescription } from '@/lib/conflict';

const API = 'https://sc-laufenburg.de/api/documents.php';

interface DocumentItem {
  id: number;
  name: string;
  updated_at?: string;
}

export const useDocumentDelete = () => {
  const queryClient = useQueryClient();
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

  const showAlert = (title: string, description: string, variant: 'success' | 'error' | 'info' = 'info') => {
    setAlertDialog({
      open: true,
      title,
      description,
      variant
    });
  };

  const performDelete = async (item: DocumentItem, deleteType: 'deactivate' | 'hard') => {
    try {
      let endpoint = API;
      let body: any = { id: item.id, expected_updated_at: item.updated_at };
      
      if (deleteType === 'hard') {
        body.hard = true;
      } else if (deleteType === 'deactivate') {
        const res = await httpUtils.post(API, { id: item.id, is_active: false, expected_updated_at: item.updated_at });
        const data = await res.json();
        
        if (res.ok && data.success) {
          queryClient.invalidateQueries({ queryKey: ['documents'] });
          showAlert('Erfolg', 'Dokument wurde deaktiviert', 'success');
        } else {
          showAlert(isConflictError({ message: data.message, conflict: data.conflict }) ? 'Änderungskonflikt' : 'Fehler',
            isConflictError({ message: data.message, conflict: data.conflict }) ? conflictDescription(new Error(data.message || '')) : (data.message || 'Fehler beim Deaktivieren'),
            'error');
        }
        return;
      }
      
      const res = await httpUtils.delete(endpoint, body);
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        const message = deleteType === 'hard' 
          ? 'Dokument wurde dauerhaft gelöscht' 
          : 'Dokument wurde gelöscht';
        showAlert('Erfolg', message, 'success');
      } else {
        const conflict = isConflictError({ message: data.message, conflict: data.conflict });
        showAlert(conflict ? 'Änderungskonflikt' : 'Fehler',
          conflict ? conflictDescription(new Error(data.message || '')) : (data.message || 'Fehler beim Löschen'),
          'error');
      }
    } catch (err) {
      const error = err as Error;
      const conflict = isConflictError(error);
      showAlert(conflict ? 'Änderungskonflikt' : 'Fehler', conflict ? conflictDescription(error) : 'Netzwerkfehler', 'error');
    }
  };

  return {
    alertDialog,
    setAlertDialog,
    showAlert,
    performDelete,
  };
};
