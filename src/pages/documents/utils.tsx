import { FileText, Sheet, Presentation, Archive, Image, File } from 'lucide-react';

export const CATEGORIES = [
  { value: 'statuten', label: 'Statuten' },
  { value: 'protokolle', label: 'Protokolle' },
  { value: 'formulare', label: 'Formulare' },
  { value: 'berichte', label: 'Berichte' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

export const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return 'Unbekannt';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

export const getCategoryLabel = (category: string | null): string => {
  if (!category) return 'Keine Kategorie';
  return CATEGORIES.find(c => c.value === category)?.label || category;
};

export const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <FileText className="w-8 h-8 text-red-600" />;
    case 'doc':
    case 'docx':
      return <FileText className="w-8 h-8 text-blue-600" />;
    case 'xls':
    case 'xlsx':
      return <Sheet className="w-8 h-8 text-green-600" />;
    case 'ppt':
    case 'pptx':
      return <Presentation className="w-8 h-8 text-orange-600" />;
    case 'zip':
    case 'rar':
    case '7z':
      return <Archive className="w-8 h-8 text-purple-600" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <Image className="w-8 h-8 text-pink-600" />;
    default:
      return <File className="w-8 h-8 text-gray-600" />;
  }
};
