import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, RefreshCw, CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import ViewModeToggleComisionLists, { ViewMode } from "../components/ViewModeToggleComisionLists"
import { useApiPaginatedQuery } from "@/lib/apiQuery"
import { queryKeys } from "@/lib/queryKeys"
import { useEscuadrilla } from "@/providers"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    StickyTableHeader,
    TableRow,
    ToggleButtonGroup,
} from "@/shared/components/common"

// Tipos para los datos del stored procedure
interface PersonaDiasComision {
    person_rank: string
    full_name: string
    person_rol: string
    escala: 'Oficiales' | 'Suboficiales' | 'Tropa y marinería'
    b1: boolean
    b2: boolean
    lv: boolean
    dias_base_corta_duracion: number
    dias_despliegues: number
    dias_voluntarias: number
    dias_OMP: number
    dias_UNADEST: number
    dias_UNAEMB: number
    dias_rancheria: number
}

// Mapeo de ViewMode a campo de días
const viewModeToDiasField: Record<ViewMode, keyof PersonaDiasComision> = {
    'Base o de Corta duración ordenadas por COMFLOAN': 'dias_base_corta_duracion',
    'Despliegues ordenados por COMFLOAN': 'dias_despliegues',
    'Ofertadas por otros mandos y de carácter voluntario': 'dias_voluntarias',
    'OMP como UNAEMB o UNADEST': 'dias_OMP',
    'Ranchería': 'dias_rancheria',
    'UNADEST nacionales o extranjero': 'dias_UNADEST',
    'UNAEMB nacionales o extranjero': 'dias_UNAEMB',
}

// Función para obtener clases de badge en la tabla (siempre activo)
const getTableBadgeClass = (type: 'rol' | 'b1' | 'b2' | 'lv', value?: string): string => {
    const tableBase = "rounded-lg px-2 py-1 text-xs font-medium shadow-sm"
    switch (type) {
        case 'rol':
            switch (value) {
                case 'Piloto':
                    return `${tableBase} bg-role-pilot text-role-pilot-foreground`
                case 'Dotación/Nadador':
                    return `${tableBase} bg-gradient-to-r from-role-crew to-role-swimmer text-role-crew-foreground`
                case 'Dotación':
                    return `${tableBase} bg-role-crew text-role-crew-foreground`
                case 'Nadador':
                    return `${tableBase} bg-role-swimmer text-role-swimmer-foreground`
                case 'No Tripulante':
                    return `${tableBase} bg-role-no-crew text-role-no-crew-foreground`
                default:
                    return `${tableBase} bg-role-default text-role-default-foreground`
            }
        case 'b1':
            return `${tableBase} bg-caracteristica-b1 text-caracteristica-b1-foreground`
        case 'b2':
            return `${tableBase} bg-caracteristica-b2 text-caracteristica-b2-foreground`
        case 'lv':
            return `${tableBase} bg-caracteristica-lv text-caracteristica-lv-foreground`
        default:
            return `${tableBase} bg-role-default text-role-default-foreground`
    }
}


