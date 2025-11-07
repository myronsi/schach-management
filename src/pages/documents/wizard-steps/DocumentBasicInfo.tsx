import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Folder, Info } from 'lucide-react';

interface DocumentBasicInfoProps {
  form: any;
  onFormChange: (updates: any) => void;
}

export const DocumentBasicInfo: React.FC<DocumentBasicInfoProps> = ({ form, onFormChange }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="doc-name" className="text-base flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Dokumentname <span className="text-red-500">*</span>
        </Label>
        <Input
          id="doc-name"
          value={form.name || ''}
          onChange={(e) => onFormChange({ name: e.target.value })}
          placeholder="z.B. Jahresbericht 2024, Vereinsstatuten, Protokoll Hauptversammlung"
          className="text-lg"
          autoFocus
        />
        <p className="text-sm text-gray-500">
          Unter diesem Namen wird das Dokument in der Liste angezeigt
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-category" className="text-base flex items-center gap-2">
          <Folder className="w-5 h-5 text-blue-600" />
          Kategorie <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.category || 'none'}
          onValueChange={(value) => onFormChange({ category: value === 'none' ? null : value })}
        >
          <SelectTrigger id="doc-category" className="text-base">
            <SelectValue placeholder="Bitte wählen Sie eine Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Bitte wählen...</SelectItem>
            <SelectItem value="statuten">Statuten</SelectItem>
            <SelectItem value="protokolle">Protokolle</SelectItem>
            <SelectItem value="formulare">Formulare</SelectItem>
            <SelectItem value="berichte">Berichte</SelectItem>
            <SelectItem value="sonstiges">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-500">
          Die Kategorie bestimmt, in welchem Ordner die Datei gespeichert wird
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Tipp</p>
            <p>
              Wählen Sie einen aussagekräftigen Namen und die passende Kategorie.
              Im nächsten Schritt können Sie die Datei hochladen oder verlinken.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
