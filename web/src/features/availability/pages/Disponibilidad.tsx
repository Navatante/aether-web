import React, {useEffect, useState} from 'react';
import {useLogger} from '@/lib/logger';
import {Select, SelectContent, SelectItem, SelectTrigger} from "@/components/ui/select";
import {Loader2, PartyPopper, RefreshCw, Search} from "lucide-react";
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
} from "@/shared/components/common";
import {HoverCard, HoverCardContent, HoverCardTrigger} from "@/components/ui/hover-card";
import {
    RegisterAbsenceDialog,
    FestivosDialog,
    getReasonColor,
    type Absence,
    type DialogMode,
    type Person,
    type PersonComision,
    type Festivo
} from "../components";
import {AvailabilityTooltip} from "../components/AvailabilityTooltip";
import {AbsenceTooltip} from "../components/AbsenceTooltip";
import {PermissionLevel, useHasPermission, useEscuadrilla} from "@/providers";
import { http } from "@/lib/http";
import { useApiQuery } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";

// Re-exportar tipos si son necesarios en otros lugares
export type { Person, Absence, PersonComision };

interface AvailabilityData {
    persons: Person[];
    absenses: Absence[];
    person_comisions: PersonComision[];
}

interface Day {
    day: number;
    dayOfWeek: number;
    isWeekend: boolean;
    dateStr: string;
}

