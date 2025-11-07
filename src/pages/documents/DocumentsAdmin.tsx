import React, { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AlertMessage } from '@/components/ui/alert-message';
import { DocumentWizard } from './DocumentWizard';
import { CATEGORIES } from './utils.tsx';
import { DocumentsHeader } from './components/DocumentsHeader';
import { DocumentCounter } from './components/DocumentCounter';
import { DocumentCard } from './components/DocumentCard';
import { DeleteDialog } from './components/DeleteDialog';
import { EmptyState, ErrorState, LoadingState } from './components/DocumentStates';
import { useDocumentOperations } from './hooks/useDocumentOperations';
import { useDocumentDelete } from './hooks/useDocumentDelete';
import type { DocumentItem } from './types';


const API = 'https://sc-laufenburg.de/api/documents.php';

const fetchDocuments = async (category?: string, search?: string): Promise<DocumentItem[]> => {
  let url = API;
  const params = new URLSearchParams();
  
  if (category && category !== 'all') {
    params.append('category', category);
  }
  if (search) {
    params.append('search', search);
  }
  
  if (params.toString()) {
    url += '?' + params.toString();
  }
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
};

const DocumentsAdmin: React.FC = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    item: DocumentItem | null;
  }>({
    open: false,
    item: null
  });

  const handleSaveSuccess = () => {
    setOpen(false);
    setEditing(null);
  };

  const {
    form,
    setForm,
    uploading,
    uploadedFiles,
    scanning,
    scannedFiles,
    scanPath,
    setScanPath,
    save,
    handleFileUpload,
    handleImportFile,
    handleScanDirectory,
    resetForm,
    setUploadedFiles,
    setScannedFiles,
  } = useDocumentOperations(handleSaveSuccess);

  const { alertDialog, setAlertDialog, performDelete } = useDocumentDelete();

  const filterOptions = [
    { value: 'all', label: 'Alle Dokumente' },
    ...CATEGORIES
  ];

  const { data, isLoading, error } = useQuery<DocumentItem[], Error>({ 
    queryKey: ['documents', currentFilter, searchQuery], 
    queryFn: () => fetchDocuments(currentFilter, searchQuery)
  });

  const handleFilterChange = (filter: string) => {
    setCurrentFilter(filter);
    setFilterOpen(false);
  };

  const fetchDocumentById = async (id: number): Promise<DocumentItem> => {
    const res = await fetch(`${API}?id=${id}`);
    if (!res.ok) throw new Error('Failed to fetch document');
    return res.json();
  };

  const startCreate = () => {
    setEditing(null);
    const maxId = (data || []).reduce((m, it) => Math.max(m, it.id || 0), 0);
    const newId = maxId + 1 || 1;
    setForm({ id: newId, is_active: true });
    setOpen(true);
  };

  const startEdit = async (item: DocumentItem) => {
    try {
      const full = await fetchDocumentById(item.id);
      setEditing(full);
      setForm({ ...full });
      setOpen(true);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Konnte Dokument nicht laden' });
    }
  };

  const handleDelete = (item: DocumentItem) => {
    setDeleteDialog({
      open: true,
      item: item
    });
  };

  const handleDeleteAction = async (item: DocumentItem, type: 'deactivate' | 'hard') => {
    await performDelete(item, type);
    setDeleteDialog({ open: false, item: null });
  };

  const handleCloseWizard = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditing(null);
      resetForm();
    }
  };

  const handleCancelWizard = () => {
    setOpen(false);
    setEditing(null);
    resetForm();
  };

  const documents = data || [];
  const filteredDocuments = documents
    .filter(item => showInactive ? true : item.is_active)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const activeCount = documents.filter(item => item.is_active).length;
  const inactiveCount = documents.filter(item => !item.is_active).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <DocumentsHeader
            showInactive={showInactive}
            onShowInactiveChange={setShowInactive}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            currentFilter={currentFilter}
            filterOptions={filterOptions}
            filterOpen={filterOpen}
            onFilterOpenChange={setFilterOpen}
            onFilterChange={handleFilterChange}
            onCreateNew={startCreate}
          />

          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState />
          ) : documents.length === 0 ? (
            <EmptyState hasFilters={searchQuery !== '' || currentFilter !== 'all'} />
          ) : (
            <div className="space-y-4">
              <DocumentCounter
                totalCount={documents.length}
                activeCount={activeCount}
                inactiveCount={inactiveCount}
                showInactive={showInactive}
                onShowInactive={() => setShowInactive(true)}
              />

              <div className="grid gap-4">
                {filteredDocuments.map((item) => (
                  <DocumentCard
                    key={item.id}
                    item={item}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          <DocumentWizard
            open={open}
            onOpenChange={handleCloseWizard}
            editing={editing}
            form={form}
            onFormChange={(updates) => setForm({ ...form, ...updates })}
            uploading={uploading}
            uploadedFiles={uploadedFiles}
            scanning={scanning}
            scannedFiles={scannedFiles}
            scanPath={scanPath}
            onFileUpload={handleFileUpload}
            onImportFile={handleImportFile}
            onClearUploads={() => setUploadedFiles([])}
            onScanPathChange={setScanPath}
            onScanDirectory={handleScanDirectory}
            onClearScanned={() => setScannedFiles([])}
            onSubmit={save}
            onCancel={handleCancelWizard}
          />
        </div>
      </div>
      
      <AlertMessage
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
        title={alertDialog.title}
        description={alertDialog.description}
        variant={alertDialog.variant}
      />

      <DeleteDialog
        open={deleteDialog.open}
        item={deleteDialog.item}
        onClose={() => setDeleteDialog({ open: false, item: null })}
        onDeactivate={(item) => handleDeleteAction(item, 'deactivate')}
        onHardDelete={(item) => handleDeleteAction(item, 'hard')}
      />
    </div>
  );
};

export default DocumentsAdmin;
