import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authToken, jwtUtils } from '@/lib/auth-utils';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  renewToken: () => Promise<{ success: boolean; message: string }>;
  isAuthChecked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      const success = await authToken.autoRenew();
      if (!success) {
        console.log('Auto-renewal failed, logging out user');
        await logout();
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const checkAuthStatus = async () => {
    let savedToken = authToken.get();
    
    if (savedToken) {
      if (jwtUtils.isExpired(savedToken)) {
        authToken.remove();
        setIsAuthenticated(false);
        setUsername(null);
        setIsAuthChecked(true);
        return;
      }

      const tokenUsername = jwtUtils.getUsername(savedToken);

      if (authToken.needsRenewal()) {
        const renewalResult = await authToken.renewToken();
        if (renewalResult.success && renewalResult.token) {
          savedToken = renewalResult.token;
        } else {
        }
      }

      try {
        const res = await fetch('https://sc-laufenburg.de/api/auth.php', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${savedToken}`
          },
          body: JSON.stringify({ 
            action: 'validate',
            token: savedToken
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          
          if (data && data.success) {
            if (data.status && data.status === 'admin') {
              setIsAuthenticated(true);
              setUsername(tokenUsername);
              setIsAuthChecked(true);
              return;
            } else {
              console.log('User does not have admin status');
              authToken.remove();
              setIsAuthenticated(false);
              setUsername(null);
              setIsAuthChecked(true);
              return;
            }
          } else {
            console.log('Token validation failed:', data);
            authToken.remove();
            setIsAuthenticated(false);
            setUsername(null);
          }
        } else {
          console.error('Server error during auth check:', res.status, res.statusText);
        }
      } catch (err) {
        console.error('Auth check network error:', err);
      }
    }

    const stillHasToken = authToken.exists();
    if (!stillHasToken) {
      setIsAuthenticated(false);
      setUsername(null);
    }

    setIsAuthChecked(true);
  };

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('https://sc-laufenburg.de/api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok && data && data.success) {
        if (data.status && data.status === 'admin') {
          if (data.token) {
            authToken.set(data.token);
            
            const tokenUsername = jwtUtils.getUsername(data.token);
            setIsAuthenticated(true);
            setUsername(tokenUsername);
          }
          return data;
        } else {
          return { success: false, message: 'Nicht genügend Rechte' };
        }
      }
      return data;
    } catch (err) {
      return { success: false, message: 'Network error' };
    }
  };

  const logout = async () => {
    const savedToken = authToken.get();
    
    if (savedToken) {
      try {
        await fetch('https://sc-laufenburg.de/api/auth.php', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${savedToken}`
          },
          body: JSON.stringify({ 
            action: 'logout',
            token: savedToken
          })
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    
    authToken.remove();
    setIsAuthenticated(false);
    setUsername(null);
  };

  const renewToken = async (): Promise<{ success: boolean; message: string }> => {
    const result = await authToken.renewToken();
    if (result.success) {
      const newUsername = authToken.getUsername();
      setUsername(newUsername);
    }
    return result;
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      username,
      login,
      logout,
      checkAuthStatus,
      renewToken,
      isAuthChecked
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const getAuthToken = (): string | null => {
  return authToken.get();
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};