const DEFAULT_API_BASE = 'https://sc-laufenburg.de/api';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const API_BASE: string = trimTrailingSlashes(import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE) || DEFAULT_API_BASE;

export const SITE_BASE: string =
  trimTrailingSlashes(import.meta.env.VITE_SITE_BASE || API_BASE.replace(/\/api$/, '')) + '/';

export const apiUrl = (file: string): string => `${API_BASE}/${file.replace(/^\/+/, '')}`;

export const siteUrl = (path: string): string => SITE_BASE + path.replace(/^\/+/, '');
