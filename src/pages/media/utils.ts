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

export const stripBaseUrl = (src: string, baseUrl: string): string => {
  const trimmedSrc = src.trim();

  if (trimmedSrc.startsWith('photos/')) {
    return trimmedSrc;
  }

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
