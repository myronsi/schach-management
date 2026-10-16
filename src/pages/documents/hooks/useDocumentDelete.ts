import { useQueryClient } from '@tanstack/react-query';
import { apiUrl } from '@/lib/api';
import { deleteJson, describeApiError, postJson } from '@/lib/api-errors';
import { useAlertDialog } from '@/hooks/useDialogs';
import type { DocumentItem } from '../types';

const API = apiUrl('documents.php');

export const useDocumentDelete = () => {
  const queryClient = useQueryClient();
  const { showAlert, alertProps } = useAlertDialog();

  const performDelete = async (item: Pick<DocumentItem, 'id' | 'name' | 'updated_at'>, deleteType: 'deactivate' | 'hard') => {
    if (deleteType === 'deactivate') {
      try {
        await postJson(API, { id: item.id, is_active: false, expected_updated_at: item.updated_at }, 'Fehler beim Deaktivieren');
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        showAlert('Erfolg', 'Dokument wurde deaktiviert', 'success');
      } catch (err) {
        const { title, description } = describeApiError(err, (err instanceof Error && err.message) || 'Fehler beim Deaktivieren');
        showAlert(title, description, 'error');
      }
      return;
    }

    try {
      await deleteJson(API, { id: item.id, expected_updated_at: item.updated_at, hard: true }, 'Fehler beim Löschen');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showAlert('Erfolg', 'Dokument wurde dauerhaft gelöscht', 'success');
    } catch (err) {
      const { title, description } = describeApiError(err, (err instanceof Error && err.message) || 'Fehler beim Löschen');
      showAlert(title, description, 'error');
    }
  };

  return {
    alertProps,
    showAlert,
    performDelete,
  };
};
