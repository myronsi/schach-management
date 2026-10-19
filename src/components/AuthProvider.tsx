import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authToken, jwtUtils, AUTH_EXPIRED_EVENT } from '@/lib/auth-utils';
import { apiUrl } from '@/lib/api';
import { readJson } from '@/lib/api-errors';
import { AuthContext } from '@/hooks/useAuth';
import type { LoginResult, AuthContextType } from '@/hooks/useAuth';

const AUTH_API = apiUrl('auth.php');
const ADMIN_ROLES = ['admin', 'chairman'];
const RENEW_INTERVAL_MS = 30 * 60 * 1000;

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    setIsAuthenticated(false);
    setUsername(null);
    setRole(null);
    setMustChangePassword(false);
  }, []);

  const endExpiredSession = useCallback((message: string, removeToken = true) => {
    if (removeToken) authToken.remove();
    clearSession();
    setSessionExpiredMessage(message);
  }, [clearSession]);

  const restoreSessionFromToken = useCallback((token: string) => {
    const tokenRole = jwtUtils.getStatus(token);
    if (!jwtUtils.isExpired(token) && tokenRole && ADMIN_ROLES.includes(tokenRole)) {
      setIsAuthenticated(true);
      setUsername(jwtUtils.getUsername(token));
      setRole(tokenRole);
    }
  }, []);

  const logout = useCallback(async () => {
    const savedToken = authToken.get();
    if (savedToken) {
      try {
        await fetch(AUTH_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${savedToken}`, 'X-Auth-Token': savedToken },
          body: JSON.stringify({ action: 'logout', token: savedToken })
        });
      } catch (err) { console.error('Logout error:', err); }
    }
    authToken.remove();
    clearSession();
    setSessionExpiredMessage(null);
  }, [clearSession]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onExpired = () => endExpiredSession('Ihre Sitzung ist abgelaufen oder wurde beendet. Bitte melden Sie sich erneut an.');
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== authToken.STORAGE_KEY) return;
      const current = authToken.get();
      if (!current) endExpiredSession('Sie wurden in einem anderen Tab abgemeldet.');
      else if (jwtUtils.getUsername(current) !== username) endExpiredSession('In einem anderen Tab wurde ein anderer Benutzer angemeldet. Bitte erneut anmelden.', false);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired); window.removeEventListener('storage', onStorage); };
  }, [isAuthenticated, username, endExpiredSession]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      const stillValid = await authToken.autoRenew();
      if (!stillValid) await logout();
    }, RENEW_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, logout]);

  const checkAuthStatus = useCallback(async () => {
    let savedToken = authToken.get();
    if (!savedToken || jwtUtils.isExpired(savedToken)) {
      if (savedToken) authToken.remove();
      clearSession();
      setIsAuthChecked(true);
      return;
    }
    if (jwtUtils.needsRenewal(savedToken)) {
      const renewalResult = await authToken.renewToken();
      if (renewalResult.success && renewalResult.token) savedToken = renewalResult.token;
      else if (renewalResult.invalid) { authToken.remove(); clearSession(); setIsAuthChecked(true); return; }
    }
    try {
      const res = await fetch(AUTH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${savedToken}`, 'X-Auth-Token': savedToken },
        body: JSON.stringify({ action: 'validate', token: savedToken })
      });
      if (res.ok) {
        const data = await readJson<{ status?: string; must_change_password?: boolean }>(res);
        if (data.success && data.status && ADMIN_ROLES.includes(data.status)) {
          setIsAuthenticated(true);
          setUsername(jwtUtils.getUsername(savedToken));
          setRole(data.status);
          setMustChangePassword(data.must_change_password === true);
        } else { authToken.remove(); clearSession(); }
      } else if (res.status === 401 || res.status === 403) { authToken.remove(); clearSession(); }
      else { console.error('Server error during auth check:', res.status, res.statusText); restoreSessionFromToken(savedToken); }
    } catch (err) { console.error('Auth check network error:', err); restoreSessionFromToken(savedToken); }
    setIsAuthChecked(true);
  }, [clearSession, restoreSessionFromToken]);

  const login = async (loginName: string, password: string): Promise<LoginResult> => {
    let res: Response;
    try {
      res = await fetch(AUTH_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginName, password }) });
    } catch { return { success: false, message: 'Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung.' }; }
    const data = await readJson<{ status?: string; token?: string; must_change_password?: boolean }>(res);
    if (!res.ok) {
      const fallback = res.status === 429 ? 'Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.' : 'Anmeldung fehlgeschlagen';
      return { success: false, message: data.message || fallback };
    }
    if (!data.success) return { success: false, message: data.message };
    if (!data.status || !ADMIN_ROLES.includes(data.status)) return { success: false, message: 'Nicht genügend Rechte' };
    if (data.token) {
      authToken.set(data.token);
      setIsAuthenticated(true);
      setUsername(jwtUtils.getUsername(data.token));
      setRole(data.status);
      setMustChangePassword(data.must_change_password === true);
      setSessionExpiredMessage(null);
    }
    return { success: true, message: data.message, status: data.status, token: data.token, must_change_password: data.must_change_password === true };
  };

  const passwordChanged = useCallback((token?: string) => {
    if (token) authToken.set(token);
    setMustChangePassword(false);
  }, []);

  useEffect(() => { void checkAuthStatus(); }, [checkAuthStatus]);

  const authContextValue: AuthContextType = {
    isAuthenticated,
    username,
    role,
    mustChangePassword,
    login,
    logout,
    passwordChanged,
    isAuthChecked,
    sessionExpiredMessage,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
