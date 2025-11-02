import type { MediaItem } from './types';
import { API } from './constants';

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
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Failed to save');
  }
  return data;
};

export const deleteMedia = async (id: number) => {
  const res = await fetch(API, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return res.ok;
};

export const uploadFiles = async (title: string, files: FileList) => {
  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('title', title);
  
  for (let i = 0; i < files.length; i++) {
    formData.append(`file${i}`, files[i]);
  }

  const res = await fetch(API, {
    method: 'POST',
    body: formData,
  });

  return res.json();
};

export const scanDirectory = async (title: string) => {
  const res = await fetch(`${API}?action=scan&title=${encodeURIComponent(title)}`);
  return res.json();
};
