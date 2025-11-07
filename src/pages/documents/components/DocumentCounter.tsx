import React from 'react';
import { FileText, Eye } from 'lucide-react';

interface DocumentCounterProps {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  showInactive: boolean;
  onShowInactive: () => void;
}

export const DocumentCounter: React.FC<DocumentCounterProps> = ({
  totalCount,
  activeCount,
  inactiveCount,
  showInactive,
  onShowInactive,
}) => {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600 bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4" />
        <span>
          {showInactive ? (
            <>
              <strong>{totalCount}</strong> Dokumente gesamt
              {inactiveCount > 0 && (
                <span className="ml-2 text-gray-500">
                  ({inactiveCount} inaktiv)
                </span>
              )}
            </>
          ) : (
            <>
              <strong>{activeCount}</strong> aktive Dokumente
              {inactiveCount > 0 && (
                <span className="ml-2 text-gray-500">
                  ({inactiveCount} ausgeblendet)
                </span>
              )}
            </>
          )}
        </span>
      </div>
      {!showInactive && inactiveCount > 0 && (
        <button
          onClick={onShowInactive}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <Eye className="w-4 h-4" />
          Inaktive anzeigen
        </button>
      )}
    </div>
  );
};
