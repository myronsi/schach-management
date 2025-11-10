import React, { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Edit, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { httpUtils } from '@/lib/auth-utils';

const API = 'https://sc-laufenburg.de/api/authm.php';

interface User {
  username: string;
  status: string;
  password_status: string;
}

const fetchUsers = async (): Promise<User[]> => {
  const res = await httpUtils.authenticatedFetch(API);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Access denied');
    }
    throw new Error('Failed to fetch users');
  }
  return res.json();
};

const postUser = async (payload: any) => {
  const res = await httpUtils.post(API, payload);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Failed to save');
  }
  return data;
};

const UsersAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<User[], Error>({ 
    queryKey: ['users'], 
    queryFn: fetchUsers 
  });
  
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User & { password: string }>>({});
  const [showPassword, setShowPassword] = useState(false);
  
  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'success' | 'error' | 'info';
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'info'
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  const showAlert = (title: string, description: string, variant: 'success' | 'error' | 'info' = 'info') => {
    setAlertDialog({
      open: true,
      title,
      description,
      variant
    });
  };

  const showConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      onConfirm
    });
  };

  const requiredFieldsFilled = Boolean(
    form.username && String(form.username).trim() !== '' &&
    form.status && String(form.status).trim() !== '' &&
    (editing || (form.password && String(form.password).trim() !== ''))
  );

  const hasChanges = () => {
    if (!editing) return true;
    const keys: (keyof User)[] = ['username', 'status', 'password_status'];
    for (const k of keys) {
      const fVal = (form as any)[k] ?? '';
      const eVal = (editing as any)[k] ?? '';
      if (String(fVal) !== String(eVal)) return true;
    }
    if (form.password && String(form.password).trim() !== '') return true;
    return false;
  };

  const saveDisabled = !(requiredFieldsFilled && (editing ? hasChanges() : true));

  const createUpdate = useMutation<any, Error, any>({
    mutationFn: postUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ 
        title: 'Erfolg', 
        description: editing ? 'Benutzer aktualisiert' : 'Benutzer erstellt' 
      });
      setOpen(false);
      setEditing(null);
      setForm({});
      setShowPassword(false);
    },
    onError: (error: Error) => {
      if (error.message === 'Username already exists') {
        toast({ 
          title: 'Fehler', 
          description: 'Dieser Benutzername existiert bereits. Bitte wählen Sie einen anderen.',
          variant: 'destructive'
        });
      } else {
        toast({ 
          title: 'Fehler', 
          description: error.message || 'Konnte nicht speichern',
          variant: 'destructive'
        });
      }
    }
  });

  const startCreate = () => {
    setEditing(null);
    setForm({ 
      status: 'user',
      password_status: 'unchanged',
      password: ''
    });
    setShowPassword(false);
    setOpen(true);
  };

  const startEdit = (user: User) => {
    setEditing(user);
    setForm({ 
      ...user,
      password: ''
    });
    setShowPassword(false);
    setOpen(true);
  };

  const save = () => {
    const payload: any = {
      username: form.username,
      status: form.status || 'user',
      password_status: form.password_status || 'unchanged',
      is_update: !!editing
    };
    
    if (form.password && String(form.password).trim() !== '') {
      payload.password = form.password;
    }
    
    createUpdate.mutate(payload);
  };

  const handleDelete = async (user: User) => {
    showConfirm(
      'Benutzer löschen',
      `Möchten Sie den Benutzer "${user.username}" wirklich löschen?`,
      async () => {
        try {
          const res = await httpUtils.delete(API, { username: user.username });
          
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            showAlert('Erfolg', 'Benutzer wurde erfolgreich gelöscht', 'success');
          } else {
            showAlert('Fehler', 'Fehler beim Löschen', 'error');
          }
        } catch (err) {
          showAlert('Fehler', 'Netzwerkfehler', 'error');
        }
      }
    );
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'admin':
        return 'Administrator';
      case 'user':
        return 'Benutzer';
      case 'blocked':
        return 'Blockiert';
      default:
        return status;
    }
  };

  const getPasswordStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'unchanged':
        return 'bg-blue-100 text-blue-800';
      case 'changed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPasswordStatusLabel = (status: string) => {
    switch (status) {
      case 'unchanged':
        return 'Muss geändert werden';
      case 'changed':
        return 'Geändert';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Benutzerverwaltung</h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button onClick={startCreate} className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="sm:inline">Neuer Benutzer</span>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center">Lade Benutzer...</div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Fehler beim Laden der Benutzer
              </CardContent>
            </Card>
          ) : (data || []).length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center text-gray-500">
                Keine Benutzer vorhanden. Erstellen Sie den ersten Benutzer.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(data || []).map((user: User) => (
                <Card key={user.username} className="transition-all hover:shadow-md">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{user.username}</h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(user.status)}`}>
                            {getStatusLabel(user.status)}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPasswordStatusBadgeColor(user.password_status)}`}>
                            {getPasswordStatusLabel(user.password_status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(user)}
                          className="flex items-center justify-center gap-1 w-full sm:w-auto"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="sm:inline">Bearbeiten</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 w-full sm:w-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sm:inline">Löschen</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user-username">Benutzername <span className="text-red-500">*</span></Label>
                  <Input
                    id="user-username"
                    placeholder="Benutzername"
                    value={form.username || ''}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    disabled={!!editing}
                    className={!form.username || String(form.username).trim() === '' ? 'border-red-300' : ''}
                  />
                  {editing && (
                    <p className="text-xs text-gray-500">Der Benutzername kann nicht geändert werden</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-password">
                    Passwort {!editing && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id="user-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={editing ? 'Leer lassen, um nicht zu ändern' : 'Passwort'}
                      value={form.password || ''}
                      onChange={(e) => {
                        const newPassword = e.target.value;
                        if (newPassword.trim() !== '') {
                          setForm({ 
                            ...form, 
                            password: newPassword,
                            password_status: 'unchanged'
                          });
                        } else {
                          setForm({ 
                            ...form, 
                            password: newPassword
                          });
                        }
                      }}
                      className={!editing && (!form.password || String(form.password).trim() === '') ? 'border-red-300 pr-10' : 'pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-status">Status <span className="text-red-500">*</span></Label>
                  <Select
                    value={form.status || 'user'}
                    onValueChange={(value) => setForm({ ...form, status: value })}
                  >
                    <SelectTrigger id="user-status">
                      <SelectValue placeholder="Status auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="user">Benutzer</SelectItem>
                      <SelectItem value="blocked">Blockiert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-password-status">Passwort Status</Label>
                  <Select
                    value={form.password_status || 'unchanged'}
                    onValueChange={(value) => setForm({ ...form, password_status: value })}
                  >
                    <SelectTrigger id="user-password-status">
                      <SelectValue placeholder="Passwort Status auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unchanged">Unverändert (muss geändert werden)</SelectItem>
                      <SelectItem value="changed">Geändert</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    "Unverändert" = Benutzer muss das Passwort beim ersten Login ändern. "Geändert" = Benutzer kann sich normal mit erstelltem Passwort anmelden.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={save}
                  disabled={saveDisabled}
                  className="w-full"
                >
                  {editing ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AlertMessage
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
        title={alertDialog.title}
        description={alertDialog.description}
        variant={alertDialog.variant}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Löschen"
        variant="destructive"
      />
    </div>
  );
};

export default UsersAdmin;
