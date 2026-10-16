import { useCallback, useState } from 'react';

export type AlertVariant = 'success' | 'error' | 'info';

export interface AlertDialogState {
  open: boolean;
  title: string;
  description: string;
  variant: AlertVariant;
}

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

/**
 * State + helper for the shared <AlertMessage> dialog.
 * Usage: `const { showAlert, alertProps } = useAlertDialog();` … `<AlertMessage {...alertProps} />`
 */
export function useAlertDialog() {
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    open: false,
    title: '',
    description: '',
    variant: 'info',
  });

  const showAlert = useCallback((title: string, description: string, variant: AlertVariant = 'info') => {
    setAlertDialog({ open: true, title, description, variant });
  }, []);

  const onOpenChange = useCallback((open: boolean) => {
    setAlertDialog(prev => ({ ...prev, open }));
  }, []);

  return {
    showAlert,
    alertProps: { ...alertDialog, onOpenChange },
  };
}

/**
 * State + helper for the shared <ConfirmDialog>.
 * Usage: `const { showConfirm, confirmProps } = useConfirmDialog();` … `<ConfirmDialog {...confirmProps} />`
 */
export function useConfirmDialog() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const showConfirm = useCallback((title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, onConfirm });
  }, []);

  const onOpenChange = useCallback((open: boolean) => {
    setConfirmDialog(prev => ({ ...prev, open }));
  }, []);

  return {
    showConfirm,
    confirmProps: { ...confirmDialog, onOpenChange },
  };
}
