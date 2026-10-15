import type { MediaItem } from './types';
import { API } from './constants';
import { httpUtils } from '@/lib/auth-utils';
import { markConflict } from '@/lib/conflict';

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

export const postMedia = async (payload: any) => {
  const res = await httpUtils.post(API, payload);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw markConflict(new Error(data.message || 'Failed to save'), data.conflict === true || res.status === 409);
  }
  return data;
};

export const deleteMedia = async (id: number, expected_updated_at?: string) => {
  const res = await httpUtils.delete(API, { id, expected_updated_at });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw markConflict(new Error(data.message || 'Failed to delete media'), data.conflict === true || res.status === 409);
  }
  return true;
};

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

  return res.json();
};

export const scanDirectory = async (title: string) => {
  const res = await fetch(`${API}?action=scan&title=${encodeURIComponent(title)}`);
  return res.json();
};
