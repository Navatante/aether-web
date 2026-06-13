// Página de Personal. La lógica vive en hooks/usePersonnel; aquí solo el render.

import React from "react";
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
import { PermissionLevel } from "@/providers";
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
import { AddEditPersonForm } from "../components";
import { usePersonnel } from "../hooks/usePersonnel";

const Personnel = () => {
    const {
        personnel,
        filteredPersonnel,
        isLoading,
        isFetching,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
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
        dialog,
        closeDialog,
        setConfirmation,
        requiredText,
        requiredConfirmation,
        openDarDeBajaOaltaDialog,
        toggleActiveAction,
        isToggling,
        formatDate,
        getRoleType,
        exportToCSV,
        handleRefresh,
        hasPermission,
    } = usePersonnel();

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="mb-8 text-center flex-shrink-0">
                    <GradientTitle>Personal</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls className="flex-shrink-0">
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
                                    {statusFilter === "active" && <div className="w-2 h-2 bg-success rounded-full" />}
                                    {statusFilter === "inactive" && <div className="w-2 h-2 bg-danger rounded-full" />}
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
                <PageTableContainer className="flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1">
                    <table className="w-full min-w-[900px]" role="table">
                        <StickyTableHeader offset="none">
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
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${person.person_active ? 'bg-success-muted text-success-muted-foreground' : 'bg-danger-muted text-danger-muted-foreground'}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${person.person_active ? 'bg-success' : 'bg-danger'}`}></span>
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
                    </div>
                </PageTableContainer>

                {/* Contador */}
                <div className="text-center text-sm text-muted-foreground flex-shrink-0 pt-4">
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
                            Escribe: <strong className={dialog.target?.isActive ? 'text-destructive' : 'text-success'}>
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
