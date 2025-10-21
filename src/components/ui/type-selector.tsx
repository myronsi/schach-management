import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const eventTypes = [
  { value: "training", label: "Training" },
  { value: "tournament", label: "Turnier" },
  { value: "meeting", label: "Versammlung" },
  { value: "holiday", label: "Ferien" },
  { value: "special", label: "Besondere" }
]

interface TypeSelectorProps {
  id?: string
  label?: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
}

export function TypeSelector({ 
  id, 
  label = "Typ", 
  value, 
  onChange, 
  placeholder = "Typ auswählen...",
  className = "",
  required = false
}: TypeSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedValue, setSelectedValue] = React.useState(value || "")

  React.useEffect(() => {
    setSelectedValue(value || "")
  }, [value])

  const handleSelect = (typeValue: string) => {
    setSelectedValue(typeValue)
    setOpen(false)
    if (onChange) {
      onChange(typeValue)
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <Label htmlFor={id} className="px-1">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            role="combobox"
            aria-expanded={open}
            className={`w-full justify-between font-normal ${!selectedValue ? 'text-gray-400' : ''}`}
          >
            {selectedValue
              ? eventTypes.find((type) => type.value === selectedValue)?.label
              : placeholder}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>Keine Typen gefunden.</CommandEmpty>
              <CommandGroup>
                {eventTypes.map((type) => (
                  <CommandItem
                    key={type.value}
                    value={type.value}
                    onSelect={() => handleSelect(type.value)}
                  >
                    {type.label}
                    <Check 
                      className={cn(
                        "ml-auto h-4 w-4", 
                        selectedValue === type.value ? "opacity-100" : "opacity-0"
                      )} 
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}