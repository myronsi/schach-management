import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  username: z.string().min(1, 'Benutzername ist erforderlich'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginProps {
  onLogin?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (isAuthenticated) {
      if (onLogin) {
        onLogin();
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, navigate, onLogin]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError('');

    try {
      const result = await login(data.username, data.password);
      if (result && result.success) {
        reset();
        if (onLogin) {
          onLogin();
        } else {
          navigate('/dashboard');
        }
      } else {
        setLoginError(result?.message || 'Ungültiger Benutzername oder Passwort');
      }
    } catch (err) {
      setLoginError('Netzwerkfehler');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Melden Sie sich an
            </CardTitle>
            <CardDescription className="text-center">
              Geben Sie Ihre Zugangsdaten ein, um die Anwendung zu nutzen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username">Benutzername</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Geben Sie Ihren Benutzernamen ein"
                    className="pl-10"
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <p className="text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Geben Sie Ihr Passwort ein"
                    className="pl-10 pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Anmelden...' : 'Anmelden'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;

export const isUserLoggedIn = (): boolean => {
  return localStorage.getItem('auth_username') !== null && localStorage.getItem('auth_session_id') !== null;
};

export const getLoggedInUser = (): string | null => {
  return localStorage.getItem('auth_username');
};

export const logoutUser = (): void => {
  localStorage.removeItem('auth_username');
  localStorage.removeItem('auth_session_id');
  localStorage.removeItem('loginTimestamp');
};

export const getLoginTimestamp = (): string | null => {
  return localStorage.getItem('loginTimestamp');
};