import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, File, Folder, HardDrive, ExternalLink, Edit, Trash2, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize, getCategoryLabel } from '../utils.tsx';
import AuditMeta from '@/components/AuditMeta';
import { siteUrl } from '@/lib/api';
import type { DocumentItem } from '../types';

interface DocumentCardProps {
  item: DocumentItem;
  onEdit: (item: DocumentItem) => void;
  onDelete: (item: DocumentItem) => void;
  /** True while a delete request for this document is running. */
  deleting?: boolean;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  item,
  onEdit,
  onDelete,
  deleting = false,
}) => {
  const handleOpen = () => {
    const url = item.filepath && String(item.filepath).match(/^https?:\/\//)
      ? String(item.filepath)
      : siteUrl(String(item.filepath ?? ''));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      !item.is_active && "opacity-60 bg-gray-100"
    )}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-start gap-3 mb-2">
              <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.name}
                  </h3>
                  {!item.is_active && (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                      <EyeOff className="w-3 h-3 inline mr-1" />
                      Inaktiv
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                )}
                <div className="space-y-1 text-sm text-gray-700">
                  <p className="flex items-center gap-2">
                    <File className="w-4 h-4" />
                    <strong>Datei:</strong> {item.filename}
                  </p>
                  {item.category && (
                    <p className="flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      <strong>Kategorie:</strong> {getCategoryLabel(item.category)}
                    </p>
                  )}
                  {item.file_size && (
                    <p className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      <strong>Größe:</strong> {formatFileSize(item.file_size)}
                    </p>
                  )}
                </div>
                <AuditMeta updatedAt={item.updated_at} updatedBy={item.updated_by} />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpen}
              className="flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="sm:inline">Öffnen</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(item)}
              className="flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <Edit className="w-4 h-4" />
              <span className="sm:inline">Bearbeiten</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(item)}
              disabled={deleting}
              className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span className="sm:inline">{deleting ? 'Wird gelöscht...' : 'Löschen'}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
