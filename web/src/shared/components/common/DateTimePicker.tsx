"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { format, isValid, set } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
    value?: string // ISO string format: "2024-01-15T10:30"
    onChange?: (value: string) => void
    className?: string
    error?: boolean
    disabled?: boolean
    placeholder?: string
}

export function DateTimePicker({
                                   value,
                                   onChange,
                                   className,
                                   error = false,
                                   disabled = false,
                                   placeholder = "Seleccionar fecha"
                               }: DateTimePickerProps) {
    const [open, setOpen] = React.useState(false)
    const [timeInputValue, setTimeInputValue] = React.useState("")

    // Parsear el valor ISO string a Date
    const parseDateTime = (isoString: string | undefined): Date | undefined => {
        if (!isoString) return undefined
        const date = new Date(isoString)
        return isValid(date) ? date : undefined
    }

    const selectedDate = parseDateTime(value)

    // Sincronizar el input de tiempo con el valor
    React.useEffect(() => {
        if (selectedDate) {
            const hours = selectedDate.getHours().toString().padStart(2, "0")
            const minutes = selectedDate.getMinutes().toString().padStart(2, "0")
            setTimeInputValue(`${hours}:${minutes}`)
        } else {
            setTimeInputValue("")
        }
    }, [selectedDate])

    // Manejar cambio de fecha
    const handleDateSelect = (newDate: Date | undefined) => {
        if (!newDate) {
            onChange?.("")
            setOpen(false)
            return
        }

        // Mantener la hora existente o usar 00:00
        const currentHours = selectedDate?.getHours() ?? 0
        const currentMinutes = selectedDate?.getMinutes() ?? 0

        const combinedDate = set(newDate, { hours: currentHours, minutes: currentMinutes, seconds: 0 })
        const isoString = format(combinedDate, "yyyy-MM-dd'T'HH:mm")
        onChange?.(isoString)
        setOpen(false)
    }

    // Manejar cambio de hora con input controlado
    const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value
        setTimeInputValue(inputValue)

        // Validar formato HH:MM
        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/
        if (timeRegex.test(inputValue)) {
            const [hoursStr, minutesStr] = inputValue.split(":")
            const hours = parseInt(hoursStr, 10)
            const minutes = parseInt(minutesStr, 10)

            const baseDate = selectedDate ?? new Date()
            const combinedDate = set(baseDate, { hours, minutes, seconds: 0 })
            const isoString = format(combinedDate, "yyyy-MM-dd'T'HH:mm")
            onChange?.(isoString)
        }
    }

    // Manejar blur para formatear correctamente
    const handleTimeBlur = () => {
        if (selectedDate) {
            const hours = selectedDate.getHours().toString().padStart(2, "0")
            const minutes = selectedDate.getMinutes().toString().padStart(2, "0")
            setTimeInputValue(`${hours}:${minutes}`)
        }
    }

    // Determinar si tiene valor
    const hasValue = !!selectedDate

    // Estilos de error
    const errorStyles = error
        ? "border-destructive focus:border-destructive focus:ring-destructive"
        : ""

    // Estilos de filled (cuando tiene valor y no hay error)
    const filledStyles = hasValue && !error
        ? "input-filled"
        : ""

    return (
        <div className={cn("flex gap-2", className)}>
            {/* Date Picker */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger render={
                    <Button
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            "flex-1 justify-between font-normal transition-colors duration-200",
                            !selectedDate && "text-muted-foreground",
                            filledStyles,
                            errorStyles
                        )}
                    >
                        {selectedDate
                            ? format(selectedDate, "dd/MM/yyyy", { locale: es })
                            : placeholder
                        }
                        <ChevronDownIcon className="h-4 w-4 opacity-50" />
                    </Button>
                } />
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        captionLayout="dropdown"
                        locale={es}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>

            {/* Time Input - Formato 24h */}
            <Input
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                value={timeInputValue}
                onChange={handleTimeInputChange}
                onBlur={handleTimeBlur}
                disabled={disabled}
                maxLength={5}
                className={cn(
                    "w-20 text-center transition-colors duration-200",
                    filledStyles,
                    errorStyles
                )}
            />
        </div>
    )
}