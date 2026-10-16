import React, { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpUtils } from '@/lib/auth-utils';
import { useToast } from '@/hooks/use-toast';
import { Check, X, FileText, UserRound } from 'lucide-react';

const API = 'https://sc-laufenburg.de/api/membership-applications.php';

interface Application {
  id: number;
  status: 'submitted' | 'approved' | 'rejected';
  first_name: string;
  last_name: string;
  address: string;
  postal_city: string;
  birth_date: string;
  birth_place: string;
  phone: string;
  email: string;
  nationality: string;
  gender: string;
  membership_type: string;
  previous_club: string;
  direct_debit: boolean;
  bank_name: string;
  bic: string;
  iban: string;
  account_holder: string;
  application_place: string;
  application_date: string;
  guardian_signature: string;
  debit_signature: string;
  signed_at: string;
  submitted_at: string;
  signature: string;
}

const fetchApplications = async (): Promise<Application[]> => {
  const res = await httpUtils.authenticatedFetch(API);
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || 'Fehler beim Laden');
  return data;
};

const updateApplication = async (id: number, status: 'approved' | 'rejected') => {
  const res = await httpUtils.patch(API, { id, status });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.message || 'Fehler beim Speichern');
  return data;
};

const MembershipApplications: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Application | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['membership-applications'],
    queryFn: fetchApplications,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      updateApplication(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-applications'] });
      setSelected(null);
      toast({ title: 'Gespeichert', description: 'Der Mitgliedsantrag wurde aktualisiert.' });
    },
    onError: (err: Error) => toast({ title: 'Fehler', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Mitgliedsanträge" />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Mitgliedsanträge</h1>
              <p className="text-gray-600 mt-1">Nur für den Vorsitzenden sichtbar.</p>
            </div>
            <Badge variant="outline">{data.filter(a => a.status === 'submitted').length} offen</Badge>
          </div>

          {isLoading && <div className="text-center py-10">Lade Anträge...</div>}
          {error && <Card><CardContent className="p-6 text-center text-red-600">Fehler beim Laden der Anträge.</CardContent></Card>}

          <div className="grid gap-4">
            {data.map((application) => (
              <Card key={application.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(application)}>
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <UserRound className="w-5 h-5 mt-1 text-gray-500" />
                    <div>
                      <h2 className="font-semibold text-gray-900">{application.first_name} {application.last_name}</h2>
                      <p className="text-sm text-gray-600">{application.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Eingegangen: {new Date(application.submitted_at).toLocaleString('de-DE')}</p>
                    </div>
                  </div>
                  <Badge>{application.status === 'submitted' ? 'Neu' : application.status === 'approved' ? 'Angenommen' : 'Abgelehnt'}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.length === 0 && !isLoading && !error && (
            <Card><CardContent className="p-8 text-center text-gray-500">Keine Mitgliedsanträge vorhanden.</CardContent></Card>
          )}

          {selected && (
            <div className="fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto" onClick={() => setSelected(null)}>
              <div className="max-w-3xl mx-auto my-8" onClick={(e) => e.stopPropagation()}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Mitgliedsantrag</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        ['Vorname', selected.first_name], ['Nachname', selected.last_name],
                        ['PLZ, Wohnort', selected.postal_city], ['Strasse', selected.address],
                        ['Geburtsdatum', selected.birth_date], ['Geburtsort', selected.birth_place],
                        ['Telefon', selected.phone], ['E-Mail', selected.email],
                        ['Staatsangehörigkeit', selected.nationality], ['Geschlecht', selected.gender],
                        ['Mitgliedschaft', selected.membership_type], ['Früherer Verein', selected.previous_club],
                        ['Ort', selected.application_place], ['Datum', selected.application_date],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="text-xs text-gray-500">{label}</div>
                          <div className="font-medium">{value || '—'}</div>
                        </div>
                      ))}
                    </div>

                    {selected.direct_debit && (
                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-3">Einzugsermächtigung</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div><span className="text-gray-500">Kreditinstitut:</span> {selected.bank_name || '—'}</div>
                          <div><span className="text-gray-500">BIC:</span> {selected.bic || '—'}</div>
                          <div><span className="text-gray-500">IBAN:</span> {selected.iban || '—'}</div>
                          <div><span className="text-gray-500">Kontoinhaber:</span> {selected.account_holder || '—'}</div>
                        </div>
                      </div>
                    )}

                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">Digitale Unterschrift</h3>
                      {selected.signature && <img src={selected.signature} alt="Unterschrift Antragsteller" className="max-h-28 border bg-white" />}
                      {selected.guardian_signature && <div className="mt-4"><div className="text-sm font-medium mb-1">Gesetzlicher Vertreter</div><img src={selected.guardian_signature} alt="Unterschrift gesetzlicher Vertreter" className="max-h-28 border bg-white" /></div>}
                      {selected.debit_signature && <div className="mt-4"><div className="text-sm font-medium mb-1">Unterschrift Einzugsermächtigung</div><img src={selected.debit_signature} alt="Unterschrift Einzugsermächtigung" className="max-h-28 border bg-white" /></div>}
                      <p className="text-xs text-gray-500 mt-2">Signiert am {new Date(selected.signed_at).toLocaleString('de-DE')}</p>
                    </div>

                    {selected.status === 'submitted' && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => mutation.mutate({ id: selected.id, status: 'approved' })}
                          disabled={mutation.isPending}
                          className="flex-1"
                        >
                          <Check className="w-4 h-4 mr-2" /> Antrag annehmen
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => mutation.mutate({ id: selected.id, status: 'rejected' })}
                          disabled={mutation.isPending}
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-2" /> Antrag ablehnen
                        </Button>
                      </div>
                    )}

                    <Button variant="outline" onClick={() => setSelected(null)} className="w-full">Schließen</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MembershipApplications;
