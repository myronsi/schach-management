import { apiUrl, SITE_BASE } from '@/lib/api';

export const API = apiUrl('media.php');
export const BASE_URL = SITE_BASE;

/** File types accepted by the media upload (SVG is no longer allowed by the server). */
export const MEDIA_UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf';
