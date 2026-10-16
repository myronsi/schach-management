import { createContext, useContext } from 'react';

export interface LoginResult {
  success: boolean;
  message?: string;
  status?: string;
  token?: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  role: string | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  renewToken: () => Promise<{ success: boolean; message: string }>;
  isAuthChecked: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
