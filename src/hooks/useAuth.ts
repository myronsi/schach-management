import { createContext, useContext } from 'react';

export interface LoginResult {
  success: boolean;
  message?: string;
  status?: string;
  token?: string;
  must_change_password?: boolean;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  role: string | null;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  passwordChanged: (token?: string) => void;
  isAuthChecked: boolean;
  sessionExpiredMessage: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
