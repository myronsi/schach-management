import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EyeOff, Trash2, AlertTriangle, ChevronRight, X } from 'lucide-react';
import type { DocumentItem } from '../types';

interface DeleteDialogProps {
  open: boolean;
  item: DocumentItem | null;
  onClose: () => void;
  onDeactivate: (item: DocumentItem) => void;
  onHardDelete: (item: DocumentItem) => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  item,
  onClose,
  onDeactivate,
  onHardDelete,
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Dokument löschen</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                Wählen Sie die gewünschte Löschmethode
              </p>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              Dokument: <strong className="text-gray-900">"{item?.name}"</strong>
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              className="w-full text-left p-4 rounded-lg border-2 border-yellow-200 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-300 transition-all group"
              onClick={() => item && onDeactivate(item)}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center flex-shrink-0 group-hover:bg-yellow-300 transition-colors">
                  <EyeOff className="w-5 h-5 text-yellow-700" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    Deaktivieren
                    <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full">
                      Empfohlen
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Dokument wird ausgeblendet, bleibt aber in der Datenbank und kann jederzeit reaktiviert werden
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-yellow-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            <button
              className="w-full text-left p-4 rounded-lg border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all group"
              onClick={() => item && onHardDelete(item)}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0 group-hover:bg-red-300 transition-colors">
                  <Trash2 className="w-5 h-5 text-red-700" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    Dauerhaft löschen
                    <span className="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded-full">
                      Vorsicht
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Dokument wird vollständig aus der Datenbank entfernt und kann nicht wiederhergestellt werden!
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-red-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              className="w-full"
              onClick={onClose}
            >
              <X className="w-4 h-4 mr-2" />
              Abbrechen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
