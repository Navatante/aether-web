// Estado, datos y handlers de la página Disponibilidad. La página queda
// solo con el render; aquí vive el calendario, filtros, festivos y diálogos.

import { useEffect, useMemo, useState } from 'react';
import { useLogger } from '@/lib/logger';
import { PermissionLevel, useHasPermission, useEscuadrilla, useUser } from '@/providers';
import { http } from '@/lib/http';
import { useApiQuery } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import type { Absence, DialogMode, Person, PersonComision } from '../absences';
import type { Festivo } from '../components/dialogs/FestivosDialog';

export interface AvailabilityData {
    persons: Person[];
    absenses: Absence[];
    person_comisions: PersonComision[];
}

export interface Day {
    day: number;
    dayOfWeek: number;
    isWeekend: boolean;
    dateStr: string;
}

export const monthNames: string[] = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const dayNames: string[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export const displayRoles = ['Piloto', 'Dotación', 'Nadador', 'No tripulante'];

export function useDisponibilidad() {
    const log = useLogger('Disponibilidad');
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
    const hasAdministrativePermission = useHasPermission(PermissionLevel.ADMINISTRATIVO);
    const { canAccess } = useUser();
    // Escritura de ausencias = Operacional o Administrativo (Superusuario hace
    // bypass vía canAccess). Espejo de la allow-list del backend.
    const canWriteAbsence = canAccess([PermissionLevel.OPERACIONAL, PermissionLevel.ADMINISTRATIVO]);
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

    // Índices persona -> eventos, para evitar barridos O(días×personas×N) por celda.
    // Las fechas del backend son YYYY-MM-DD, así que se comparan como strings.
    const absencesByPerson = useMemo(() => {
        const map = new Map<number, Absence[]>();
        for (const a of availabilityData?.absenses ?? []) {
            const arr = map.get(a.absence_person_fk);
            if (arr) arr.push(a);
            else map.set(a.absence_person_fk, [a]);
        }
        return map;
    }, [availabilityData]);

    const comisionsByPerson = useMemo(() => {
        const map = new Map<number, PersonComision[]>();
        for (const c of availabilityData?.person_comisions ?? []) {
            const arr = map.get(c.person_fk);
            if (arr) arr.push(c);
            else map.set(c.person_fk, [c]);
        }
        return map;
    }, [availabilityData]);

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

    // Todas las ausencias que cubren un día concreto (una persona puede tener
    // varias solapadas). Fechas YYYY-MM-DD → comparación directa de strings.
    const getAbsencesForDay = (personId: number, dateStr: string): Absence[] => {
        const arr = absencesByPerson.get(personId);
        if (!arr) return [];
        return arr.filter(a =>
            a.absence_start_date.slice(0, 10) <= dateStr &&
            dateStr <= a.absence_end_date.slice(0, 10)
        );
    };

    // Comisión para un día específico (a lo sumo una: los triggers impiden
    // comisiones solapadas y comisión+ausencia a la vez).
    const getComisionForDay = (personId: number, dateStr: string): PersonComision | undefined => {
        const arr = comisionsByPerson.get(personId);
        if (!arr) return undefined;
        return arr.find(c =>
            c.comision_start_date.slice(0, 10) <= dateStr &&
            dateStr <= c.comision_end_date.slice(0, 10)
        );
    };

    // Personas ausentes para un día (para el tooltip): una entrada por cada
    // ausencia, de modo que AvailabilityTooltip las agrupe por motivo.
    const getAbsentPersonsForDay = (dateStr: string) => {
        const items: Array<{ person: Person; absence?: Absence; comision?: PersonComision }> = [];
        for (const person of filteredPersons) {
            const comision = getComisionForDay(person.person_sk, dateStr);
            if (comision) {
                items.push({ person, comision });
                continue;
            }
            for (const absence of getAbsencesForDay(person.person_sk, dateStr)) {
                items.push({ person, absence });
            }
        }
        return items;
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

    // === HANDLERS PARA EL GRID ===
    // Granulares para soportar varias ausencias por celda: cada franja abre la
    // suya; clicar la celda vacía crea una nueva.

    const handleViewAbsence = (person: Person, absence: Absence): void => {
        if (canWriteAbsence) openViewAbsenceDialog(person, absence);
    };

    const handleViewComision = (person: Person, comision: PersonComision): void => {
        if (hasAdministrativePermission) openViewComisionDialog(person, comision);
    };

    const handleCreateForCell = (person: Person, day: Day): void => {
        if (canWriteAbsence) {
            openCreateDialog({
                personId: person.person_sk,
                startDate: day.dateStr,
                endDate: day.dateStr,
                reason: 'Permiso',
            });
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
            const hasAbsence = getAbsencesForDay(person.person_sk, dateStr).length > 0;
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
            return 'bg-danger-muted';
        }
        if (day.isWeekend) {
            return 'bg-calendar-weekend';
        }
        return 'bg-table-header';
    };

    // Función helper para obtener las clases de estilo de un día (celda)
    const getDayCellClass = (day: Day): string => {
        const holiday = isHoliday(day.dateStr);
        if (holiday) {
            return 'bg-danger-muted/60';
        }
        if (day.isWeekend) {
            return 'bg-calendar-weekend';
        }
        return '';
    };


    return {
        // datos
        data,
        isLoading,
        error,
        days,
        filteredPersons,
        uniqueEscala,
        uniqueAbsenceReasons,

        // calendario / festivos
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        isHoliday,
        getHolidayName,
        getDayHeaderClass,
        getDayCellClass,

        // filtros
        searchTerm,
        setSearchTerm,
        roleFilter,
        setRoleFilter,
        escalaFilter,
        setEscalaFilter,

        // consultas por celda
        getAbsencesForDay,
        getComisionForDay,
        getAbsentPersonsForDay,
        getAvailabilityForDay,

        // diálogos
        isDialogOpen,
        setIsDialogOpen,
        dialogMode,
        selectedAbsence,
        selectedPerson,
        selectedComision,
        initialDialogData,
        isFestivosDialogOpen,
        setIsFestivosDialogOpen,
        handleFestivosDialogClose,
        handleDialogSuccess,

        // acciones
        handleViewAbsence,
        handleViewComision,
        handleCreateForCell,
        handleRefresh,

        // permisos
        hasAdministrativePermission,
    };
}
