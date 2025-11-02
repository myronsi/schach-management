export interface ChildItem {
  src: string;
  title: string;
  description?: string;
}

export interface MediaItem {
  id: number;
  src: string;
  title: string;
  description?: string;
  children: string | ChildItem[];
}

export interface AlertDialogState {
  open: boolean;
  title: string;
  description: string;
  variant: 'success' | 'error' | 'info';
}

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}
