import type { ChildItem } from './types';

export const parseChildren = (children: string | ChildItem[]): ChildItem[] => {
  if (Array.isArray(children)) return children;
  if (typeof children === 'string') {
    try {
      const parsed = JSON.parse(children);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
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
  
  // If it already starts with photos/, return as is
  if (trimmedSrc.startsWith('photos/')) {
    return trimmedSrc;
  }
  
  // Remove BASE_URL if present
  if (trimmedSrc.startsWith(baseUrl)) {
    return trimmedSrc.substring(baseUrl.length);
  }
  
  // Remove http:// or https:// and domain if present
  if (trimmedSrc.startsWith('http://') || trimmedSrc.startsWith('https://')) {
    try {
      const url = new URL(trimmedSrc);
      const pathname = url.pathname;
      // Remove leading slash if present
      return pathname.startsWith('/') ? pathname.substring(1) : pathname;
    } catch (e) {
      // If URL parsing fails, return as is
      return trimmedSrc;
    }
  }
  
  // Remove leading slash if present
  if (trimmedSrc.startsWith('/')) {
    return trimmedSrc.substring(1);
  }
  
  return trimmedSrc;
};
