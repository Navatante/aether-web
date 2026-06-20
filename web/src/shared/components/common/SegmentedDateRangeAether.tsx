// src/shared/components/common/SegmentedDateRangeAether.tsx
import { useState, useEffect, useRef } from 'react';
import { CalendarIcon, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cva } from 'class-variance-authority';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select.tsx';
import { Calendar } from '@/components/ui/calendar.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils.ts';

// ============================================================================
// Types
// ============================================================================

export type PredefinedRange =
    | 'ultimos-7-dias'
    | 'ultimos-30-dias'
    | 'ultimos-90-dias'
    | 'ultimos-182-dias'
    | 'ultimos-365-dias'
    | 'semana-actual'
    | 'ultima-semana'
    | 'mes-actual'
    | 'ultimo-mes'
    | 'ultimos-3-meses'
    | 'anio-actual'
    | 'ultimo-anio'
    | 'ultimos-2-anios'
    | 'historico';

export interface StatsParams {
    range_type: 'predefined' | 'custom';
    predefined_range?: PredefinedRange;
    date_from?: string;
    date_to?: string;
}

interface SegmentedDateRangeProps {
    onDataReceived: (params: StatsParams) => void;
    debounceMs?: number;
    currentDateFrom?: string;
    currentDateTo?: string;
    /** Año mínimo para el calendario (default: 2020) */
    minYear?: number;
}

interface PredefinedRangeOption {
    value: PredefinedRange;
    label: string;
}

// ============================================================================
// Constants
// ============================================================================

const PREDEFINED_RANGES: PredefinedRangeOption[] = [
    { value: 'ultimos-7-dias', label: 'Últimos 7 días' },
    { value: 'ultimos-30-dias', label: 'Últimos 30 días' },
    { value: 'ultimos-90-dias', label: 'Últimos 90 días' },
    { value: 'ultimos-182-dias', label: 'Últimos 182 días' },
    { value: 'ultimos-365-dias', label: 'Últimos 365 días' },
    { value: 'semana-actual', label: 'Semana actual' },
    { value: 'ultima-semana', label: 'Última semana' },
    { value: 'mes-actual', label: 'Mes actual' },
    { value: 'ultimo-mes', label: 'Último mes' },
    { value: 'ultimos-3-meses', label: 'Últimos 3 meses' },
    { value: 'anio-actual', label: 'Año actual' },
    { value: 'ultimo-anio', label: 'Último año' },
    { value: 'ultimos-2-anios', label: 'Últimos 2 años' },
    { value: 'historico', label: 'Histórico' }
];

const DEFAULT_MIN_YEAR = 2020;

// ============================================================================
// Styles (CVA)
// ============================================================================

const segmentButtonVariants = cva(
    [
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5",
        "text-sm font-medium ring-offset-background transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50"
    ],
    {
        variants: {
            active: {
                true: "bg-background text-foreground shadow-sm",
                false: "hover:bg-background/50 hover:text-foreground/80"
            }
        },
        defaultVariants: {
            active: false
        }
    }
);

// ============================================================================
// Utility Functions (pure, outside component)
// ============================================================================

export const formatDateDisplay = (dateString: string, includeYear: boolean = true): string => {
    const date = new Date(dateString + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        ...(includeYear && { year: 'numeric' })
    };
    return date.toLocaleDateString('es-ES', options);
};

const calculateDaysInRange = (fromStr: string, toStr: string): number => {
    const from = new Date(fromStr + 'T00:00:00');
    const to = new Date(toStr + 'T00:00:00');
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const isSameYear = (fromStr: string, toStr: string): boolean => {
    const fromYear = new Date(fromStr + 'T00:00:00').getFullYear();
    const toYear = new Date(toStr + 'T00:00:00').getFullYear();
    return fromYear === toYear;
};

const dateToString = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
};

// ============================================================================
// Component
// ============================================================================

