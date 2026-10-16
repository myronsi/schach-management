import type { MediaItem } from './types';
import { API } from './constants';
import { httpUtils } from '@/lib/auth-utils';
import { deleteJson, postJson, readJson } from '@/lib/api-errors';

export const fetchMedia = async (): Promise<MediaItem[]> => {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch media');
  return res.json();
};

export const fetchMediaById = async (id: number): Promise<MediaItem> => {
  const res = await fetch(`${API}?id=${id}`);
  if (!res.ok) throw new Error('Failed to fetch media item');
  return res.json();
};

export type MediaPayload = Omit<Partial<MediaItem>, 'children'> & {
  children?: string;
  expected_updated_at?: string;
};

export const postMedia = (payload: MediaPayload) => postJson<{ id?: number }>(API, payload);

export const deleteMedia = async (id: number, expected_updated_at?: string) => {
  await deleteJson(API, { id, expected_updated_at }, 'Failed to delete media');
  return true;
};

export interface UploadResponse {
  success?: boolean;
  message?: string;
  files?: string[];
  uploaded_count?: number;
  target_path?: string;
  errors?: string[];
}

export interface ScanResponse {
  success?: boolean;
  message?: string;
  files?: string[];
  scanned_path?: string;
}

export const uploadFiles = async (title: string, files: FileList) => {
  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('title', title);
  
  for (let i = 0; i < files.length; i++) {
    formData.append(`file${i}`, files[i]);
  }

  const res = await httpUtils.authenticatedFetch(API, {
    method: 'POST',
    body: formData
  });

  const data = await readJson<UploadResponse>(res);
  if (!res.ok && data.success === undefined) data.success = false;
  return data;
};

/** Lists files already present in the gallery folder. Requires authentication. */
export const scanDirectory = async (title: string) => {
  const res = await httpUtils.authenticatedFetch(`${API}?action=scan&title=${encodeURIComponent(title)}`);
  const data = await readJson<ScanResponse>(res);
  if (!res.ok && data.success === undefined) data.success = false;
  return data;
};
