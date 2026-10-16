import { apiUrl } from '@/lib/api';

interface CookieOptions {
  expires?: Date;
  maxAge?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  httpOnly?: boolean;
}

export const cookieUtils = {
  set(name: string, value: string, options: CookieOptions = {}): void {
    const defaults: CookieOptions = {
      path: '/',
      secure: window.location.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 8 * 24 * 60 * 60
    };

    const finalOptions = { ...defaults, ...options };
    
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    
    if (finalOptions.expires) {
      cookieString += `; expires=${finalOptions.expires.toUTCString()}`;
    }
    
    if (finalOptions.maxAge) {
      cookieString += `; max-age=${finalOptions.maxAge}`;
    }
    
    if (finalOptions.path) {
      cookieString += `; path=${finalOptions.path}`;
    }
    
    if (finalOptions.domain) {
      cookieString += `; domain=${finalOptions.domain}`;
    }
    
    if (finalOptions.secure) {
      cookieString += '; secure';
    }
    
    if (finalOptions.sameSite) {
      cookieString += `; samesite=${finalOptions.sameSite}`;
    }
    
    document.cookie = cookieString;
  },

  get(name: string): string | null {
    const nameEQ = encodeURIComponent(name) + '=';
    const cookies = document.cookie.split(';');
    
    for (const cookie of cookies) {
      const c = cookie.trim();
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length));
      }
    }
    
    return null;
  },

  remove(name: string, options: Partial<CookieOptions> = {}): void {
    this.set(name, '', {
      ...options,
      expires: new Date(0),
      maxAge: -1
    });
  },

  exists(name: string): boolean {
    return this.get(name) !== null;
  }
};

export interface JwtPayload {
  exp?: number;
  iat?: number;
  username?: string;
  status?: string;
  [claim: string]: unknown;
}

export const jwtUtils = {
  decodePayload(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = parts[1];
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decoded = atob(paddedPayload);
      const parsed: unknown = JSON.parse(decoded);
      return parsed && typeof parsed === 'object' ? (parsed as JwtPayload) : null;
    } catch (error) {
      console.error('Error decoding JWT payload:', error);
      return null;
    }
  },

  isExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload || !payload.exp) {
      return true;
    }
    
    return payload.exp * 1000 < Date.now();
  },

  getUsername(token: string): string | null {
    const payload = this.decodePayload(token);
    return payload?.username || null;
  },

  getStatus(token: string): string | null {
    const payload = this.decodePayload(token);
    return payload?.status || null;
  },

  needsRenewal(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload || !payload.exp) {
      return false;
    }
    
    const exp = payload.exp * 1000;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    return (exp - now) <= twentyFourHours && exp > now;
  },

  getTimeUntilExpiration(token: string): number {
    const payload = this.decodePayload(token);
    if (!payload || !payload.exp) {
      return 0;
    }
    
    return Math.max(0, (payload.exp * 1000) - Date.now());
  }
};

export interface TokenRenewalResult {
  success: boolean;
  message: string;
  token?: string;
  /**
   * true only if the server explicitly rejected the token (or it is missing/expired locally).
   * Network errors and 5xx responses leave this false so the session is kept and retried later.
   */
  invalid?: boolean;
}

const LEGACY_COOKIE_NAME = 'auth_token';

/**
 * Older versions mirrored the JWT into a JS-readable cookie that the server never read.
 * Remove any such leftover cookie once when this module loads.
 */
function removeLegacyCookie(): void {
  try {
    if (typeof document !== 'undefined' && cookieUtils.exists(LEGACY_COOKIE_NAME)) {
      cookieUtils.remove(LEGACY_COOKIE_NAME);
    }
  } catch {
    // ignore: cookies may be unavailable (e.g. privacy mode)
  }
}

removeLegacyCookie();

export const authToken = {
  STORAGE_KEY: 'auth_token',

  set(token: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, token);
    } catch (error) {
      console.error('Could not persist auth token', error);
    }
  },

  get(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return null;
    }
  },

  remove(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // storage unavailable – nothing to remove
    }
    removeLegacyCookie();
  },

  exists(): boolean {
    const token = this.get();
    return token !== null && !jwtUtils.isExpired(token);
  },
  
  getUsername(): string | null {
    const token = this.get();
    return token ? jwtUtils.getUsername(token) : null;
  },
  
  getStatus(): string | null {
    const token = this.get();
    return token ? jwtUtils.getStatus(token) : null;
  },

  needsRenewal(): boolean {
    const token = this.get();
    return token ? jwtUtils.needsRenewal(token) : false;
  },

  async renewToken(): Promise<TokenRenewalResult> {
    const currentToken = this.get();
    if (!currentToken) {
      return { success: false, message: 'No token to renew', invalid: true };
    }
    if (jwtUtils.isExpired(currentToken)) {
      return { success: false, message: 'Token expired', invalid: true };
    }

    let response: Response;
    try {
      response = await fetch(apiUrl('auth.php'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          action: 'renew',
          token: currentToken
        })
      });
    } catch (error) {
      console.error('Token renewal network error:', error);
      return { success: false, message: 'Network error during token renewal', invalid: false };
    }

    let data: { success?: boolean; token?: string; message?: string } = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.ok && data.success && data.token) {
      this.set(data.token);
      return { success: true, message: data.message || '', token: data.token };
    }

    // Explicit rejection: OK response with success:false, or 401/403.
    const invalid = (response.ok && data.success === false) || response.status === 401 || response.status === 403;
    return { success: false, message: data.message || 'Token renewal failed', invalid };
  },

  /**
   * Renews the token if it is close to expiry.
   * Returns false only if the session is definitively invalid (expired locally or rejected by the server);
   * transient failures (network, 5xx) return true so the caller keeps the session and retries later.
   */
  async autoRenew(): Promise<boolean> {
    const token = this.get();
    if (!token || jwtUtils.isExpired(token)) {
      return false;
    }
    if (!jwtUtils.needsRenewal(token)) {
      return true;
    }
    const result = await this.renewToken();
    return result.success || !result.invalid;
  }
};

export const httpUtils = {
  getAuthHeaders(): Record<string, string> {
    const token = authToken.get();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
    }
    
    return headers;
  },

  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = authToken.get();
    const headers = new Headers(options.headers);

    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('X-Auth-Token', token);
    }

    return fetch(url, {
      ...options,
      headers
    });
  },

  async post(url: string, data: unknown, options: RequestInit = {}): Promise<Response> {
    return this.authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  },

  async delete(url: string, data?: unknown, options: RequestInit = {}): Promise<Response> {
    const requestOptions: RequestInit = {
      method: 'DELETE',
      ...options
    };

    if (data !== undefined) {
      requestOptions.body = JSON.stringify(data);
    }

    return this.authenticatedFetch(url, requestOptions);
  },

  async put(url: string, data: unknown, options: RequestInit = {}): Promise<Response> {
    return this.authenticatedFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    });
  },

  async patch(url: string, data: unknown, options: RequestInit = {}): Promise<Response> {
    return this.authenticatedFetch(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...options
    });
  }
};