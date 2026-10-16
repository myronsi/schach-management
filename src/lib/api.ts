const DEFAULT_API_BASE = 'https://sc-laufenburg.de/api';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

/** Base URL of the PHP API (no trailing slash). Configure via VITE_API_BASE. */
export const API_BASE: string = trimTrailingSlashes(import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE) || DEFAULT_API_BASE;

/** Public site root (with trailing slash) under which uploaded files and photos are served. */
export const SITE_BASE: string =
  trimTrailingSlashes(import.meta.env.VITE_SITE_BASE || API_BASE.replace(/\/api$/, '')) + '/';

/** Builds the URL of an API endpoint, e.g. apiUrl('news.php'). */
export const apiUrl = (file: string): string => `${API_BASE}/${file.replace(/^\/+/, '')}`;

/** Builds a public URL for a path relative to the site root, e.g. siteUrl('files/a.pdf'). */
export const siteUrl = (path: string): string => SITE_BASE + path.replace(/^\/+/, '');
