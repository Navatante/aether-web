// Diálogo de ausencias: alta, vista, edición y vista/borrado de comisión.
// La lógica de estado y CRUD vive en hooks/useAbsenceDialog; el modelo
// (tipos, catálogo de motivos, helpers) en ../../absences. Cada modo es un
// componente propio en ./register-absence (un archivo por modo).

import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import {
    type Absence,
    type DialogMode,
    type NewAbsenceData,
    type Person,
    type PersonComision,
} from '../../absences';
import { useAbsenceDialog } from '../../hooks/useAbsenceDialog';
import { CreateAbsenceMode } from './register-absence/CreateAbsenceMode';
import { ViewAbsenceMode } from './register-absence/ViewAbsenceMode';
import { EditAbsenceMode } from './register-absence/EditAbsenceMode';
import { ViewComisionMode } from './register-absence/ViewComisionMode';

// Re-export para los consumidores históricos del barrel de dialogs.
export {
    absenceReasonColors,
    getReasonColor,
    type Person,
    type Absence,
    type PersonComision,
    type AbsenceReason,
    type NewAbsenceData,
    type DialogMode,
} from '../../absences';

// ==================== PROPS ====================

interface RegisterAbsenceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: DialogMode;
    /** Lista de personas (opcional - si no se pasa, se carga internamente) */
    persons?: Person[];
    // Datos iniciales para crear (desde el grid)
    initialData?: {
        personId?: number | '';
        startDate?: string;
        endDate?: string;
        reason?: string;
        remark?: string;
    };
    // Para ver/editar ausencia existente
    selectedAbsence?: Absence | null;
    selectedPerson?: Person | null;
    // Para ver/eliminar comisión
    selectedComision?: PersonComision | null;
    // Callbacks
    onCreateAbsence?: (data: NewAbsenceData) => Promise<void>;
    onUpdateAbsence?: (absence: Absence) => Promise<void>;
    onDeleteAbsence?: (absenceId: number) => Promise<void>;
    onDeleteComision?: (comisionId: number) => Promise<void>;
    // Callback para refrescar datos después de cualquier operación
    onSuccess?: () => void;
}

// ==================== COMPONENT ====================

export default function RegisterAbsenceDialog({
                                                  open,
                                                  onOpenChange,
                                                  mode: initialMode = 'create',
                                                  persons: personsProp,
                                                  initialData,
                                                  selectedAbsence,
                                                  selectedPerson,
                                                  selectedComision,
                                                  onCreateAbsence,
                                                  onUpdateAbsence,
                                                  onDeleteAbsence,
                                                  onDeleteComision,
                                                  onSuccess
                                              }: RegisterAbsenceDialogProps) {
    const {
        mode,
        isSubmitting,
        hasAdministrativePermission,
        persons,
        personsLoading,
        filteredReasons,
        formData,
        setFormData,
        editStartDate,
        setEditStartDate,
        editEndDate,
        setEditEndDate,
        editReason,
        setEditReason,
        editRemark,
        setEditRemark,
        editAbsenceSk,
        startEditing,
        cancelEditing,
        handleClose,
        handleCreate,
        handleUpdate,
        handleDeleteAbsence,
        handleDeleteComision,
    } = useAbsenceDialog({
        open,
        onOpenChange,
        initialMode,
        persons: personsProp,
        initialData,
        selectedAbsence,
        selectedComision,
        onCreateAbsence,
        onUpdateAbsence,
        onDeleteAbsence,
        onDeleteComision,
        onSuccess,
    });

    const renderContent = () => {
        // Vista de comisión
        if (selectedComision && (initialMode === 'view-comision' || mode === 'view-comision')) {
            if (!selectedPerson) return null;
            return (
                <ViewComisionMode
                    selectedComision={selectedComision}
                    selectedPerson={selectedPerson}
                    hasAdministrativePermission={hasAdministrativePermission}
                    isSubmitting={isSubmitting}
                    onClose={handleClose}
                    onDelete={handleDeleteComision}
                />
            );
        }

        // Edición de ausencia
        if (mode === 'edit' && editAbsenceSk) {
            if (!selectedPerson) return null;
            return (
                <EditAbsenceMode
                    selectedPerson={selectedPerson}
                    filteredReasons={filteredReasons}
                    editStartDate={editStartDate}
                    setEditStartDate={setEditStartDate}
                    editEndDate={editEndDate}
                    setEditEndDate={setEditEndDate}
                    editReason={editReason}
                    setEditReason={setEditReason}
                    editRemark={editRemark}
                    setEditRemark={setEditRemark}
                    isSubmitting={isSubmitting}
                    onCancel={cancelEditing}
                    onUpdate={handleUpdate}
                />
            );
        }

        // Vista de ausencia
        if (mode === 'view' && selectedAbsence) {
            if (!selectedPerson) return null;
            return (
                <ViewAbsenceMode
                    selectedAbsence={selectedAbsence}
                    selectedPerson={selectedPerson}
                    isSubmitting={isSubmitting}
                    onEdit={startEditing}
                    onDelete={handleDeleteAbsence}
                />
            );
        }

        // Por defecto: crear
        return (
            <CreateAbsenceMode
                persons={persons}
                personsLoading={personsLoading}
                filteredReasons={filteredReasons}
                formData={formData}
                setFormData={setFormData}
                isSubmitting={isSubmitting}
                onClose={handleClose}
                onCreate={handleCreate}
            />
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                {renderContent()}
            </DialogContent>
        </Dialog>
    );
}
