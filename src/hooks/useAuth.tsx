import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const checkAuthStatus = async () => {
    const savedUsername = localStorage.getItem('auth_username');
    const savedSession = localStorage.getItem('auth_session_id');
    if (savedUsername && savedSession) {
      try {
        const res = await fetch('https://viserix.com/auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check', username: savedUsername, session_id: savedSession })
        });
        const data = await res.json();
          if (res.ok && data && data.success) {
            if (data.status && data.status === 'admin') {
              setIsAuthenticated(true);
              setUsername(savedUsername);
              return;
            } else {
              localStorage.removeItem('auth_username');
              localStorage.removeItem('auth_session_id');
              localStorage.removeItem('loginTimestamp');
              setIsAuthenticated(false);
              setUsername(null);
              return;
            }
          }
      } catch (err) {
      }
    }

    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_session_id');
    localStorage.removeItem('loginTimestamp');
    setIsAuthenticated(false);
    setUsername(null);
  };

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('https://viserix.com/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data && data.success) {
        if (data.status && data.status === 'admin') {
          if (data.session_id) {
            localStorage.setItem('auth_username', username);
            localStorage.setItem('auth_session_id', data.session_id);
            localStorage.setItem('loginTimestamp', new Date().toISOString());
          }
          setIsAuthenticated(true);
          setUsername(username);
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

  const logout = () => {
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_session_id');
    localStorage.removeItem('loginTimestamp');
    setIsAuthenticated(false);
    setUsername(null);
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
      checkAuthStatus
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