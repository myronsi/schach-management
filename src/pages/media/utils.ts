import type { ChildItem } from './types';

export const parseChildren = (children: string | ChildItem[]): ChildItem[] => {
  if (Array.isArray(children)) return children;
  if (typeof children === 'string') {
    try {
      const parsed = JSON.parse(children);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const buildFullSrc = (src: string, baseUrl: string): string => {
  const trimmedSrc = src.trim();
  
  if (trimmedSrc.startsWith('http://') || trimmedSrc.startsWith('https://')) {
    return trimmedSrc;
  } else if (trimmedSrc.startsWith('photos/')) {
    return baseUrl + trimmedSrc;
  } else if (trimmedSrc.startsWith('/')) {
    return baseUrl + 'photos' + trimmedSrc;
  } else {
    return baseUrl + 'photos/' + trimmedSrc;
  }
};

/**
 * Converts a full URL back into the site-relative path stored in the database (e.g. "photos/a/b.jpg").
 * Only URLs on the site itself (same origin, below the site base path, pointing into "photos/") are
 * shortened; any other absolute URL - e.g. an external image - is kept unchanged, so that
 * buildFullSrc(stripBaseUrl(url)) always yields the original URL again.
 */
export const stripBaseUrl = (src: string, baseUrl: string): string => {
  const trimmedSrc = src.trim();

  if (trimmedSrc.startsWith('photos/')) {
    return trimmedSrc;
  }

  // baseUrl is the site root including scheme, host and trailing slash, so a prefix match means same origin.
  if (trimmedSrc.startsWith(baseUrl)) {
    const relative = trimmedSrc.substring(baseUrl.length);
    return relative.startsWith('photos/') ? relative : trimmedSrc;
  }

  if (trimmedSrc.startsWith('http://') || trimmedSrc.startsWith('https://')) {
    return trimmedSrc;
  }

  if (trimmedSrc.startsWith('/')) {
    return trimmedSrc.substring(1);
  }
  
  return trimmedSrc;
};
