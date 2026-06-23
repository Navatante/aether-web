"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { format, isValid, parse } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerProps {
    value?: string // "YYYY-MM-DD"
    onChange?: (value: string) => void
    className?: string
    error?: boolean
    disabled?: boolean
    placeholder?: string
}

export function DatePicker({
                               value,
                               onChange,
                               className,
                               error = false,
                               disabled = false,
                               placeholder = "Seleccionar fecha"
                           }: DatePickerProps) {
    const [open, setOpen] = React.useState(false)

    const selectedDate = (() => {
        if (!value) return undefined
        const date = parse(value, "yyyy-MM-dd", new Date())
        return isValid(date) ? date : undefined
    })()

    const handleDateSelect = (newDate: Date | undefined) => {
        if (!newDate) {
            onChange?.("")
        } else {
            onChange?.(format(newDate, "yyyy-MM-dd"))
        }
        setOpen(false)
    }

    const hasValue = !!selectedDate

    const errorStyles = error
        ? "border-destructive focus:border-destructive focus:ring-destructive"
        : ""

    const filledStyles = hasValue && !error
        ? "input-filled"
        : ""

    return (
        <div className={cn("flex", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger render={
                    <Button
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            "w-full justify-between font-normal transition-colors duration-200",
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
                        defaultMonth={selectedDate ?? new Date()}
                        captionLayout="dropdown"
                        startMonth={new Date(new Date().getFullYear() - 10, 0)}
                        endMonth={new Date(new Date().getFullYear() + 10, 11)}
                        locale={es}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
