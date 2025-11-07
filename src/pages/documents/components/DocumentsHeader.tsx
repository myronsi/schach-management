import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, X, ChevronsUpDown, Check, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface DocumentsHeaderProps {
  showInactive: boolean;
  onShowInactiveChange: (show: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  currentFilter: string;
  filterOptions: FilterOption[];
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  onFilterChange: (filter: string) => void;
  onCreateNew: () => void;
}

export const DocumentsHeader: React.FC<DocumentsHeaderProps> = ({
  showInactive,
  onShowInactiveChange,
  searchQuery,
  onSearchQueryChange,
  currentFilter,
  filterOptions,
  filterOpen,
  onFilterOpenChange,
  onFilterChange,
  onCreateNew,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dokumente</h1>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {/* Show Inactive Toggle */}
        <Button
          variant={showInactive ? "default" : "outline"}
          onClick={() => onShowInactiveChange(!showInactive)}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          {showInactive ? (
            <>
              <Eye className="w-4 h-4" />
              <span className="sm:inline">Alle anzeigen</span>
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" />
              <span className="sm:inline">Nur Aktive</span>
            </>
          )}
        </Button>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Input
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdown */}
        <Popover open={filterOpen} onOpenChange={onFilterOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={filterOpen}
              className="w-full sm:w-[200px] justify-between"
            >
              {filterOptions.find(option => option.value === currentFilter)?.label}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandList>
                <CommandEmpty>Keine Filter gefunden.</CommandEmpty>
                <CommandGroup>
                  {filterOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => onFilterChange(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentFilter === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        <Button onClick={onCreateNew} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span className="sm:inline">Neues Dokument</span>
        </Button>
      </div>
    </div>
  );
};
