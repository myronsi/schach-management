import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { AlertMessage } from '@/components/ui/alert-message';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type FormData = {
  title?: string;
  date?: string;
  deleteMode: string;
};

interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  type?: string;
  is_recurring?: number;
}

const API = 'https://sc-laufenburg.de/api/events.php';

const deleteModeOptions = [
  { value: "upcomingTitle", label: "Alle zukünftigen Ereignisse mit Titel" },
  { value: "allOnDay", label: "Alle Ereignisse an einem Tag" }
];

interface DeleteEventDialogProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

const DeleteEventDialog: React.FC<DeleteEventDialogProps> = ({ onSuccess, onClose }) => {
  const { register, handleSubmit, setValue, watch } = useForm<FormData>({
    defaultValues: {
      deleteMode: "upcomingTitle"
    }
  });
  const [response, setResponse] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [titleOpen, setTitleOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [modeOpen, setModeOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>("upcomingTitle");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'success' | 'error' | 'info';
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'info'
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });
  
  const watchDeleteMode = watch("deleteMode");
  const needsTitle = watchDeleteMode === "upcomingTitle";
  const needsDate = watchDeleteMode === "allOnDay";

  const showAlert = (title: string, description: string, variant: 'success' | 'error' | 'info' = 'info') => {
    setAlertDialog({
      open: true,
      title,
      description,
      variant
    });
  };

  const showConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      onConfirm
    });
  };

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch(`${API}?action=list`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Ereignisse:', err);
      }
    };
    loadEvents();
  }, []);

  const handleTitleSelect = (title: string) => {
    setValue('title', title);
    setSelectedTitle(title);
    setTitleOpen(false);
  };

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setValue('date', formatDateForAPI(date));
    }
  };

  const handleModeSelect = (mode: string) => {
    setValue('deleteMode', mode);
    setSelectedMode(mode);
    setModeOpen(false);
    setSelectedTitle("");
    setSelectedDate(undefined);
    setValue('title', "");
    setValue('date', "");
  };

  const onSubmit = async (data: FormData) => {
    const dateValue = selectedDate ? formatDateForAPI(selectedDate) : data.date;
    const formData = {
      ...data,
      date: dateValue
    };
    
    let confirmMessage = "";
    
    switch (formData.deleteMode) {
      case "upcomingTitle":
        confirmMessage = `Möchten Sie wirklich alle zukünftigen Ereignisse mit dem Titel "${formData.title}" löschen?`;
        break;
      case "allOnDay":
        confirmMessage = `Möchten Sie alle Ereignisse am ${formData.date} löschen?`;
        break;
    }
    
    showConfirm(
      'Ereignisse löschen',
      confirmMessage,
      async () => {
        setIsSubmitting(true);
        
        try {
          const requestBody: any = {
            mode: formData.deleteMode
          };
          
          if (formData.title) requestBody.title = formData.title;
          if (formData.date) requestBody.date = formData.date;
          
          const res = await fetch(`${API}?action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          const result = await res.json();
          if (res.ok) {
            setResponse(result);
            setStatus('success');
            showAlert('Erfolg', `${result.deleted} Ereignis(se) erfolgreich gelöscht`, 'success');
            
            if (onSuccess) onSuccess();
            
            setTimeout(() => {
              if (onClose) onClose();
            }, 1500);
            
          } else {
            setStatus('error');
            setResponse(result);
            showAlert('Fehler', result.error || 'Fehler beim Löschen', 'error');
          }
        } catch (err) {
          setStatus('error');
          setResponse({ error: 'Netzwerkfehler' });
          showAlert('Fehler', 'Netzwerkfehler', 'error');
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  const uniqueTitles = [...new Set(events.map(event => event.title))];

  return (
    <div className="space-y-4">
      <div>
        <Label>Lösch-Modus auswählen <span className="text-red-500">*</span></Label>
        <Popover open={modeOpen} onOpenChange={setModeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={modeOpen}
              aria-required={true}
              className="w-full flex items-center justify-between px-3 py-2 border rounded bg-white text-left"
            >
              {deleteModeOptions.find(m => m.value === selectedMode)?.label || <span className="text-gray-400">Modus auswählen...</span>}
              <ChevronsUpDown className="opacity-50 ml-2 h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandList>
                <CommandEmpty>Keine Modi gefunden.</CommandEmpty>
                <CommandGroup>
                  {deleteModeOptions.map((mode) => (
                    <CommandItem
                      key={mode.value}
                      value={mode.value}
                      onSelect={() => handleModeSelect(mode.value)}
                    >
                      {mode.label}
                      <Check className={cn('ml-auto h-4 w-4', selectedMode === mode.value ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {needsTitle && (
        <div>
          <Label>Ereignis Titel auswählen <span className="text-red-500">*</span></Label>
          <Popover open={titleOpen} onOpenChange={setTitleOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={titleOpen}
                aria-required={true}
                className="w-full flex items-center justify-between px-3 py-2 border rounded bg-white text-left"
              >
                {selectedTitle || <span className="text-gray-400">Klicken Sie um Titel auszuwählen...</span>}
                <ChevronsUpDown className="opacity-50 ml-2 h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandList>
                  <CommandEmpty>Keine Ereignisse gefunden.</CommandEmpty>
                  <CommandGroup>
                    {uniqueTitles.map((title) => (
                      <CommandItem
                        key={title}
                        value={title}
                        onSelect={() => handleTitleSelect(title)}
                      >
                        {title}
                        <Check className={cn('ml-auto h-4 w-4', selectedTitle === title ? 'opacity-100' : 'opacity-0')} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {needsDate && (
        <DatePicker
          id="date"
          label="Datum"
          value={selectedDate}
          onChange={handleDateChange}
          required
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input type="hidden" {...register('deleteMode')} />
        {needsTitle && <Input type="hidden" {...register('title')} />}
        {needsDate && <Input type="hidden" value={selectedDate ? formatDateForAPI(selectedDate) : ''} name="date" />}
        
        <Button 
          type="submit" 
          variant="destructive" 
          className="w-full" 
          disabled={
            (needsTitle && !selectedTitle) ||
            (needsDate && !selectedDate) ||
            isSubmitting
          }
        >
          {isSubmitting ? 'Wird gelöscht...' : 'Ereignisse löschen'}
        </Button>
      </form>

      {status === 'success' && response && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800 font-semibold">Ereignisse gelöscht:</p>
          <p className="mt-2 text-sm text-green-700">
            {response.deleted} Ereignis(se) wurden gelöscht
          </p>
          <p className="text-sm text-green-700">
            {response.message}
          </p>
        </div>
      )}

      {status === 'error' && response && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-semibold">Fehler:</p>
          <p className="text-sm text-red-700">{response.error}</p>
        </div>
      )}
      
      <AlertMessage
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
        title={alertDialog.title}
        description={alertDialog.description}
        variant={alertDialog.variant}
      />
      
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Löschen"
        variant="destructive"
      />
    </div>
  );
};

export default DeleteEventDialog;