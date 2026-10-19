import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { authToken } from '@/lib/auth-utils';
import { apiUrl } from '@/lib/api';
import { readJson } from '@/lib/api-errors';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z.string().min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein'),
  confirmPassword: z.string().min(1, 'Bitte bestätigen Sie das neue Passwort'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Die neuen Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
});

type PasswordForm = z.infer<typeof passwordSchema>;

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { passwordChanged, logout } = useAuth();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (data: PasswordForm) => {
    setIsLoading(true);
    setError('');
    const token = authToken.get();
    if (!token) {
      await logout();
      navigate('/login', { replace: true });
      return;
    }

    try {
      const response = await fetch(apiUrl('auth.php'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          action: 'set_password',
          token,
          current_password: data.currentPassword,
          new_password: data.newPassword,
        }),
      });
      const result = await readJson<{ token?: string; message?: string; must_change_password?: boolean }>(response);
      if (!response.ok || !result.success) {
        setError(result.message || 'Passwort konnte nicht geändert werden.');
        return;
      }
      passwordChanged(result.token);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Netzwerkfehler. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Passwort ändern</CardTitle>
            <CardDescription className="text-center">
              Aus Sicherheitsgründen müssen Sie Ihr Passwort vor der ersten Nutzung ändern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="currentPassword" type={showCurrent ? 'text' : 'password'} className="pl-10 pr-10" {...register('currentPassword')} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowCurrent(!showCurrent)} aria-label={showCurrent ? 'Passwort verbergen' : 'Passwort anzeigen'}>{showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
                {errors.currentPassword && <p className="text-sm text-red-600">{errors.currentPassword.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Neues Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="newPassword" type={showNew ? 'text' : 'password'} className="pl-10 pr-10" {...register('newPassword')} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowNew(!showNew)} aria-label={showNew ? 'Passwort verbergen' : 'Passwort anzeigen'}>{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
                {errors.newPassword && <p className="text-sm text-red-600">{errors.newPassword.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} className="pl-10 pr-10" {...register('confirmPassword')} />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Passwort verbergen' : 'Passwort anzeigen'}>{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Wird geändert...' : 'Passwort ändern'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChangePassword;
