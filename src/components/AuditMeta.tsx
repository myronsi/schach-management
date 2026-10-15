import React from 'react';
import { History } from 'lucide-react';

interface AuditMetaProps {
  updatedAt?: string | null;
  updatedBy?: string | null;
  className?: string;
}

const formatUpdatedAt = (value: string): string => {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const AuditMeta: React.FC<AuditMetaProps> = ({ updatedAt, updatedBy, className = '' }) => {
  if (!updatedAt && !updatedBy) return null;

  return (
    <div className={`mt-3 flex items-center gap-1.5 text-xs text-gray-500 ${className}`}>
      <History className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        Zuletzt bearbeitet
        {updatedBy ? ` von ${updatedBy}` : ''}
        {updatedAt ? ` am ${formatUpdatedAt(updatedAt)}` : ''}
      </span>
    </div>
  );
};

export default AuditMeta;
