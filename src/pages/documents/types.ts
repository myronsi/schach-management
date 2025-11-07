export interface DocumentItem {
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

export interface UploadedFile {
  filepath: string;
  filename: string;
  size: number;
  category: string;
}
