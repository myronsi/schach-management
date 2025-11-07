import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import type { ChildItem } from './types';
import { stripBaseUrl, buildFullSrc } from './utils';
import { BASE_URL } from './constants';

interface ChildrenManagerProps {
  childrenList: ChildItem[];
  newChildSrc: string;
  newChildDescription: string;
  onNewChildSrcChange: (value: string) => void;
  onNewChildDescriptionChange: (value: string) => void;
  onAddChild: () => void;
  onRemoveChild: (index: number) => void;
  onUpdateChild: (index: number, field: 'src' | 'description', value: string) => void;
  onMoveChildUp: (index: number) => void;
  onMoveChildDown: (index: number) => void;
}

export const ChildrenManager: React.FC<ChildrenManagerProps> = ({
  childrenList,
  newChildSrc,
  newChildDescription,
  onNewChildSrcChange,
  onNewChildDescriptionChange,
  onAddChild,
  onRemoveChild,
  onUpdateChild,
  onMoveChildUp,
  onMoveChildDown,
}) => {
  return (
    <div>
      <Label className="text-base font-semibold">Bilder in der Galerie</Label>
      
      {childrenList.length > 0 && (
        <div className="space-y-2 mt-2 mb-4">
          {childrenList.map((child, index) => (
            <Card 
              key={index} 
              className={`${index === 0 ? 'bg-blue-50 border-blue-200' : ''}`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveChildUp(index)}
                      disabled={index === 0}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveChildDown(index)}
                      disabled={index === childrenList.length - 1}
                      className="h-6 w-6 p-0"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        Bild {index + 1}
                      </span>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Hauptbild
                        </Badge>
                      )}
                    </div>
                    
                    {child.src && (
                      <img 
                        src={child.src} 
                        alt={`Bild ${index + 1}`}
                        className="w-20 h-20 object-cover rounded border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}

                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Pfad zum Bild</Label>
                        <Input
                          value={child.src ? stripBaseUrl(child.src, BASE_URL) : ''}
                          onChange={(e) => {
                            const internalPath = e.target.value;
                            const fullUrl = internalPath ? buildFullSrc(internalPath, BASE_URL) : '';
                            onUpdateChild(index, 'src', fullUrl);
                          }}
                          placeholder="photos/galerie-name/bild.jpg"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Beschreibung</Label>
                        <Textarea
                          value={child.description}
                          onChange={(e) => onUpdateChild(index, 'description', e.target.value)}
                          placeholder="Beschreibung des Bildes"
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveChild(index)}
                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2 p-4 bg-gray-50 rounded-md">
        <Label className="text-sm font-medium">Neues Bild hinzufügen</Label>
        <div>
          <Label className="text-xs">Pfad zum Bild</Label>
          <Input
            value={newChildSrc ? stripBaseUrl(newChildSrc, BASE_URL) : ''}
            onChange={(e) => {
              const internalPath = e.target.value;
              const fullUrl = internalPath ? buildFullSrc(internalPath, BASE_URL) : '';
              onNewChildSrcChange(fullUrl);
            }}
            placeholder="photos/galerie-name/bild.jpg"
            className="text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Beschreibung</Label>
          <Textarea
            value={newChildDescription}
            onChange={(e) => onNewChildDescriptionChange(e.target.value)}
            placeholder="Beschreibung des Bildes"
            className="text-sm min-h-[60px]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddChild}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1" />
          Bild hinzufügen
        </Button>
      </div>
    </div>
  );
};
