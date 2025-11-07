import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FileCheck, Info, FileText, Folder, Link, File, HardDrive, Edit, CheckCircle } from 'lucide-react';
import { formatFileSize, getCategoryLabel } from '../utils.tsx';

interface DocumentReviewProps {
  form: any;
  onFormChange: (updates: any) => void;
}

export const DocumentReview: React.FC<DocumentReviewProps> = ({
  form,
  onFormChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileCheck className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Überprüfen und vervollständigen</h3>
            <p className="text-sm text-blue-800">
              Überprüfen Sie die Angaben und fügen Sie optional weitere Details hinzu
            </p>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-gray-600" />
          Zusammenfassung
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-gray-600 mt-0.5" />
            <div>
              <span className="font-medium">Name:</span>{' '}
              <span className="text-gray-900">{form.name || 'Nicht angegeben'}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Folder className="w-4 h-4 text-gray-600 mt-0.5" />
            <div>
              <span className="font-medium">Kategorie:</span>{' '}
              <span className="text-gray-900">{getCategoryLabel(form.category)}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Link className="w-4 h-4 text-gray-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">Dateipfad:</span>{' '}
              <span className="text-gray-900 break-all">{form.filepath || 'Nicht angegeben'}</span>
            </div>
          </div>
          {form.filename && (
            <div className="flex items-start gap-2">
              <File className="w-4 h-4 text-gray-600 mt-0.5" />
              <div>
                <span className="font-medium">Dateiname:</span>{' '}
                <span className="text-gray-900">{form.filename}</span>
              </div>
            </div>
          )}
          {form.file_size && (
            <div className="flex items-start gap-2">
              <HardDrive className="w-4 h-4 text-gray-600 mt-0.5" />
              <div>
                <span className="font-medium">Größe:</span>{' '}
                <span className="text-gray-900">{formatFileSize(form.file_size)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optional Fields */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          <Edit className="w-5 h-5 text-gray-600" />
          Optionale Angaben
        </h4>

        <div className="space-y-2">
          <Label htmlFor="review-description">Beschreibung</Label>
          <Textarea
            id="review-description"
            value={form.description || ''}
            onChange={(e) => onFormChange({ description: e.target.value })}
            placeholder="Fügen Sie eine kurze Beschreibung hinzu (optional)"
            rows={3}
          />
          <p className="text-xs text-gray-500">
            Eine Beschreibung hilft Nutzern, das Dokument besser zu verstehen
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="review-filesize">Dateigröße (Bytes)</Label>
          <Input
            id="review-filesize"
            type="number"
            min="0"
            value={form.file_size ?? ''}
            onChange={(e) => onFormChange({ file_size: parseInt(e.target.value) || null })}
            placeholder="Optional"
          />
          <p className="text-xs text-gray-500">
            Wird automatisch bei Upload erkannt
          </p>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded border">
          <div>
            <Label htmlFor="review-active" className="cursor-pointer font-semibold">
              Dokument aktivieren
            </Label>
            <p className="text-xs text-gray-500 mt-1">
              Aktivierte Dokumente sind sofort sichtbar
            </p>
          </div>
          <Switch
            id="review-active"
            checked={form.is_active ?? true}
            onCheckedChange={(checked) => onFormChange({ is_active: checked })}
          />
        </div>
      </div>

      {/* Final Check */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-900">
            <p className="font-semibold mb-1">Bereit zum Erstellen</p>
            <p>
              Klicken Sie auf "Dokument erstellen", um das Dokument zu speichern
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
