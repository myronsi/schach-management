import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { parseDateString } from "@/lib/date"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  id?: string
  label?: string
  value?: Date | string
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  required?: boolean
}

export function DatePicker({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder = "Datum auswählen",
  className = "",
  required = false
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  
  const [date, setDate] = React.useState<Date | undefined>(
    value ? (typeof value === 'string' ? parseDateString(value) : value) : undefined
  )

  React.useEffect(() => {
    if (value) {
      const newDate = typeof value === 'string' ? parseDateString(value) : value
      setDate(newDate)
    } else {
      setDate(undefined)
    }
  }, [value])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    setOpen(false)
    if (onChange) {
      onChange(selectedDate)
    }
  }

  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return placeholder
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
            className={`w-full justify-between font-normal ${!date ? 'text-gray-400' : ''}`}
          >
            {formatDisplayDate(date)}
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            onSelect={handleDateSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}