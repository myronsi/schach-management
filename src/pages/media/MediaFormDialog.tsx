import React from 'react';
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
import { ChildrenManager } from './ChildrenManager';
import { FileUploadSection } from './FileUploadSection';
import type { MediaItem } from './types';
import { stripBaseUrl, buildFullSrc } from './utils';
import { BASE_URL } from './constants';

interface MediaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: MediaItem | null;
  form: Partial<MediaItem>;
  childrenList: any[];
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

export const MediaFormDialog: React.FC<MediaFormDialogProps> = ({
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Media bearbeiten' : 'Neues Media erstellen'}
          </DialogTitle>
          <DialogDescription>
            Fülle die Informationen aus und füge Children hinzu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="src">Src (interner Pfad)</Label>
            <Input
              id="src"
              value={form.src ? stripBaseUrl(form.src, BASE_URL) : ''}
              onChange={(e) => {
                const internalPath = e.target.value;
                const fullUrl = internalPath ? buildFullSrc(internalPath, BASE_URL) : '';
                onFormChange('src', fullUrl);
              }}
              placeholder="photos/titel/bild.jpg"
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

          <div>
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => onFormChange('title', e.target.value)}
              placeholder="Titel eingeben"
            />
          </div>

          <FileUploadSection
            formTitle={form.title || ''}
            uploading={uploading}
            scanning={scanning}
            scannedFiles={scannedFiles}
            onFileUpload={onFileUpload}
            onScanDirectory={onScanDirectory}
            onImportScannedFiles={onImportScannedFiles}
            onImportSingleFile={onImportSingleFile}
          />

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

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={onSubmit}>
            {editing ? 'Aktualisieren' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
