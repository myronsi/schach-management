import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  hasFilters: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ hasFilters }) => {
  return (
    <Card>
      <CardContent className="p-6 sm:p-8 text-center text-gray-500">
        {hasFilters ? (
          'Keine Dokumente gefunden. Versuchen Sie eine andere Suche oder Filter.'
        ) : (
          'Keine Dokumente vorhanden. Erstellen Sie das erste Dokument.'
        )}
      </CardContent>
    </Card>
  );
};

export const ErrorState: React.FC = () => {
  return (
    <Card>
      <CardContent className="p-6 sm:p-8 text-center text-gray-500">
        Fehler beim Laden der Dokumente
      </CardContent>
    </Card>
  );
};

export const LoadingState: React.FC = () => {
  return (
    <div className="text-center">Lade Dokumente...</div>
  );
};