export default function SegmentedDateRangeAether({
    onDataReceived,
    debounceMs = 1000,
    currentDateFrom,
    currentDateTo,
    minYear = DEFAULT_MIN_YEAR
}: SegmentedDateRangeProps) {
    const [activeSegment, setActiveSegment] = useState<'predefined' | 'custom'>('predefined');
    const [selectedRange, setSelectedRange] = useState<PredefinedRange>('ultimos-30-dias');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [validationError, setValidationError] = useState<string | null>(null);

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Ref to hold the latest callback without causing re-renders
    const onDataReceivedRef = useRef(onDataReceived);
    onDataReceivedRef.current = onDataReceived;

    // Track previous values to detect actual changes
    const prevSelectedRangeRef = useRef<PredefinedRange | null>(null);
    const prevActiveSegmentRef = useRef<'predefined' | 'custom' | null>(null);
    const prevDatesRef = useRef<{ start?: Date; end?: Date }>({});

    const emitParams = (params: StatsParams) => {
        onDataReceivedRef.current(params);
    };

    // Single effect that handles all cases
    useEffect(() => {
        const isFirstRender = prevActiveSegmentRef.current === null;
        const segmentChanged = prevActiveSegmentRef.current !== activeSegment;
        const rangeChanged = prevSelectedRangeRef.current !== selectedRange;
        const datesChanged = prevDatesRef.current.start !== startDate || prevDatesRef.current.end !== endDate;

        // Update refs
        prevActiveSegmentRef.current = activeSegment;
        prevSelectedRangeRef.current = selectedRange;
        prevDatesRef.current = { start: startDate, end: endDate };

        // Clear any pending debounce
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = undefined;
        }

        if (activeSegment === 'predefined') {
            // For predefined: emit on first render, segment change, or range change
            if (isFirstRender || segmentChanged || rangeChanged) {
                setValidationError(null);
                emitParams({
                    range_type: 'predefined',
                    predefined_range: selectedRange
                });
            }
        } else {
            // For custom: emit with debounce when dates are valid
            if (!startDate || !endDate) {
                if (datesChanged && (startDate || endDate)) {
                    setValidationError('Seleccione ambas fechas para ver los datos');
                }
                return;
            }

            if (startDate > endDate) {
                setValidationError('La fecha de inicio no puede ser posterior a la fecha de fin');
                return;
            }

            // Only emit on actual changes (not first render with undefined dates)
            if (segmentChanged || datesChanged) {
                setValidationError(null);
                debounceTimer.current = setTimeout(() => {
                    emitParams({
                        range_type: 'custom',
                        date_from: dateToString(startDate),
                        date_to: dateToString(endDate)
                    });
                }, debounceMs);
            }
        }

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [activeSegment, selectedRange, startDate, endDate, debounceMs, emitParams]);

    const handleSegmentChange = (segment: 'predefined' | 'custom') => {
        setActiveSegment(segment);
        setValidationError(null);

        if (segment === 'custom') {
            const today = new Date();
            const lastMonth = new Date(today);
            lastMonth.setMonth(today.getMonth() - 1);
            setStartDate(lastMonth);
            setEndDate(today);
        } else {
            setStartDate(undefined);
            setEndDate(undefined);
        }
    };

    const today = new Date();
    const calendarStartMonth = new Date(minYear, 0);

    return (
        <div className="w-full p-6 bg-card">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">
                        Período de análisis
                    </h3>
                </div>

                {/* Controles */}
                <div className="flex justify-start gap-4 flex-wrap items-center">
                    {/* Segmented Control */}
                    <div
                        role="tablist"
                        aria-label="Tipo de período"
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"
                    >
                        <button
                            role="tab"
                            aria-selected={activeSegment === 'predefined'}
                            aria-controls="panel-predefined"
                            onClick={() => handleSegmentChange('predefined')}
                            className={segmentButtonVariants({ active: activeSegment === 'predefined' })}
                        >
                            Predefinido
                        </button>
                        <button
                            role="tab"
                            aria-selected={activeSegment === 'custom'}
                            aria-controls="panel-custom"
                            onClick={() => handleSegmentChange('custom')}
                            className={segmentButtonVariants({ active: activeSegment === 'custom' })}
                        >
                            Personalizado
                        </button>
                    </div>

                    {activeSegment === 'predefined' ? (
                        <div id="panel-predefined" role="tabpanel" className="contents">
                            <Select
                                value={selectedRange}
                                onValueChange={(value) => setSelectedRange(value as PredefinedRange)}
                            >
                                <SelectTrigger className="flex-1 w-[200px] bg-background border-input">
                                    {PREDEFINED_RANGES.find(r => r.value === selectedRange)?.label || "Selecciona un rango"}
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground">
                                    {PREDEFINED_RANGES.map((range) => (
                                        <SelectItem key={range.value} value={range.value}>
                                            {range.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Indicador de fechas del rango (desde el SP) */}
                            {currentDateFrom && currentDateTo && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border/50">
                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        {formatDateDisplay(currentDateFrom, !isSameYear(currentDateFrom, currentDateTo))}
                                    </span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="text-sm text-muted-foreground">
                                        {formatDateDisplay(currentDateTo, true)}
                                    </span>
                                    <span className="text-xs text-muted-foreground/70 ml-1">
                                        ({calculateDaysInRange(currentDateFrom, currentDateTo)} días)
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div id="panel-custom" role="tabpanel" className="flex items-center gap-2 flex-1">
                            {/* Fecha Inicio */}
                            <div className="flex-1">
                                <Popover>
                                    <PopoverTrigger render={
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full h-9 justify-start text-left font-normal",
                                                !startDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "dd/MM/yyyy", { locale: es }) : <span>Fecha inicio</span>}
                                        </Button>
                                    } />
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={setStartDate}
                                            disabled={(date) => date > today || date < calendarStartMonth}
                                            captionLayout="dropdown"
                                            startMonth={calendarStartMonth}
                                            endMonth={today}
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <span className="text-muted-foreground">→</span>

                            {/* Fecha Fin */}
                            <div className="flex-1">
                                <Popover>
                                    <PopoverTrigger render={
                                        <Button
                                            variant="outline"
                                            disabled={!startDate}
                                            className={cn(
                                                "w-full h-9 justify-start text-left font-normal",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "dd/MM/yyyy", { locale: es }) : <span>Fecha fin</span>}
                                        </Button>
                                    } />
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            disabled={(date) =>
                                                date > today ||
                                                date < calendarStartMonth ||
                                                (startDate ? date < startDate : false)
                                            }
                                            captionLayout="dropdown"
                                            startMonth={calendarStartMonth}
                                            endMonth={today}
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mostrar error si existe */}
                {validationError && (
                    <div role="alert" className="p-3 bg-destructive/10 border border-destructive rounded-md">
                        <p className="text-sm text-destructive">{validationError}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
