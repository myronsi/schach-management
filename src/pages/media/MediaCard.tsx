import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import type { MediaItem } from './types';
import { parseChildren, buildFullSrc } from './utils';
import { BASE_URL } from './constants';

interface MediaCardProps {
  media: MediaItem;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, onEdit, onDelete }) => {
  const childrenArray = parseChildren(media.children);
  const displaySrc = buildFullSrc(media.src, BASE_URL);

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{media.title}</h3>
            
            {/* Image Preview */}
            {media.src && (
              <div className="mb-3">
                <img 
                  src={displaySrc} 
                  alt={media.title}
                  className="w-full max-w-md h-48 object-cover rounded-lg border border-gray-200"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="text-sm text-gray-600 mb-2">
              <span className="font-medium">Pfad:</span> 
              <a href={displaySrc} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline break-all">
                {media.src}
              </a>
            </div>
            <p className="mt-2 text-gray-700 break-words">{media.description}</p>
            {childrenArray.length > 0 && (
              <div className="mt-2">
                <span className="text-sm font-medium text-gray-600">Bilder: </span>
                <span className="text-sm text-gray-600">{childrenArray.length} Bild(er)</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(media)}
              className="flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <Edit className="w-4 h-4" />
              <span className="sm:inline">Bearbeiten</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(media)}
              className="flex items-center justify-center gap-1 text-red-600 hover:text-red-700 w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span className="sm:inline">Löschen</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
