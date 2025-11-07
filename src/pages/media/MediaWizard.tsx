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
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileSearch, FolderInput, ChevronRight, ChevronLeft } from 'lucide-react';
import type { MediaItem, ChildItem } from './types';
import { ChildrenManager } from './ChildrenManager';
import { stripBaseUrl, buildFullSrc } from './utils';
import { BASE_URL } from './constants';

interface MediaWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: MediaItem | null;
  form: Partial<MediaItem>;
  childrenList: ChildItem[];
  newChildSrc: string;
  newChildDescription: string;
  uploading: boolean;
  scanning: boolean;
  scannedFiles: string[];
  onFormChange: (field: 'src' | 'title', value: string) => void;
  onNewChildSrcChange: (value: string) => void;
  onNewChildDescriptionChange: (value: string) => void;
  onAddChild: () => void;
  onRemoveChild: (index: number) => void;
  onUpdateChild: (index: number, field: 'src' | 'description', value: string) => void;
  onMoveChildUp: (index: number) => void;
  onMoveChildDown: (index: number) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onScanDirectory: () => void;
  onImportScannedFiles: () => void;
  onImportSingleFile: (filePath: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const MediaWizard: React.FC<MediaWizardProps> = ({
  open,
  onOpenChange,
  editing,
  form,
  childrenList,
  newChildSrc,
  newChildDescription,
  uploading,
  scanning,
  scannedFiles,
  onFormChange,
  onNewChildSrcChange,
  onNewChildDescriptionChange,
  onAddChild,
  onRemoveChild,
  onUpdateChild,
  onMoveChildUp,
  onMoveChildDown,
  onFileUpload,
  onScanDirectory,
  onImportScannedFiles,
  onImportSingleFile,
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galerie bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Name der Galerie</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => onFormChange('title', e.target.value)}
                placeholder="Titel eingeben"
              />
            </div>

            <div>
              <Label htmlFor="src">Hauptbild (Pfad)</Label>
              <Input
                id="src"
                value={form.src ? stripBaseUrl(form.src, BASE_URL) : ''}
                onChange={(e) => {
                  const internalPath = e.target.value;
                  const fullUrl = internalPath ? buildFullSrc(internalPath, BASE_URL) : '';
                  onFormChange('src', fullUrl);
                }}
                placeholder="photos/galerie-name/bild.jpg"
              />
              {form.src && (
                <div className="mt-2">
                  <img 
                    src={form.src} 
                    alt="Preview"
                    className="w-full max-w-sm h-40 object-cover rounded border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Bilder in dieser Galerie</Label>
              <p className="text-sm text-gray-500 mb-2">
                Verwalten Sie alle Bilder dieser Galerie
              </p>
              <ChildrenManager
                childrenList={childrenList}
                newChildSrc={newChildSrc}
                newChildDescription={newChildDescription}
                onNewChildSrcChange={onNewChildSrcChange}
                onNewChildDescriptionChange={onNewChildDescriptionChange}
                onAddChild={onAddChild}
                onRemoveChild={onRemoveChild}
                onUpdateChild={onUpdateChild}
                onMoveChildUp={onMoveChildUp}
                onMoveChildDown={onMoveChildDown}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Abbrechen
            </Button>
            <Button onClick={handleComplete}>
              Aktualisieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Galerie erstellen - Schritt {step} von 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Geben Sie einen Namen für die neue Galerie ein"}
            {step === 2 && "Wählen Sie, wie Sie Bilder hinzufügen möchten"}
            {step === 3 && selectedMethod === 'upload' && "Laden Sie Ihre Dateien hoch"}
            {step === 3 && selectedMethod === 'scan' && "Suchen Sie nach bereits hochgeladenen Dateien"}
            {step === 3 && selectedMethod === 'manual' && "Geben Sie den Pfad zu einem Bild ein"}
            {step === 4 && "Bilder bearbeiten und sortieren (optional)"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-base">Name der Galerie *</Label>
                <Input
                  id="title"
                  value={form.title || ''}
                  onChange={(e) => onFormChange('title', e.target.value)}
                  placeholder="z.B. Turnier 2024, Vereinsmeisterschaft, Sommercamp"
                  className="mt-2 text-lg"
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  Unter diesem Namen wird die Galerie gespeichert und ein Ordner für die Bilder erstellt
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label className="text-base">Wie möchten Sie Bilder hinzufügen?</Label>
              <div className="grid gap-4 md:grid-cols-3">
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedMethod === 'upload' ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedMethod('upload')}
                >
                  <CardContent className="p-6 text-center">
                    <Upload className="w-12 h-12 mx-auto mb-3 text-blue-600" />
                    <h3 className="font-semibold mb-2">Dateien hochladen</h3>
                    <p className="text-sm text-gray-600">
                      Laden Sie Bilder von Ihrem Computer hoch
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedMethod === 'scan' ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedMethod('scan')}
                >
                  <CardContent className="p-6 text-center">
                    <FileSearch className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <h3 className="font-semibold mb-2">Verzeichnis scannen</h3>
                    <p className="text-sm text-gray-600">
                      Suchen Sie nach bereits hochgeladenen Dateien
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedMethod === 'manual' ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedMethod('manual')}
                >
                  <CardContent className="p-6 text-center">
                    <FolderInput className="w-12 h-12 mx-auto mb-3 text-purple-600" />
                    <h3 className="font-semibold mb-2">Pfad manuell eingeben</h3>
                    <p className="text-sm text-gray-600">
                      Geben Sie den Pfad zu einem Bild ein
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {step === 3 && selectedMethod === 'upload' && (
            <div className="space-y-4">
              <Label className="text-base">Dateien hochladen</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <Input
                  type="file"
                  multiple
                  onChange={onFileUpload}
                  disabled={uploading}
                  className="max-w-md mx-auto"
                />
                {uploading && (
                  <p className="text-sm text-gray-500 mt-4">Hochladen...</p>
                )}
                {childrenList.length > 0 && (
                  <p className="text-sm text-green-600 mt-4">
                    ✓ {childrenList.length} Datei(en) hochgeladen
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 3 && selectedMethod === 'scan' && (
            <div className="space-y-4">
              <Label className="text-base">Verzeichnis scannen</Label>
              <Button
                type="button"
                onClick={onScanDirectory}
                disabled={scanning}
                className="w-full"
                size="lg"
              >
                <FileSearch className="w-5 h-5 mr-2" />
                {scanning ? 'Scanne Verzeichnis...' : 'Jetzt scannen'}
              </Button>

              {scannedFiles.length > 0 && (
                <div className="mt-4">
                  <Label className="block mb-2">
                    Gefundene Dateien ({scannedFiles.length}) - Klicken Sie zum Importieren
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {scannedFiles.map((file, index) => {
                      const fullSrc = buildFullSrc(file, BASE_URL);
                      return (
                        <div 
                          key={index} 
                          className="border rounded p-2 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all"
                          onClick={() => onImportSingleFile(file)}
                          title="Klicken zum Importieren"
                        >
                          <img 
                            src={fullSrc} 
                            alt={`Scanned ${index + 1}`}
                            className="w-full h-24 object-cover rounded mb-1"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <p className="text-xs text-gray-600 truncate" title={file}>
                            {file.split('/').pop()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onImportScannedFiles}
                    className="w-full mt-3"
                  >
                    Alle importieren
                  </Button>
                </div>
              )}
              
              {childrenList.length > 0 && (
                <p className="text-sm text-green-600">
                  ✓ {childrenList.length} Datei(en) importiert
                </p>
              )}
            </div>
          )}

          {step === 3 && selectedMethod === 'manual' && (
            <div className="space-y-4">
              <Label className="text-base">Pfad manuell eingeben</Label>
              <div>
                <Label htmlFor="manual-src">Pfad zum Bild</Label>
                <Input
                  id="manual-src"
                  value={form.src ? stripBaseUrl(form.src, BASE_URL) : ''}
                  onChange={(e) => {
                    const internalPath = e.target.value;
                    const fullUrl = internalPath ? buildFullSrc(internalPath, BASE_URL) : '';
                    onFormChange('src', fullUrl);
                  }}
                  placeholder="photos/galerie-name/bild.jpg"
                  className="mt-2"
                />
                {form.src && (
                  <div className="mt-3">
                    <img 
                      src={form.src} 
                      alt="Preview"
                      className="w-full max-w-sm h-40 object-cover rounded border"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label className="text-base">Bilder verwalten (optional)</Label>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  Sie können hier zusätzliche Bilder hinzufügen oder die Reihenfolge ändern
                </p>
              </div>
              
              {childrenList.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-gray-500">
                    <p>Keine Children vorhanden.</p>
                    <p className="text-sm mt-2">Children werden automatisch beim Speichern erstellt.</p>
                  </CardContent>
                </Card>
              ) : (
                <ChildrenManager
                  childrenList={childrenList}
                  newChildSrc={newChildSrc}
                  newChildDescription={newChildDescription}
                  onNewChildSrcChange={onNewChildSrcChange}
                  onNewChildDescriptionChange={onNewChildDescriptionChange}
                  onAddChild={onAddChild}
                  onRemoveChild={onRemoveChild}
                  onUpdateChild={onUpdateChild}
                  onMoveChildUp={onMoveChildUp}
                  onMoveChildDown={onMoveChildDown}
                />
              )}
            </div>
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
            
            {step < 4 && (
              <Button 
                onClick={() => {
                  if (step === 1 && !form.title?.trim()) {
                    return; // Don't proceed without title
                  }
                  if (step === 2 && !selectedMethod) {
                    return; // Don't proceed without selecting method
                  }
                  setStep(step + 1);
                }}
                disabled={
                  (step === 1 && !form.title?.trim()) ||
                  (step === 2 && !selectedMethod)
                }
              >
                Weiter
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            
            {step === 4 && (
              <Button onClick={handleComplete}>
                Media erstellen
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
