import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  X, 
  ArrowRight, 
  Info 
} from 'lucide-react';
import { formatFileSize, getFileIcon } from '../utils.tsx';

interface UploadedFile {
  filepath: string;
  filename: string;
  size: number;
  category: string;
}

interface DocumentSourceUploadProps {
  form: any;
  uploading: boolean;
  uploadedFiles: UploadedFile[];
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImportFile: (file: UploadedFile) => void;
  onClearUploads: () => void;
}

export const DocumentSourceUpload: React.FC<DocumentSourceUploadProps> = ({
  form,
  uploading,
  uploadedFiles,
  onFileUpload,
  onImportFile,
  onClearUploads,
}) => {
  return (
    <div className="space-y-4">
      <Label className="text-base flex items-center gap-2">
        <Upload className="w-5 h-5 text-blue-600" />
        Datei hochladen
      </Label>

      {!form.category || form.category === 'none' ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <p className="font-semibold mb-1">Kategorie fehlt</p>
              <p>
                Bitte gehen Sie zurück und wählen Sie eine Kategorie aus, bevor Sie Dateien hochladen.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-base font-semibold text-gray-700 mb-2">
                Klicken Sie hier, um Dateien auszuwählen
              </div>
              <div className="text-sm text-gray-500 mb-4">
                oder ziehen Sie Dateien hierher
              </div>
            </Label>
            <Input
              id="file-upload"
              type="file"
              multiple
              onChange={onFileUpload}
              disabled={uploading}
              className="max-w-md mx-auto"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif"
            />
            {uploading && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600">Hochladen...</p>
              </div>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base text-green-700 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  {uploadedFiles.length} Datei(en) hochgeladen
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearUploads}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Alle entfernen
                </Button>
              </div>

              <div className="grid gap-3">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer"
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
                      <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <Info className="w-4 h-4 inline mr-1" />
                  Klicken Sie auf eine Datei, um sie in das Formular zu importieren
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