const monthNames: string[] = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const dayNames: string[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const displayRoles = ['Piloto', 'Dotación', 'Nadador', 'No tripulante'];

const EMOJI_SUN = '☀️';
const EMOJI_MOON = '🌑';

export default function Disponibilidad(): React.ReactElement {
    const log = useLogger('Disponibilidad');
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
    const hasAdministrativePermission = useHasPermission(PermissionLevel.ADMINISTRATIVO);
    const hasCommonPermission = useHasPermission(PermissionLevel.COMUN);
    const { id: escId } = useEscuadrilla();

    // Availability data via TanStack Query
    const availabilityParams = {
        month: String(selectedMonth + 1),
        year: String(selectedYear),
    };

    const {
        data: availabilityData,
        isLoading,
        error: availabilityError,
        refetch: refetchAvailability,
    } = useApiQuery<AvailabilityData>(
        'GET',
        '/availability',
        { query: availabilityParams },
        queryKeys.availability.calendar(escId ?? 0, availabilityParams),
    );

    const data: AvailabilityData = {
        persons: availabilityData?.persons ?? [],
        absenses: availabilityData?.absenses ?? [],
        person_comisions: availabilityData?.person_comisions ?? [],
    };
    const error = availabilityError?.message ?? null;

    // Estado para festivos (uses invoke without RLS)
    const [festivos, setFestivos] = useState<Festivo[]>([]);

    // Estados de UI para filtros
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [roleFilter, setRoleFilter] = useState<string>('Todos los roles');
    const [escalaFilter, setEscalaFilter] = useState<string>('Todas las escalas');

    // Estados para el dialog
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [dialogMode, setDialogMode] = useState<DialogMode>('create');
    const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [selectedComision, setSelectedComision] = useState<PersonComision | null>(null);
    const [initialDialogData, setInitialDialogData] = useState<{
        personId?: number | '';
        startDate?: string;
        endDate?: string;
        reason?: string;
        remark?: string;
    } | undefined>(undefined);

    // Estado para el dialog de Festivos
    const [isFestivosDialogOpen, setIsFestivosDialogOpen] = useState<boolean>(false);


    // Función para cargar festivos
    const fetchFestivos = async () => {
        try {
            const result = await http<Festivo[]>('GET', '/festivos');
            setFestivos(result || []);
        } catch (err) {
            log.error(`Error fetching festivos: ${err}`);
        }
    };

    // Cargar festivos al montar
    useEffect(() => {
        fetchFestivos();
    }, []);

    // Escuchar evento de refresh desde TopbarMenus
    useEffect(() => {
        const handleRefresh = () => refetchAvailability();
        window.addEventListener('refresh-availability', handleRefresh);
        return () => window.removeEventListener('refresh-availability', handleRefresh);
    }, [refetchAvailability]);

    // Crear un Set de fechas festivas para búsqueda rápida O(1)
    const festivosSet = (() => {
        const set = new Set<string>();
        festivos.forEach(f => {
            const fecha = f.festivo_dia.split('T')[0];
            set.add(fecha);
        });
        return set;
    })();

    // Función para verificar si un día es festivo
    const isHoliday = (dateStr: string): boolean => {
        return festivosSet.has(dateStr);
    };

    // Función para obtener el motivo del festivo
    const getHolidayName = (dateStr: string): string | undefined => {
        const festivo = festivos.find(f => f.festivo_dia.split('T')[0] === dateStr);
        return festivo?.festivo_motivo;
    };

    // Obtener escalas unicas de los datos
    const uniqueEscala = Array.from(new Set(data.persons.map(p => p.escala))).filter(Boolean);

    // Obtener razones de ausencia únicas de los datos
    const uniqueAbsenceReasons = (() => {
        const reasons = new Set(data.absenses.map(a => a.absence_reason));
        return Array.from(reasons).filter(Boolean);
    })();

    const daysInMonth: number = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const days: Day[] = Array.from({ length: daysInMonth }, (_, i): Day => {
        const date = new Date(selectedYear, selectedMonth, i + 1);
        return {
            day: i + 1,
            dayOfWeek: date.getDay(),
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            dateStr: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
        };
    });

    // Filtrar personas basado en búsqueda y rol
    const filteredPersons = (() => {
        const normalize = (str: string) =>
            str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const searchLower = searchTerm ? normalize(searchTerm) : '';

        return data.persons.filter(person => {
            const normalizedName = normalize(person.full_name);
            const matchesSearch = !searchTerm || normalizedName.includes(searchLower);

            let matchesRole = false;
            if (roleFilter === 'Todos los roles') {
                matchesRole = true;
            } else if (roleFilter === 'Dotación') {
                matchesRole = person.person_rol === 'Dotación' || person.person_rol === 'Dotación/Nadador';
            } else if (roleFilter === 'Nadador') {
                matchesRole = person.person_rol === 'Nadador' || person.person_rol === 'Dotación/Nadador';
            } else {
                matchesRole = person.person_rol === roleFilter;
            }

            const matchesEscala = escalaFilter === 'Todas las escalas' || person.escala === escalaFilter;
            return matchesSearch && matchesRole && matchesEscala;
        });
    })();

    // Obtener ausencia para un día específico
    const getAbsenceForDay = (personId: number, dateStr: string): Absence | undefined => {
        return data.absenses.find((absence: Absence) => {
            if (absence.absence_person_fk !== personId) return false;
            const start = new Date(absence.absence_start_date);
            const end = new Date(absence.absence_end_date);
            const current = new Date(dateStr);
            return current >= start && current <= end;
        });
    };

    // Obtener comisión para un día específico
    const getComisionForDay = (personId: number, dateStr: string): PersonComision | undefined => {
        return data.person_comisions.find((comision: PersonComision) => {
            if (comision.person_fk !== personId) return false;
            const start = new Date(comision.comision_start_date);
            const end = new Date(comision.comision_end_date);
            const current = new Date(dateStr);
            return current >= start && current <= end;
        });
    };

    // Obtener personas ausentes para un día específico (para el tooltip)
    const getAbsentPersonsForDay = (dateStr: string) => {
        return filteredPersons
            .map(person => {
                const absence = getAbsenceForDay(person.person_sk, dateStr);
                const comision = getComisionForDay(person.person_sk, dateStr);
                if (absence || comision) {
                    return { person, absence, comision };
                }
                return null;
            })
            .filter((item): item is { person: Person; absence: Absence | undefined; comision: PersonComision | undefined } => item !== null);
    };

    // === FUNCIONES PARA ABRIR EL DIALOG ===

    const openCreateDialog = (initialData?: {
        personId?: number | '';
        startDate?: string;
        endDate?: string;
        reason?: string;
        remark?: string;
    }) => {
        setDialogMode('create');
        setSelectedAbsence(null);
        setSelectedPerson(null);
        setSelectedComision(null);
        setInitialDialogData(initialData);
        setIsDialogOpen(true);
    };

    const openViewAbsenceDialog = (person: Person, absence: Absence) => {
        setDialogMode('view');
        setSelectedPerson(person);
        setSelectedAbsence(absence);
        setSelectedComision(null);
        setInitialDialogData(undefined);
        setIsDialogOpen(true);
    };

    const openViewComisionDialog = (person: Person, comision: PersonComision) => {
        setDialogMode('view-comision');
        setSelectedPerson(person);
        setSelectedComision(comision);
        setSelectedAbsence(null);
        setInitialDialogData(undefined);
        setIsDialogOpen(true);
    };

    // === HANDLER PARA EL GRID ===

    const handleCellClick = (person: Person, day: Day): void => {
        const absence = getAbsenceForDay(person.person_sk, day.dateStr);
        const comision = getComisionForDay(person.person_sk, day.dateStr);

        if (absence) {
            {!hasCommonPermission && (
                openViewAbsenceDialog(person, absence)
            )}
        } else if (comision) {
            {hasAdministrativePermission && (
                openViewComisionDialog(person, comision)
            )}
        } else {
            {!hasCommonPermission && (
                openCreateDialog({
                    personId: person.person_sk,
                    startDate: day.dateStr,
                    endDate: day.dateStr,
                    reason: 'Permiso'
                })
            )}
        }
    };

    const handleDialogSuccess = () => {
        refetchAvailability();
    };

    const handleFestivosDialogClose = (open: boolean) => {
        setIsFestivosDialogOpen(open);
        if (!open) {
            fetchFestivos();
        }
    };

    // === OTRAS FUNCIONES ===

    const getAvailabilityForDay = (dateStr: string): number => {
        const absentCount = filteredPersons.filter((person: Person) => {
            const hasAbsence = getAbsenceForDay(person.person_sk, dateStr) !== undefined;
            const hasComision = getComisionForDay(person.person_sk, dateStr) !== undefined;
            return hasAbsence || hasComision;
        }).length;
        return filteredPersons.length - absentCount;
    };

    const handleRefresh = () => {
        refetchAvailability();
        fetchFestivos();
    };

    // Función helper para obtener las clases de estilo de un día (header)
    const getDayHeaderClass = (day: Day): string => {
        const holiday = isHoliday(day.dateStr);
        if (holiday) {
            return 'bg-red-100/70 dark:bg-red-900/30';
        }
        if (day.isWeekend) {
            return 'bg-gray-200/50 dark:bg-black';
        }
        return 'bg-gray-100/70 dark:bg-neutral-800/95';
    };

    // Función helper para obtener las clases de estilo de un día (celda)
    const getDayCellClass = (day: Day): string => {
        const holiday = isHoliday(day.dateStr);
        if (holiday) {
            return 'bg-red-50/50 dark:bg-red-900/20';
        }
        if (day.isWeekend) {
            return 'bg-slate-100/50 dark:bg-black';
        }
        return '';
    };

    return (
        <div className="h-full flex flex-col p-6 pb-8">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header - Sticky */}
                <div className="flex-shrink-0 sticky top-0 z-20 bg-inherit pb-4">
                    <div className="mb-6 text-center">
                        <GradientTitle>Disponibilidad</GradientTitle>
                    </div>

                    {/* Controles */}
                    <PageControls>
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Campo de búsqueda */}
                            <div className="flex-1 min-w-[200px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-card border-input border focus:border-ring focus:outline-none transition-all placeholder:text-muted-foreground text-foreground w-full pl-10 pr-4 py-2.5 rounded-xl"
                                        aria-label="Buscar personal"
                                    />
                                </div>
                            </div>

                            {/* Filtro por Rol */}
                            <Select value={roleFilter} onValueChange={(value) => setRoleFilter( value ?? 'Todos los roles')}>
                                <SelectTrigger className="min-w-[160px] bg-card border-input">
                                    <span>{roleFilter}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Todos los roles">Todos los roles</SelectItem>
                                    {displayRoles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Filtro por Escala */}
                            <Select value={escalaFilter} onValueChange={(value)=> setEscalaFilter(value ?? 'Todas las escalas')}>
                                <SelectTrigger className="min-w-[160px] bg-card border-input">
                                    <span>{escalaFilter}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Todas las escalas">Todos las escalas</SelectItem>
                                    {uniqueEscala.map((escala) => (
                                        <SelectItem key={escala} value={escala}>
                                            {escala}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Select de Mes */}
                            <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(parseInt(value ?? ''))}>
                                <SelectTrigger className="min-w-[140px] bg-card border-input">
                                    <span>{monthNames[selectedMonth]}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    {monthNames.map((month, i) => (
                                        <SelectItem key={i} value={String(i)}>{month}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Select de Año */}
                            <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(parseInt(value ?? ''))}>
                                <SelectTrigger className="min-w-[100px] bg-card border-input">
                                    <span>{selectedYear}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026].map((year) => (
                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex flex-wrap gap-3 items-center">
                                {/* Botón Festivos */}
                                {hasAdministrativePermission && (
                                    <ActionButton
                                        variant={undefined}
                                        icon={PartyPopper}
                                        label="Festivos"
                                        onClick={() => setIsFestivosDialogOpen(true)}
                                    />
                                )}
                                {/* Botón Refrescar */}
                                <ActionButton
                                    variant="refresh"
                                    icon={RefreshCw}
                                    label="Refrescar"
                                    onClick={(e) => {
                                        handleRefresh();
                                        const icon = e.currentTarget.querySelector("svg");
                                        if (icon) {
                                            icon.classList.remove("animate-spin-once");
                                            requestAnimationFrame(() => {
                                                icon.classList.add("animate-spin-once");
                                            });
                                        }
                                    }}
                                    disabled={isLoading}
                                    loading={isLoading}
                                />
                            </div>
                        </div>
                    </PageControls>

                    {/* Legend */}
                    <PageControls>
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: 'rgba(79,164,200,0.76)' }}
                                />
                                <span className="text-sm text-slate-600 dark:text-slate-300">Comisión</span>
                            </div>
                            {uniqueAbsenceReasons.map((reason) => {
                                const reasonData = getReasonColor(reason);
                                const isVueloDia = reason === 'Vuelo día';
                                const isVueloNoche = reason === 'Vuelo noche';

                                return (
                                    <div key={reason} className="flex items-center gap-2">
                                        {isVueloDia ? (
                                            <span className="text-base">{EMOJI_SUN}</span>
                                        ) : isVueloNoche ? (
                                            <span className="text-base">{EMOJI_MOON}</span>
                                        ) : (
                                            <div
                                                className="w-3 h-3 rounded"
                                                style={{ backgroundColor: reasonData.color }}
                                            />
                                        )}
                                        <span className="text-sm text-slate-600 dark:text-slate-300">{reasonData.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </PageControls>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="flex-shrink-0 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
                        <button
                            onClick={handleRefresh}
                            className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-3 text-slate-600 dark:text-slate-300">Cargando disponibilidad...</span>
                    </div>
                )}

                {/* Calendar Grid */}
                {!isLoading && (
                    <PageTableContainer className="flex-1 overflow-auto">
                        <table className="w-full" role="table">
                            <thead className="sticky top-0 z-10 bg-table-header backdrop-blur-md">
                            <tr>
                                <th className="text-left p-4 font-semibold text-table-header-foreground min-w-[220px] sticky left-0 z-20 bg-table-header">
                                </th>
                                {days.map((day: Day) => {
                                    const holiday = isHoliday(day.dateStr);

                                    return (
                                        <th
                                            key={day.day}
                                            className={`text-center p-0 min-w-[38px] font-semibold text-table-header-foreground ${getDayHeaderClass(day)}`}
                                        >
                                            <HoverCard>
                                                <HoverCardTrigger
                                                    delay={0}
                                                    closeDelay={150}
                                                    render={<div className="p-2 cursor-help" />}
                                                >
                                                    <span className={`block text-[10px] uppercase tracking-wide ${holiday ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {dayNames[day.dayOfWeek]}
                                                    </span>
                                                    <span className={`block text-sm font-medium mt-0.5 ${holiday ? 'text-red-600 dark:text-red-400' : ''}`}>
                                                        {day.day}
                                                    </span>
                                                </HoverCardTrigger>
                                                <HoverCardContent side="bottom" className="w-auto p-4 max-h-[400px] overflow-auto">
                                                    {/* Mostrar nombre del festivo si aplica */}
                                                    {isHoliday(day.dateStr) && (
                                                        <div className="mb-2 pb-2 border-b border-red-200 dark:border-red-800">
                                                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                                                🎉 {getHolidayName(day.dateStr)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <AvailabilityTooltip
                                                        day={day}
                                                        availableCount={getAvailabilityForDay(day.dateStr)}
                                                        totalCount={filteredPersons.length}
                                                        absentPersons={getAbsentPersonsForDay(day.dateStr)}
                                                    />
                                                </HoverCardContent>
                                            </HoverCard>
                                        </th>
                                    );
                                })}
                            </tr>
                            </thead>
                            <tbody>
                            {filteredPersons.length === 0 ? (
                                <tr>
                                    <td colSpan={days.length + 1} className="p-8 text-center text-muted-foreground">
                                        No se encontraron empleados
                                    </td>
                                </tr>
                            ) : (
                                filteredPersons.map((person: Person, idx: number) => (
                                    <tr
                                        key={person.person_sk}
                                        className={`border-b border-border hover:bg-table-row-hover transition-colors ${idx % 2 === 0 ? 'bg-table-row-even' : 'bg-table-row-odd'}`}
                                    >
                                        <td className={`p-3 sticky left-0 z-5 border-b border-border shadow-sm ${idx % 2 === 0 ? 'bg-table-row-even' : 'bg-table-row-odd'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-foreground">
                                                            {person.full_name}
                                                        </span>
                                                </div>
                                            </div>
                                        </td>
                                        {days.map((day: Day) => {
                                            const absence = getAbsenceForDay(person.person_sk, day.dateStr);
                                            const comision = getComisionForDay(person.person_sk, day.dateStr);

                                            const event = absence || comision;

                                            let isStart = false;
                                            let isEnd = false;
                                            let color = '';
                                            let isVueloDia = false;
                                            let isVueloNoche = false;

                                            if (absence) {
                                                isStart = absence.absence_start_date.startsWith(day.dateStr);
                                                isEnd = absence.absence_end_date.startsWith(day.dateStr);
                                                color = getReasonColor(absence.absence_reason).color;
                                                isVueloDia = absence.absence_reason === 'Vuelo día';
                                                isVueloNoche = absence.absence_reason === 'Vuelo noche';
                                            } else if (comision) {
                                                isStart = comision.comision_start_date.startsWith(day.dateStr);
                                                isEnd = comision.comision_end_date.startsWith(day.dateStr);
                                                color = 'rgba(79,164,200,0.76)';
                                            }

                                            return (
                                                <td
                                                    key={day.day}
                                                    className={`p-1 text-center border-b border-gray-100/70 dark:border-neutral-800/95 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50 ${getDayCellClass(day)}`}
                                                    onClick={() => handleCellClick(person, day)}
                                                >
                                                    {event && (
                                                        <HoverCard>
                                                            <HoverCardTrigger
                                                                delay={0}
                                                                closeDelay={150}
                                                                render={
                                                                    <div
                                                                        className="h-7 flex items-center justify-center transition-transform hover:scale-105"
                                                                        style={{
                                                                            backgroundColor:
                                                                                isVueloDia || isVueloNoche ? "transparent" : color,
                                                                            borderRadius: isStart && isEnd
                                                                                ? "6px"
                                                                                : isStart
                                                                                    ? "6px 0 0 6px"
                                                                                    : isEnd
                                                                                        ? "0 6px 6px 0"
                                                                                        : "0",
                                                                            marginLeft: isStart ? "2px" : "-1px",
                                                                            marginRight: isEnd ? "2px" : "-1px",
                                                                        }}
                                                                    />
                                                                }
                                                            >
                                                                {isVueloDia && EMOJI_SUN}
                                                                {isVueloNoche && EMOJI_MOON}
                                                            </HoverCardTrigger>
                                                            <HoverCardContent side="top" className="w-auto p-4">
                                                                <AbsenceTooltip
                                                                    person={person}
                                                                    absence={absence}
                                                                    comision={comision}
                                                                />
                                                            </HoverCardContent>
                                                        </HoverCard>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </PageTableContainer>
                )}
            </div>

            {/* Dialog de Ausencias/Comisiones */}
            <RegisterAbsenceDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                mode={dialogMode}
                persons={data.persons}
                initialData={initialDialogData}
                selectedAbsence={selectedAbsence}
                selectedPerson={selectedPerson}
                selectedComision={selectedComision}
                onSuccess={handleDialogSuccess}
            />

            {/* Dialog de Festivos */}
            <FestivosDialog
                open={isFestivosDialogOpen}
                onOpenChange={handleFestivosDialogClose}
            />

        </div>
    );
}
