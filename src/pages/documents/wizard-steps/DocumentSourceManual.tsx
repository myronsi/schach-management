import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Globe, HardDrive, File, CheckCircle, Info } from 'lucide-react';

interface DocumentSourceManualProps {
  form: any;
  onFormChange: (updates: any) => void;
}

export const DocumentSourceManual: React.FC<DocumentSourceManualProps> = ({
  form,
  onFormChange,
}) => {
  const isUrl = form.filepath && (form.filepath.startsWith('http://') || form.filepath.startsWith('https://'));

  return (
    <div className="space-y-4">
      <Label className="text-base flex items-center gap-2">
        <Link className="w-5 h-5 text-purple-600" />
        Dateipfad oder URL eingeben
      </Label>

      <div className="space-y-2">
        <Label htmlFor="manual-path">Pfad oder URL zur Datei</Label>
        <Input
          id="manual-path"
          value={form.filepath || ''}
          onChange={(e) => onFormChange({ 
            filepath: e.target.value,
            filename: e.target.value.split('/').pop() || e.target.value
          })}
          placeholder="z.B. /docs/statuten/vereinsstatuten.pdf oder https://example.com/dokument.pdf"
          className="text-base"
        />
        <p className="text-xs text-gray-500">
          Geben Sie entweder einen relativen Pfad (z.B. /docs/statuten/dokument.pdf) oder eine vollständige URL ein
        </p>
      </div>

      {form.filepath && (
        <div className="space-y-3">
          <div className={`border rounded-lg p-4 ${isUrl ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}>
            <div className="flex items-start gap-3">
              {isUrl ? (
                <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              ) : (
                <HardDrive className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm flex-1">
                <p className="font-semibold mb-1">
                  {isUrl ? 'Externe URL erkannt' : 'Lokaler Pfad erkannt'}
                </p>
                <p className={isUrl ? 'text-blue-900' : 'text-purple-900'}>
                  {isUrl 
                    ? 'Diese Datei wird von einer externen Quelle verlinkt'
                    : 'Diese Datei befindet sich auf dem Server'
                  }
                </p>
              </div>
            </div>
          </div>

          {form.filename && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <Label className="text-sm font-semibold mb-2 block">Automatisch erkannter Dateiname:</Label>
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-900 font-mono">{form.filename}</span>
              </div>
            </div>
          )}

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-900">
                <p className="font-semibold mb-1">Pfad eingegeben</p>
                <p>
                  Klicken Sie auf "Weiter", um fortzufahren
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-2">Beispiele für gültige Pfade:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>/docs/statuten/vereinsstatuten.pdf</li>
              <li>/docs/protokolle/2024/hauptversammlung.pdf</li>
              <li>https://example.com/downloads/dokument.pdf</li>
              <li>https://sc-laufenburg.de/files/bericht.pdf</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