export default function DiasDeComision() {
    const [fechaFin, setFechaFin] = useState<Date>(new Date())
    const [viewMode, setViewMode] = useState<ViewMode>('Base o de Corta duración ordenadas por COMFLOAN')
    const [calendarOpen, setCalendarOpen] = useState(false)

    // Filtros
    const [escalaFilter, setEscalaFilter] = useState<Set<string>>(new Set())
    const [rolFilter, setRolFilter] = useState<Set<string>>(new Set())
    const [caracteristicaFilter, setCaracteristicaFilter] = useState<Set<string>>(new Set())

    // Hook para datos
    const [queryParams, setQueryParams] = useState({ fechaFin: format(new Date(), 'yyyy-MM-dd') });
    const { id: escId } = useEscuadrilla();

    const {
        data,
        isLoading,
        isFetching,
        error,
        refetch,
    } = useApiPaginatedQuery<PersonaDiasComision>({
        path: '/comisiones/dias',
        query: queryParams,
        queryKey: queryKeys.comisiones.dias.list(escId ?? 0, queryParams),
    });

    // Para cambiar la fecha
    const handleFechaChange = (date: Date | undefined) => {
        if (date) {
            setFechaFin(date);
            setQueryParams({ fechaFin: format(date, 'yyyy-MM-dd') });
            setCalendarOpen(false);
        }
    };

    // Roles disponibles para filtrar (orden específico, sin Dotación/Nadador)
    const filterRoles = ['Piloto', 'Dotación', 'Nadador', 'No Tripulante']

    // Obtener roles únicos de los datos para mostrar solo los que existen
    const availableFilterRoles = (() => {
        const rolesInData = new Set(data.map(p => p.person_rol))
        // Incluir un rol en el filtro si existe directamente o si existe Dotación/Nadador
        return filterRoles.filter(rol => {
            if (rol === 'Dotación' || rol === 'Nadador') {
                return rolesInData.has(rol) || rolesInData.has('Dotación/Nadador')
            }
            return rolesInData.has(rol)
        })
    })()

    // Escalas disponibles
    const escalas = ['Oficiales', 'Suboficiales', 'Tropa y marinería']

    // Características disponibles
    const caracteristicas = ['B1', 'B2', 'LV']

    // Filtrar y ordenar datos
    const filteredAndSortedData = (() => {
        let filtered = [...data]

        // Filtrar por rango específico para Ranchería (solo MRO, SDO, CBO)
        if (viewMode === 'Ranchería') {
            const rangosRancheria = ['MRO', 'SDO', 'CBO']
            filtered = filtered.filter(p => rangosRancheria.includes(p.person_rank))
        }

        // Filtrar por escala
        if (escalaFilter.size > 0) {
            filtered = filtered.filter(p => escalaFilter.has(p.escala))
        }

        // Filtrar por rol (incluyendo Dotación/Nadador cuando se filtra por Dotación o Nadador)
        if (rolFilter.size > 0) {
            filtered = filtered.filter(p => {
                // Si el rol de la persona está directamente en el filtro
                if (rolFilter.has(p.person_rol)) return true
                // Si la persona es Dotación/Nadador y se filtra por Dotación o Nadador
                if (p.person_rol === 'Dotación/Nadador') {
                    return rolFilter.has('Dotación') || rolFilter.has('Nadador')
                }
                return false
            })
        }

        // Filtrar por características (B1, B2, LV) - OR logic
        if (caracteristicaFilter.size > 0) {
            filtered = filtered.filter(p => {
                if (caracteristicaFilter.has('B1') && p.b1) return true
                if (caracteristicaFilter.has('B2') && p.b2) return true
                if (caracteristicaFilter.has('LV') && p.lv) return true
                return false
            })
        }

        // Obtener el campo de días correspondiente al viewMode actual
        const diasField = viewModeToDiasField[viewMode]

        // Ordenar: primero por días (ascendente), luego por índice original invertido (para empates)
        const withIndex = filtered.map((item, index) => ({item, originalIndex: index}))

        withIndex.sort((a, b) => {
            const diasA = a.item[diasField] as number
            const diasB = b.item[diasField] as number

            if (diasA !== diasB) {
                return diasA - diasB // Menor a mayor
            }
            // En caso de empate, ordenar por índice original invertido
            return b.originalIndex - a.originalIndex
        })

        return withIndex.map(({item}) => item)
    })()

    // Toggle para filtros
    const toggleEscala = (escala: string) => {
        setEscalaFilter(prev => {
            const next = new Set(prev)
            if (next.has(escala)) {
                next.delete(escala)
            } else {
                next.add(escala)
            }
            return next
        })
    }

    const toggleRol = (rol: string) => {
        setRolFilter(prev => {
            const next = new Set(prev)
            if (next.has(rol)) {
                next.delete(rol)
            } else {
                next.add(rol)
            }
            return next
        })
    }

    const toggleCaracteristica = (caract: string) => {
        setCaracteristicaFilter(prev => {
            const next = new Set(prev)
            if (next.has(caract)) {
                next.delete(caract)
            } else {
                next.add(caract)
            }
            return next
        })
    }

    // Obtener días según viewMode
    const getDias = (persona: PersonaDiasComision): number => {
        const field = viewModeToDiasField[viewMode]
        return persona[field] as number
    }

    return (
        <div className="h-full flex flex-col p-3 sm:p-6 pb-8">
            {/* Header */}
            <div className="mb-6 text-center">
                <GradientTitle>Días de comisión</GradientTitle>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Contenedor principal que alinea to al mismo ancho */}
                <div className="flex flex-col items-center flex-1 overflow-hidden">
                    <div className="inline-flex flex-col w-auto max-w-full flex-1 overflow-hidden">

                        {/* Selector de vista con tooltips */}
                        <ViewModeToggleComisionLists
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            className="!mb-4"
                        />

                        {/* Filtros */}
                        <PageControls className="mt-4">
                            <div className="flex flex-wrap gap-4 items-center">
                                {/* Filtro por Escala */}
                                <ToggleButtonGroup
                                    items={escalas}
                                    selectedItems={escalaFilter}
                                    onToggle={toggleEscala}
                                />

                                {/* Filtro por Características */}
                                <ToggleButtonGroup
                                    items={caracteristicas}
                                    selectedItems={caracteristicaFilter}
                                    onToggle={toggleCaracteristica}
                                />

                                {/* Filtro por Rol */}
                                {availableFilterRoles.length > 0 && (
                                    <ToggleButtonGroup
                                        items={availableFilterRoles}
                                        selectedItems={rolFilter}
                                        onToggle={toggleRol}
                                    />
                                )}

                                <ActionButton
                                    variant="refresh"
                                    icon={RefreshCw}
                                    label="Refrescar"
                                    onClick={(e) => {
                                        refetch();
                                        const icon = e.currentTarget.querySelector("svg");
                                        if (icon) {
                                            icon.classList.remove("animate-spin-once");
                                            requestAnimationFrame(() => {
                                                icon.classList.add("animate-spin-once");
                                            });
                                        }
                                    }}
                                    disabled={isFetching}
                                    loading={isFetching}
                                />
                            </div>
                        </PageControls>

                        {/* Calendar Popover - solo para OMP, UNADEST, UNAEMB */}
                        {['OMP como UNAEMB o UNADEST', 'UNADEST nacionales o extranjero', 'UNAEMB nacionales o extranjero'].includes(viewMode) && (
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <span className="text-sm text-muted-foreground">
                                    Últimos 365 días hasta:
                                </span>
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger render={
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-[200px] justify-start text-left font-normal",
                                                !fechaFin && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {fechaFin ? (
                                                format(fechaFin, "dd/MM/yyyy", { locale: es })
                                            ) : (
                                                <span>Seleccionar fecha</span>
                                            )}
                                        </Button>
                                    } />
                                    <PopoverContent className="w-auto p-0" align="center">
                                        <Calendar
                                            mode="single"
                                            selected={fechaFin}
                                            onSelect={handleFechaChange}
                                            defaultMonth={fechaFin}
                                            captionLayout="dropdown"
                                            startMonth={new Date(new Date().getFullYear() - 10, 0)}
                                            endMonth={new Date(new Date().getFullYear() + 10, 11)}
                                            locale={es}
                                            className="rounded-md border"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Tabla */}
                        <PageTableContainer className="overflow-auto flex-1">
                            <table className="w-full" role="table">
                                <StickyTableHeader>
                                <tr>
                                    <th className="text-left p-4 font-semibold text-table-header-foreground">Personal</th>
                                    <th className="text-right p-4 font-semibold text-table-header-foreground">Días</th>
                                </tr>
                                </StickyTableHeader>
                                <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={2} className="p-8 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={2} className="p-8 text-center text-danger">
                                            {error}
                                        </td>
                                    </tr>
                                ) : filteredAndSortedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="p-8 text-center text-muted-foreground">
                                            No hay datos disponibles
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedData.map((persona, idx) => (
                                        <TableRow
                                            key={`${persona.full_name}-${idx}`}
                                            index={idx}
                                            className="cursor-default"
                                        >
                                            <td className="p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="text-sm text-foreground font-medium">
                                                        {`${persona.person_rank} ${persona.full_name}`}
                                                    </span>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className={getTableBadgeClass('rol', persona.person_rol)}>
                                                            {persona.person_rol}
                                                        </span>
                                                        {persona.b1 && (
                                                            <span className={getTableBadgeClass('b1')}>
                                                                B1
                                                            </span>
                                                        )}
                                                        {persona.b2 && (
                                                            <span className={getTableBadgeClass('b2')}>
                                                                B2
                                                            </span>
                                                        )}
                                                        {persona.lv && (
                                                            <span className={getTableBadgeClass('lv')}>
                                                                LV
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-right p-4">
                                                <span className={cn("font-mono font-semibold text-lg text-foreground pr-2",
                                                    getDias(persona) === 0 && "text-muted-foreground"
                                                )}>
                                                    {getDias(persona)}
                                                </span>
                                            </td>
                                        </TableRow>
                                    ))
                                )}
                                </tbody>
                            </table>
                        </PageTableContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}
