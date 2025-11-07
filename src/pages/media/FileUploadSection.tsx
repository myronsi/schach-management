import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileSearch, Download } from 'lucide-react';
import { buildFullSrc } from './utils';
import { BASE_URL } from './constants';

interface FileUploadSectionProps {
  formTitle: string;
  uploading: boolean;
  scanning: boolean;
  scannedFiles: string[];
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onScanDirectory: () => void;
  onImportScannedFiles: () => void;
  onImportSingleFile: (filePath: string) => void;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  formTitle,
  uploading,
  scanning,
  scannedFiles,
  onFileUpload,
  onScanDirectory,
  onImportScannedFiles,
  onImportSingleFile,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="file-upload" className="block mb-2">
          Dateien hochladen
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="file-upload"
            type="file"
            multiple
            onChange={onFileUpload}
            disabled={uploading || !formTitle}
            className="flex-1"
          />
          {uploading && (
            <span className="text-sm text-gray-500">Hochladen...</span>
          )}
        </div>
        {!formTitle && (
          <p className="text-xs text-red-500 mt-1">
            Bitte zuerst einen Titel eingeben
          </p>
        )}
      </div>

      <div>
        <Label className="block mb-2">Verzeichnis scannen</Label>
        <Button
          type="button"
          variant="outline"
          onClick={onScanDirectory}
          disabled={scanning || !formTitle}
          className="w-full"
        >
          <FileSearch className="w-4 h-4 mr-2" />
          {scanning ? 'Scanne...' : 'Verzeichnis scannen'}
        </Button>
      </div>

      {scannedFiles.length > 0 && (
        <div>
          <Label className="block mb-2">
            Gefundene Dateien ({scannedFiles.length}) - Klicken Sie auf ein Bild zum Importieren
          </Label>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
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
                        {file}
                      </p>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onImportScannedFiles}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Alle importieren
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
