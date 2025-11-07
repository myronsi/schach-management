import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DocumentBasicInfo } from './wizard-steps/DocumentBasicInfo';
import { DocumentSourceMethod } from './wizard-steps/DocumentSourceMethod';
import { DocumentSourceUpload } from './wizard-steps/DocumentSourceUpload';
import { DocumentSourceScan } from './wizard-steps/DocumentSourceScan';
import { DocumentSourceManual } from './wizard-steps/DocumentSourceManual';
import { DocumentReview } from './wizard-steps/DocumentReview';

interface DocumentItem {
  id?: number;
  name: string;
  filename: string;
  filepath: string;
  category: string | null;
  description: string | null;
  file_size: number | null;
  is_active: boolean;
}

interface UploadedFile {
  filepath: string;
  filename: string;
  size: number;
  category: string;
}

interface DocumentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: DocumentItem | null;
  form: Partial<DocumentItem>;
  onFormChange: (updates: Partial<DocumentItem>) => void;
  uploading: boolean;
  uploadedFiles: UploadedFile[];
  scanning: boolean;
  scannedFiles: UploadedFile[];
  scanPath: string;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImportFile: (file: UploadedFile) => void;
  onClearUploads: () => void;
  onScanPathChange: (path: string) => void;
  onScanDirectory: () => void;
  onClearScanned: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const DocumentWizard: React.FC<DocumentWizardProps> = ({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  uploading,
  uploadedFiles,
  scanning,
  scannedFiles,
  scanPath,
  onFileUpload,
  onImportFile,
  onClearUploads,
  onScanPathChange,
  onScanDirectory,
  onClearScanned,
  onSubmit,
  onCancel,
}) => {
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<'upload' | 'manual' | 'scan' | null>(null);

  const resetWizard = () => {
    setStep(1);
    setSelectedMethod(null);
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetWizard();
    onCancel();
  };

  const handleComplete = () => {
    onSubmit();
    resetWizard();
  };

  if (editing) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dokument bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Details des Dokuments
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name <span className="text-red-500">*</span></Label>
              <Input 
                id="edit-name" 
                placeholder="z.B. Jahresbericht 2024" 
                value={form.name || ''} 
                onChange={(e) => onFormChange({ name: e.target.value })}
                className={!form.name || String(form.name).trim() === '' ? 'border-red-300' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Kategorie</Label>
              <Select 
                value={form.category || 'none'} 
                onValueChange={(value) => onFormChange({ category: value === 'none' ? null : value })}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Kategorie auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Kategorie</SelectItem>
                  <SelectItem value="statuten">Statuten</SelectItem>
                  <SelectItem value="protokolle">Protokolle</SelectItem>
                  <SelectItem value="formulare">Formulare</SelectItem>
                  <SelectItem value="berichte">Berichte</SelectItem>
                  <SelectItem value="sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-filepath">Dateipfad / URL <span className="text-red-500">*</span></Label>
              <Input 
                id="edit-filepath" 
                placeholder="z.B. https://example.com/dokument.pdf" 
                value={form.filepath || ''} 
                onChange={(e) => onFormChange({ filepath: e.target.value })}
                className={!form.filepath || String(form.filepath).trim() === '' ? 'border-red-300' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-filename">Dateiname</Label>
              <Input 
                id="edit-filename" 
                placeholder="Wird automatisch aus Dateipfad generiert" 
                value={form.filename || ''} 
                onChange={(e) => onFormChange({ filename: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Beschreibung</Label>
              <Textarea 
                id="edit-description" 
                placeholder="Optional: Kurze Beschreibung des Dokuments" 
                value={form.description || ''} 
                onChange={(e) => onFormChange({ description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-filesize">Dateigröße (Bytes)</Label>
                <Input 
                  id="edit-filesize" 
                  type="number"
                  min="0"
                  placeholder="Optional" 
                  value={form.file_size ?? ''} 
                  onChange={(e) => onFormChange({ file_size: parseInt(e.target.value) || null })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <div>
                <Label htmlFor="edit-active" className="cursor-pointer">Aktiv</Label>
                <p className="text-xs text-gray-500">Dokument ist sichtbar und verfügbar</p>
              </div>
              <Switch
                id="edit-active"
                checked={form.is_active ?? true}
                onCheckedChange={(checked) => onFormChange({ is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleComplete}
              disabled={!form.name || !form.filepath}
            >
              Aktualisieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const totalSteps = 4;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Dokument erstellen - Schritt {step} von {totalSteps}</DialogTitle>
          <DialogDescription>
            {step === 1 && "Geben Sie die grundlegenden Informationen ein"}
            {step === 2 && "Wählen Sie, wie Sie das Dokument hinzufügen möchten"}
            {step === 3 && selectedMethod === 'upload' && "Laden Sie Ihre Datei hoch"}
            {step === 3 && selectedMethod === 'scan' && "Suchen Sie nach bereits hochgeladenen Dateien"}
            {step === 3 && selectedMethod === 'manual' && "Geben Sie den Pfad zur Datei ein"}
            {step === 4 && "Überprüfen Sie die Angaben und speichern Sie"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <DocumentBasicInfo
              form={form}
              onFormChange={onFormChange}
            />
          )}

          {/* Step 2: Choose Method */}
          {step === 2 && (
            <DocumentSourceMethod
              selectedMethod={selectedMethod}
              onMethodSelect={setSelectedMethod}
            />
          )}

          {/* Step 3: Execute chosen method */}
          {step === 3 && selectedMethod === 'upload' && (
            <DocumentSourceUpload
              form={form}
              uploading={uploading}
              uploadedFiles={uploadedFiles}
              onFileUpload={onFileUpload}
              onImportFile={onImportFile}
              onClearUploads={onClearUploads}
            />
          )}

          {step === 3 && selectedMethod === 'scan' && (
            <DocumentSourceScan
              scanning={scanning}
              scannedFiles={scannedFiles}
              scanPath={scanPath}
              onScanPathChange={onScanPathChange}
              onScanDirectory={onScanDirectory}
              onImportFile={onImportFile}
              onClearScanned={onClearScanned}
            />
          )}

          {step === 3 && selectedMethod === 'manual' && (
            <DocumentSourceManual
              form={form}
              onFormChange={onFormChange}
            />
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <DocumentReview
              form={form}
              onFormChange={onFormChange}
            />
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Zurück
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              Abbrechen
            </Button>
            
            {step < totalSteps && (
              <Button 
                onClick={() => {
                  if (step === 1 && (!form.name?.trim() || !form.category)) {
                    return;
                  }
                  if (step === 2 && !selectedMethod) {
                    return;
                  }
                  if (step === 3 && !form.filepath?.trim()) {
                    return;
                  }
                  setStep(step + 1);
                }}
                disabled={
                  (step === 1 && (!form.name?.trim() || !form.category)) ||
                  (step === 2 && !selectedMethod) ||
                  (step === 3 && !form.filepath?.trim())
                }
              >
                Weiter
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            
            {step === totalSteps && (
              <Button 
                onClick={handleComplete}
                disabled={!form.name || !form.filepath}
              >
                Dokument erstellen
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
