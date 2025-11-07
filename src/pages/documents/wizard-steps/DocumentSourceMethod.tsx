import React from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileSearch, Link, CheckCircle } from 'lucide-react';

interface DocumentSourceMethodProps {
  selectedMethod: 'upload' | 'manual' | 'scan' | null;
  onMethodSelect: (method: 'upload' | 'manual' | 'scan') => void;
}

export const DocumentSourceMethod: React.FC<DocumentSourceMethodProps> = ({
  selectedMethod,
  onMethodSelect,
}) => {
  return (
    <div className="space-y-4">
      <Label className="text-base">Wie möchten Sie das Dokument hinzufügen?</Label>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedMethod === 'upload' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}
          onClick={() => onMethodSelect('upload')}
        >
          <CardContent className="p-6 text-center">
            <Upload className="w-12 h-12 mx-auto mb-3 text-blue-600" />
            <h3 className="font-semibold mb-2">Datei hochladen</h3>
            <p className="text-sm text-gray-600">
              Laden Sie ein Dokument von Ihrem Computer hoch
            </p>
            <div className="mt-3 text-xs text-gray-500">
              Unterstützt: PDF, Word, Excel, PowerPoint, ZIP, Bilder
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedMethod === 'scan' ? 'ring-2 ring-green-500 bg-green-50' : ''
          }`}
          onClick={() => onMethodSelect('scan')}
        >
          <CardContent className="p-6 text-center">
            <FileSearch className="w-12 h-12 mx-auto mb-3 text-green-600" />
            <h3 className="font-semibold mb-2">Verzeichnis scannen</h3>
            <p className="text-sm text-gray-600">
              Suchen Sie nach bereits hochgeladenen Dateien
            </p>
            <div className="mt-3 text-xs text-gray-500">
              Durchsucht Server-Ordner nach vorhandenen Dokumenten
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedMethod === 'manual' ? 'ring-2 ring-purple-500 bg-purple-50' : ''
          }`}
          onClick={() => onMethodSelect('manual')}
        >
          <CardContent className="p-6 text-center">
            <Link className="w-12 h-12 mx-auto mb-3 text-purple-600" />
            <h3 className="font-semibold mb-2">Pfad/URL eingeben</h3>
            <p className="text-sm text-gray-600">
              Geben Sie einen Dateipfad oder eine URL ein
            </p>
            <div className="mt-3 text-xs text-gray-500">
              Für externe Links oder spezifische Pfade
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedMethod && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold mb-1">
                {selectedMethod === 'upload' && 'Datei hochladen ausgewählt'}
                {selectedMethod === 'scan' && 'Verzeichnis scannen ausgewählt'}
                {selectedMethod === 'manual' && 'Manuell eingeben ausgewählt'}
              </p>
              <p>
                Klicken Sie auf "Weiter", um fortzufahren
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
