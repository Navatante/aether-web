// src/features/personnel/pages/Personnel.tsx
import React, { useState, useTransition } from 'react';
import { useApiPaginatedQuery } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useConfirmationDialog } from "@/shared/hooks";
import { transformPersonnelFromDB } from "@/features";
import { Person } from "@/types/person";
import { http } from "@/lib/http";
import { useEscuadrilla } from "@/providers";
import { toast } from "sonner";
import {
    Select, SelectContent, SelectItem, SelectTrigger
} from "@/components/ui/select";
import {
    Edit, RefreshCw, UserPlus, Download, ChevronUp, ChevronDown, UserMinus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useUser, PermissionLevel } from "@/providers";
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    PageCard,
    PageCardLabel,
    StickyTableHeader,
    TableRow,
    DetailsRow,
    SearchInput,
    RoleBadge
} from "@/shared/components/common";
import { AddEditPersonForm, type PersonFormValues, CUERPOS } from "../components";

interface DarDeBajaState {
    status: 'idle' | 'pending' | 'success' | 'error';
    error?: string;
}

const Personnel = () => {
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
    } = useApiPaginatedQuery<Person>({
        path: "/persons",
        queryKey: queryKeys.personnel.list(escId ?? 0, {}),
        transform: transformPersonnelFromDB,
    });


    const handlePersonSubmit = async (data: PersonFormValues) => {
        try {
            const payload = {
                ...data,
                person_a_emp: data.person_a_emp ? data.person_a_emp.toISOString().split('T')[0] : null,
                person_f_emb: data.person_f_emb ? data.person_f_emb.toISOString().split('T')[0] : null,
                person_birthdate: data.person_birthdate ? data.person_birthdate.toISOString().split('T')[0] : null,
                person_nk: data.person_nk?.trim() === "" ? null : data.person_nk,
                person_dni: data.person_dni?.trim() === "" ? null : data.person_dni,
            };

            if (editingPerson) {
                await http("PUT", `/persons/${editingPerson.person_sk}`, { body: payload });
                toast.success("Persona editada correctamente");
            } else {
                await http("POST", "/persons", { body: payload });
                toast.success("Persona añadida correctamente");
            }

            await refetch();
            setDrawerOpen(false);
            setEditingPerson(null);
            setSelectedPerson(null);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error al guardar";
            toast.error(msg);
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
                const action = makeActive ? "activate" : "deactivate";
                await http("POST", `/persons/${personSk}/${action}`);
                await refetch();
                closeDialog();
                setSelectedPerson(null);
                toast.success(makeActive ? "Personal dado de alta correctamente" : "Personal dado de baja correctamente");
                return { status: 'success' };
            } catch (error) {
                const msg = error instanceof Error ? error.message : "Error en la operación";
                toast.error(msg);
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

        const escapeCSV = (value: any): string => {
            const str = String(value ?? "");
            return `"${str.replace(/"/g, '""')}"`;
        };

        const headers = [
            "ID", "Código", "Usuario", "Empleo", "Cuerpo", "Especialidad",
            "Nombre", "Apellido1", "Apellido2", "Teléfono", "DNI",
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
            p.person_division,
            p.person_rol,
            formatDate(p.person_a_emp),
            formatDate(p.person_f_emb),
            formatDate(p.person_birthdate),
            p.person_num_escalafon,
            p.person_active ? "Activo" : "Inactivo"
        ]);

        const csvContent = [
            headers.map(escapeCSV).join(";"),
            ...rows.map(row => row.map(escapeCSV).join(";"))
        ].join("\n");

        const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const fechaFormateada = new Date()
            .toLocaleDateString('es-ES')
            .split('/')
            .join('-');

        link.download = `personal_${fechaFormateada}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

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
            person_division: person.person_division || "",
            person_rol: person.person_rol || "",
            person_num_escalafon: person.person_num_escalafon,
            person_a_emp: person.person_a_emp ? new Date(person.person_a_emp) : undefined,
            person_f_emb: person.person_f_emb ? new Date(person.person_f_emb) : undefined,
            person_birthdate: person.person_birthdate ? new Date(person.person_birthdate) : undefined,
        };
    };

    return (
        <div className="h-full overflow-y-auto p-6 pb-8">
            <div className="w-full mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <GradientTitle>Personal</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls>
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por Nombre y/o Apellidos..."
                            />
                        </div>

                        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? 'Todos')}>
                            <SelectTrigger className="min-w-[200px]">
                                <span className="flex items-center gap-2">
                                    {statusFilter === "active" && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                                    {statusFilter === "inactive" && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                                    {statusFilter === "active" ? "Activos" : statusFilter === "inactive" ? "Inactivos" : "Todos"}
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Todos">Todos</SelectItem>
                                <SelectItem value="active">
                                    Activos
                                </SelectItem>
                                <SelectItem value="inactive">
                                    Inactivos
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex flex-wrap gap-3 items-center">
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
                                disabled={isFetching}
                                loading={isFetching}
                            />

                            <ActionButton
                                variant="export"
                                icon={Download}
                                label="Exportar CSV"
                                onClick={exportToCSV}
                            />

                            {hasPermission(PermissionLevel.ADMINISTRATIVO) && (
                                <>
                                    <ActionButton
                                        variant="add"
                                        icon={UserPlus}
                                        label="Añadir"
                                        onClick={handleAddClick}
                                    />

                                    <AddEditPersonForm
                                        open={drawerOpen}
                                        onOpenChange={(open) => {
                                            setDrawerOpen(open);
                                            if (!open) {
                                                setEditingPerson(null);
                                            }
                                        }}
                                        defaultValues={editingPerson ? prepareDefaultValues(editingPerson) : undefined}
                                        onSubmit={handlePersonSubmit}
                                        title={editingPerson ? "Editar Persona" : "Añadir Persona"}
                                        description={editingPerson ? "Modifica los campos necesarios." : "Complete todos los campos para añadir una nueva persona."}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </PageControls>

                {/* Tabla */}
                <PageTableContainer>
                    <table className="w-full" role="table">
                        <StickyTableHeader offset="topbar">
                        <tr>
                            <th className="text-left p-4 font-semibold text-table-header-foreground">ID</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Usuario</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Empleo</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Cuerpo</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Especialidad</th>
                            <th className="text-left p-4 font-semibold text-table-header-foreground">Nombre Completo</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground">Rol</th>
                            <th className="text-center p-4 font-semibold text-table-header-foreground"></th>
                        </tr>
                        </StickyTableHeader>
                        <tbody>
                        {isLoading ? (
                            <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Cargando...</td></tr>
                        ) : filteredPersonnel.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No se encontraron personas</td></tr>
                        ) : (
                            filteredPersonnel.map((person, idx) => (
                                <React.Fragment key={person.person_sk}>
                                    <TableRow
                                        index={idx}
                                        isSelected={selectedPerson?.person_sk === person.person_sk}
                                        onClick={() => handleRowClick(person)}
                                    >
                                        <td className="p-4">
                                            <span className="text-sm text-muted-foreground">{person.person_sk}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-muted-foreground">{person.person_user}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-muted-foreground">{person.person_rank}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-muted-foreground">{person.person_cuerpo}</span>
                                        </td>
                                        <td className="text-center p-4">
                                            <span className="text-sm text-muted-foreground">{person.person_especialidad}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-foreground">
                                                {person.person_name} {person.person_last_name_1} {person.person_last_name_2}
                                            </span>
                                        </td>
                                        <td className="text-center p-4">
                                            <RoleBadge role={getRoleType(person.person_rol)}>{person.person_rol}</RoleBadge>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {selectedPerson?.person_sk === person.person_sk ? (
                                                <ChevronUp className="w-5 h-5 text-muted-foreground mx-auto" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto" />
                                            )}
                                        </td>
                                    </TableRow>

                                    {selectedPerson?.person_sk === person.person_sk && (
                                        <DetailsRow colSpan={8}>
                                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
                                                hasPermission(PermissionLevel.ADMINISTRATIVO) ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
                                            }`}>
                                                {/* Contacto */}
                                                <PageCard>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <PageCardLabel>Teléfono</PageCardLabel>
                                                            <p className="text-sm text-foreground">{person.person_phone}</p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>DNI</PageCardLabel>
                                                            <p className="text-sm text-foreground">
                                                                {person.person_dni && person.person_dni.trim() !== "" ? person.person_dni : "-"}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>Estado</PageCardLabel>
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${person.person_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${person.person_active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                                {person.person_active ? 'Activo' : 'Inactivo'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </PageCard>

                                                {/* Organización */}
                                                <PageCard>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <PageCardLabel>Código</PageCardLabel>
                                                            <p className="text-sm text-foreground">
                                                                {person.person_nk && person.person_nk.trim() !== "" ? person.person_nk : "-"}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>División</PageCardLabel>
                                                            <p className="text-sm text-foreground">{person.person_division}</p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>Escalafón</PageCardLabel>
                                                            <p className="text-sm font-semibold font-mono text-foreground px-3 py-1.5 rounded-lg inline-block bg-escala text-escala-foreground">
                                                                #{person.person_num_escalafon}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </PageCard>

                                                {/* Fechas */}
                                                <PageCard>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <PageCardLabel>Nacimiento</PageCardLabel>
                                                            <p className="text-sm text-foreground">{formatDate(person.person_birthdate)}</p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>Antigüedad</PageCardLabel>
                                                            <p className="text-sm text-foreground">{formatDate(person.person_a_emp)}</p>
                                                        </div>
                                                        <div>
                                                            <PageCardLabel>Embarque</PageCardLabel>
                                                            <p className="text-sm text-foreground">{formatDate(person.person_f_emb)}</p>
                                                        </div>
                                                    </div>
                                                </PageCard>

                                                {/* Acciones */}
                                                {hasPermission(PermissionLevel.ADMINISTRATIVO) && (
                                                    <div className="flex flex-col justify-center gap-3">
                                                        <ActionButton
                                                            variant="edit"
                                                            icon={Edit}
                                                            iconSize={16}
                                                            label="Editar"
                                                            aria-label="Editar personal"
                                                            onClick={() => handleEditClick(person)}
                                                            className="items-center justify-center"
                                                        />
                                                        <ActionButton
                                                            variant={person.person_active ? "delete" : "add"}
                                                            icon={person.person_active ? UserMinus : UserPlus}
                                                            iconSize={16}
                                                            label={person.person_active ? "Dar de baja" : "Dar de alta"}
                                                            onClick={() => openDarDeBajaOaltaDialog(person)}
                                                            className="items-center justify-center"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </DetailsRow>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                        </tbody>
                    </table>
                </PageTableContainer>

                {/* Contador */}
                <div className="text-center text-sm text-muted-foreground">
                    Mostrando {filteredPersonnel.length} de {personnel.length} personas
                </div>
            </div>

            {/* Diálogo de dar de baja o alta */}
            <AlertDialog open={dialog.isOpen} onOpenChange={(open) => !open && closeDialog()}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">
                            {dialog.target?.isActive ? '¿Dar de baja?' : '¿Dar de alta?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Va a <strong>{dialog.target?.isActive ? 'dar de baja' : 'dar de alta'}</strong> a:
                            <br />
                            <span className="font-semibold"> {dialog.target?.name}</span> (ID: {dialog.target?.id})
                            <br /><br />
                            Escribe: <strong className={dialog.target?.isActive ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
                            {requiredConfirmation}
                        </strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <Input
                        placeholder="Escribe aquí para confirmar..."
                        value={dialog.confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        disabled={isToggling}
                    />

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isToggling}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => dialog.target && toggleActiveAction({
                                personSk: dialog.target.id,
                                makeActive: !dialog.target.isActive
                            })}
                            disabled={dialog.confirmation !== requiredText || isToggling}
                        >
                            {isToggling ? 'Procesando...' : (dialog.target?.isActive ? 'Dar de baja' : 'Dar de alta')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Personnel;
