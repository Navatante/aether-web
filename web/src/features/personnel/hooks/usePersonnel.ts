// Estado, datos y handlers de la página de Personal. La página queda solo
// con el render (tabla, drawer de alta/edición, diálogo de baja/alta).

import React, { useState, useTransition } from 'react';
import { useApiPaginatedQuery, useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useConfirmationDialog } from "@/shared/hooks";
import { downloadCSV } from "@/shared/utils/csvExport";
import { transformPersonnelFromDB } from "../utils/transformPersonnelFromDB";
import { Person } from "@/types/person";
import type { PersonItem } from "@/types/generated/persons";
import { useEscuadrilla, useUser } from "@/providers";
import { toast } from "sonner";
import { type PersonFormValues, CUERPOS } from "../components";

interface DarDeBajaState {
    status: 'idle' | 'success' | 'error';
    error?: string;
}

export function usePersonnel() {
    const { open: openDialog, close: closeDialog, setConfirmation, dialog, requiredText } = useConfirmationDialog();
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'Todos' | 'active' | 'inactive'>('active');
    const { hasPermission } = useUser();
    const { id: escId } = useEscuadrilla();
    const [, startTransition] = useTransition();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);

    const {
        data: personnel,
        isLoading,
        isFetching,
        refetch,
    } = useApiPaginatedQuery<Person, PersonItem>({
        path: "/persons",
        queryKey: queryKeys.personnel.list(escId ?? 0, {}),
        transform: transformPersonnelFromDB,
    });

    // Invalida todo el dominio de personal de la escuadrilla (cualquier lista,
    // sin depender de los params). Los errores HTTP los notifica el toast de useApiMutation.
    const invalidateKeys = [queryKeys.personnel.all(escId ?? 0)];
    const createPerson = useApiMutation<void, Record<string, unknown>>(
        "POST", "/persons",
        { invalidateKeys, successMessage: "Persona añadida correctamente" },
    );
    const updatePerson = useApiMutation<void, Record<string, unknown>>(
        "PUT", (v) => `/persons/${v.person_sk}`,
        { invalidateKeys, successMessage: "Persona editada correctamente", body: ({ person_sk, ...rest }) => rest },
    );
    const toggleActive = useApiMutation<void, { person_sk: number; action: "activate" | "deactivate" }>(
        "POST", (v) => `/persons/${v.person_sk}/${v.action}`,
        { invalidateKeys, body: () => undefined },
    );

    const handlePersonSubmit = async (data: PersonFormValues) => {
        const payload: Record<string, unknown> = {
            ...data,
            person_a_emp: data.person_a_emp ? data.person_a_emp.toISOString().split('T')[0] : null,
            person_f_emb: data.person_f_emb ? data.person_f_emb.toISOString().split('T')[0] : null,
            person_birthdate: data.person_birthdate ? data.person_birthdate.toISOString().split('T')[0] : null,
            person_nk: data.person_nk?.trim() === "" ? null : data.person_nk,
            person_dni: data.person_dni?.trim() === "" ? null : data.person_dni,
        };

        try {
            if (editingPerson) {
                await updatePerson.mutateAsync({ ...payload, person_sk: editingPerson.person_sk });
            } else {
                await createPerson.mutateAsync(payload);
            }
            setDrawerOpen(false);
            setEditingPerson(null);
            setSelectedPerson(null);
        } catch {
            // El error HTTP ya lo notifica el toast de useApiMutation.
        }
    };

    const handleAddClick = () => {
        setEditingPerson(null);
        setDrawerOpen(true);
    };

    const handleEditClick = (person: Person) => {
        setEditingPerson(person);
        setDrawerOpen(true);
    };

    const [, toggleActiveAction, isToggling] = React.useActionState<
        DarDeBajaState,
        { personSk: number; makeActive: boolean }
    >(
        async (_prev, { personSk, makeActive }) => {
            try {
                await toggleActive.mutateAsync({ person_sk: personSk, action: makeActive ? "activate" : "deactivate" });
                closeDialog();
                setSelectedPerson(null);
                toast.success(makeActive ? "Personal dado de alta correctamente" : "Personal dado de baja correctamente");
                return { status: 'success' };
            } catch (error) {
                // El error HTTP ya lo notifica el toast de useApiMutation.
                const msg = error instanceof Error ? error.message : "Error en la operación";
                return { status: 'error', error: msg };
            }
        },
        { status: 'idle' }
    );

    const filteredPersonnel = (() => {
        const normalize = (str: string) =>
            str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const searchLower = searchTerm ? normalize(searchTerm) : '';

        return personnel.filter(p => {
            const fullName = `${p.person_name} ${p.person_last_name_1} ${p.person_last_name_2}`;
            const normalizedName = normalize(fullName);

            const matchesSearch = !searchTerm || normalizedName.includes(searchLower);
            const matchesStatus = statusFilter === 'Todos' ||
                (statusFilter === 'active' && p.person_active) ||
                (statusFilter === 'inactive' && !p.person_active);

            return matchesSearch && matchesStatus;
        });
    })();

    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "—";
        const date = new Date(dateStr);
        return isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const handleRowClick = (person: Person) => {
        setSelectedPerson(prev => prev?.person_sk === person.person_sk ? null : person);
    };

    const handleRefresh = () => startTransition(() => { refetch(); });

    const openDarDeBajaOaltaDialog = (person: Person) => {
        openDialog({
            id: person.person_sk,
            name: `${person.person_name} ${person.person_last_name_1}`,
            isActive: person.person_active,
        });
    };

    const confirmationPrefix = dialog.target?.isActive ? 'dardebajapersona' : 'dardealtapersona';
    const requiredConfirmation = `${confirmationPrefix}${dialog.target?.id}`;

    const exportToCSV = () => {
        if (filteredPersonnel.length === 0) {
            toast.info("No hay datos para exportar");
            return;
        }

        const headers = [
            "ID", "Código", "Usuario", "Empleo", "Cuerpo", "Especialidad",
            "Nombre", "Apellido1", "Apellido2", "Teléfono", "DNI", "Localidad",
            "División", "Rol", "Antigüedad", "Embarque", "Nacimiento",
            "Escalafón", "Estado"
        ];

        const rows = filteredPersonnel.map(p => [
            p.person_sk,
            p.person_nk ?? "",
            p.person_user,
            p.person_rank,
            p.person_cuerpo,
            p.person_especialidad,
            p.person_name,
            p.person_last_name_1,
            p.person_last_name_2,
            p.person_phone,
            p.person_dni,
            p.person_localidad,
            p.person_division,
            p.person_rol,
            formatDate(p.person_a_emp),
            formatDate(p.person_f_emb),
            formatDate(p.person_birthdate),
            p.person_num_escalafon,
            p.person_active ? "Activo" : "Inactivo"
        ]);

        downloadCSV("personal", headers, rows);

        toast.success(`Exportados ${filteredPersonnel.length} registros a CSV en la carpeta de Descargas`);
    };

    const getRoleType = (role: string): "pilot" | "crew" | "swimmer" | "crewAndSwimmer" | "noCrew" | "default" => {
        switch (role) {
            case 'Piloto':
                return 'pilot';
            case 'Dotación/Nadador':
                return 'crewAndSwimmer';
            case 'Dotación':
                return 'crew';
            case 'Nadador':
                return 'swimmer';
            case 'No Tripulante':
                return 'noCrew';
            default:
                return 'default';
        }
    };

    // Función helper para preparar los defaultValues
    const prepareDefaultValues = (person: Person): Partial<PersonFormValues> => {
        return {
            person_nk: person.person_nk ?? "",
            person_user: person.person_user,
            person_rank: person.person_rank || "",
            person_cuerpo: person.person_cuerpo as typeof CUERPOS[number] | undefined,
            person_especialidad: person.person_especialidad || "",
            person_name: person.person_name,
            person_last_name_1: person.person_last_name_1,
            person_last_name_2: person.person_last_name_2,
            person_phone: person.person_phone,
            person_dni: person.person_dni ?? "",
            person_localidad: person.person_localidad || "",
            person_division: person.person_division || "",
            person_rol: person.person_rol || "",
            person_num_escalafon: person.person_num_escalafon,
            person_a_emp: person.person_a_emp ? new Date(person.person_a_emp) : undefined,
            person_f_emb: person.person_f_emb ? new Date(person.person_f_emb) : undefined,
            person_birthdate: person.person_birthdate ? new Date(person.person_birthdate) : undefined,
        };
    };

    return {
        // datos
        personnel,
        filteredPersonnel,
        isLoading,
        isFetching,

        // filtros
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,

        // selección y drawer
        selectedPerson,
        drawerOpen,
        setDrawerOpen,
        editingPerson,
        setEditingPerson,
        handleRowClick,
        handleAddClick,
        handleEditClick,
        handlePersonSubmit,
        prepareDefaultValues,

        // baja/alta con confirmación
        dialog,
        closeDialog,
        setConfirmation,
        requiredText,
        requiredConfirmation,
        openDarDeBajaOaltaDialog,
        toggleActiveAction,
        isToggling,

        // utilidades
        formatDate,
        getRoleType,
        exportToCSV,
        handleRefresh,
        hasPermission,
    };
}
