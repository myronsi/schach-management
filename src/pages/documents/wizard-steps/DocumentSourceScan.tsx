import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  FileSearch, 
  Loader2, 
  Search, 
  Info, 
  CheckCircle, 
  X, 
  ArrowRight 
} from 'lucide-react';
import { formatFileSize, getFileIcon } from '../utils.tsx';

interface UploadedFile {
  filepath: string;
  filename: string;
  size: number;
  category: string;
}

interface DocumentSourceScanProps {
  scanning: boolean;
  scannedFiles: UploadedFile[];
  scanPath: string;
  onScanPathChange: (path: string) => void;
  onScanDirectory: () => void;
  onImportFile: (file: UploadedFile) => void;
  onClearScanned: () => void;
}

export const DocumentSourceScan: React.FC<DocumentSourceScanProps> = ({
  scanning,
  scannedFiles,
  scanPath,
  onScanPathChange,
  onScanDirectory,
  onImportFile,
  onClearScanned,
}) => {
  return (
    <div className="space-y-4">
      <Label className="text-base flex items-center gap-2">
        <FileSearch className="w-5 h-5 text-green-600" />
        Verzeichnis scannen
      </Label>

      <div className="space-y-3">
        <div>
          <Label htmlFor="scan-path" className="text-sm">
            Pfad zum Verzeichnis
          </Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="scan-path"
              value={scanPath}
              onChange={(e) => onScanPathChange(e.target.value)}
              placeholder="z.B. statuten, protokolle/2024, oder leer für alle"
              className="flex-1"
            />
            <Button
              onClick={onScanDirectory}
              disabled={scanning}
              className="flex-shrink-0"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanne...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Scannen
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Geben Sie einen relativen Pfad ein (z.B. "statuten") oder lassen Sie es leer, um alle Dokumente zu scannen
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">So funktioniert's</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Der Scan durchsucht den Server-Ordner /docs/</li>
                <li>Sie können einen Unterordner angeben oder alles durchsuchen</li>
                <li>Klicken Sie auf eine gefundene Datei, um sie zu importieren</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {scannedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base text-green-700 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {scannedFiles.length} Datei(en) gefunden
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearScanned}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4 mr-1" />
              Liste leeren
            </Button>
          </div>

          <div className="grid gap-3 max-h-96 overflow-y-auto">
            {scannedFiles.map((file, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 hover:bg-green-50 hover:border-green-300 transition-all cursor-pointer"
                onClick={() => onImportFile(file)}
              >
                <div className="flex items-start gap-3">
                  {getFileIcon(file.filename)}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {file.filename}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Größe: {formatFileSize(file.size)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {file.filepath}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-green-600 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-900">
              <Info className="w-4 h-4 inline mr-1" />
              Klicken Sie auf eine Datei, um sie in das Formular zu importieren
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
