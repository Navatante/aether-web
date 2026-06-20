// Diálogo de ausencias: alta, vista, edición y vista/borrado de comisión.
// La lógica de estado y CRUD vive en hooks/useAbsenceDialog; el modelo
// (tipos, catálogo de motivos, helpers) en ../../absences.

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Select from "react-select";
import { getSelectClassNames, menuPortalStyles } from "@/lib/reactSelectClassNames";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
    type Absence,
    type AbsenceReason,
    type DialogMode,
    type NewAbsenceData,
    type Person,
    type PersonComision,
    EMOJI_MOON,
    EMOJI_SUN,
    formatDateDisplay,
    getReasonColor,
} from '../../absences';
import { useAbsenceDialog } from '../../hooks/useAbsenceDialog';

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

// ==================== DATE PICKER ====================
// (API por Date; el DatePicker compartido de shared/ trabaja con strings.)

interface DatePickerProps {
    date: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    placeholder?: string;
}

function DatePicker({ date, onSelect, placeholder = "Seleccionar fecha" }: DatePickerProps) {
    const [open, setOpen] = useState(false);

    const handleSelect = (selectedDate: Date | undefined) => {
        onSelect(selectedDate);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? (
                        format(date, "dd/MM/yyyy", { locale: es })
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            } />
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelect}
                    defaultMonth={date || new Date()}
                    captionLayout="dropdown"
                    startMonth={new Date(new Date().getFullYear() - 10, 0)}
                    endMonth={new Date(new Date().getFullYear() + 10, 11)}
                    locale={es}
                    className="rounded-md border"
                />
            </PopoverContent>
        </Popover>
    );
}

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

    // ==================== RENDER HELPERS ====================

    const renderReasonButton = (key: string, value: AbsenceReason, isSelected: boolean, onClick: () => void) => {
        const isVueloDia = key === 'Vuelo día';
        const isVueloNoche = key === 'Vuelo noche';

        return (
            <button
                key={key}
                type="button"
                onClick={onClick}
                className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                    isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-muted-foreground/50'
                }`}
            >
                {isVueloDia ? (
                    <span className="text-base">{EMOJI_SUN}</span>
                ) : isVueloNoche ? (
                    <span className="text-base">{EMOJI_MOON}</span>
                ) : (
                    <div
                        className="w-3 h-3 rounded flex-shrink-0"
                        style={{ backgroundColor: value.color }}
                    />
                )}
                <span className="text-sm">{value.label}</span>
            </button>
        );
    };

    // ==================== CREATE MODE ====================

    const renderCreateMode = () => (
        <>
            <DialogHeader>
                <DialogTitle>Registrar Ausencia</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
                {/* Persona */}
                <div className="grid gap-2">
                    <Label htmlFor="person">Persona</Label>
                    <Select
                        inputId="person"
                        value={persons.find(p => p.person_sk === formData.personId)
                            ? { value: formData.personId as number, label: persons.find(p => p.person_sk === formData.personId)!.full_name }
                            : null}
                        onChange={(opt) => setFormData({ ...formData, personId: opt?.value ?? '' })}
                        options={persons.map(p => ({ value: p.person_sk, label: p.full_name }))}
                        placeholder={personsLoading ? "Cargando personas..." : "Seleccionar persona..."}
                        isLoading={personsLoading}
                        isDisabled={personsLoading}
                        isSearchable={true}
                        classNames={getSelectClassNames(false, !!formData.personId)}
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={menuPortalStyles}
                    />
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Fecha inicio</Label>
                        <DatePicker
                            date={formData.startDate}
                            onSelect={(date) => setFormData({ ...formData, startDate: date })}
                            placeholder="Inicio"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Fecha fin</Label>
                        <DatePicker
                            date={formData.endDate}
                            onSelect={(date) => setFormData({ ...formData, endDate: date })}
                            placeholder="Fin"
                        />
                    </div>
                </div>

                {/* Motivo */}
                <div className="grid gap-2">
                    <Label>Motivo</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {filteredReasons.map(([key, value]) =>
                            renderReasonButton(
                                key,
                                value,
                                formData.reason === key,
                                () => setFormData({ ...formData, reason: key })
                            )
                        )}
                    </div>
                </div>

                {/* Observaciones */}
                <div className="grid gap-2">
                    <Label htmlFor="remark">Observaciones (opcional)</Label>
                    <Input
                        id="remark"
                        placeholder="Añadir observaciones..."
                        value={formData.remark || ''}
                        onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleCreate}
                    disabled={isSubmitting || !formData.personId || !formData.startDate || !formData.endDate}
                >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar ausencia
                </Button>
            </DialogFooter>
        </>
    );

    // ==================== VIEW ABSENCE MODE ====================

    const renderViewAbsenceMode = () => {
        if (!selectedAbsence || !selectedPerson) return null;

        const reasonData = getReasonColor(selectedAbsence.absence_reason);
        const isVueloDia = selectedAbsence.absence_reason === 'Vuelo día';
        const isVueloNoche = selectedAbsence.absence_reason === 'Vuelo noche';

        return (
            <>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        {isVueloDia ? (
                            <span className="text-base">{EMOJI_SUN}</span>
                        ) : isVueloNoche ? (
                            <span className="text-base">{EMOJI_MOON}</span>
                        ) : (
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: reasonData.color }}
                            />
                        )}
                        <div>
                            <DialogTitle>{selectedPerson.full_name}</DialogTitle>
                            <DialogDescription>{reasonData.label}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Desde</span>
                        <span className="text-sm font-medium capitalize">
                            {formatDateDisplay(selectedAbsence.absence_start_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Hasta</span>
                        <span className="text-sm font-medium capitalize">
                            {formatDateDisplay(selectedAbsence.absence_end_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Duración</span>
                        <span className="text-sm font-medium">
                            {selectedAbsence.absence_dias} días
                        </span>
                    </div>
                    {selectedAbsence.absence_remark && (
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-muted-foreground">Observaciones</span>
                            <span className="text-sm font-medium">
                                {selectedAbsence.absence_remark}
                            </span>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => startEditing(selectedAbsence)}
                        disabled={isSubmitting}
                        className="flex-1"
                    >
                        ✏️ Editar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDeleteAbsence}
                        disabled={isSubmitting}
                        className="flex-1"
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        🗑️ Eliminar
                    </Button>
                </DialogFooter>
            </>
        );
    };

    // ==================== EDIT ABSENCE MODE ====================

    const renderEditAbsenceMode = () => {
        if (!editAbsenceSk || !selectedPerson) return null;

        const reasonData = getReasonColor(editReason);
        const isVueloDia = editReason === 'Vuelo día';
        const isVueloNoche = editReason === 'Vuelo noche';

        return (
            <>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        {isVueloDia ? (
                            <span className="text-base">{EMOJI_SUN}</span>
                        ) : isVueloNoche ? (
                            <span className="text-base">{EMOJI_MOON}</span>
                        ) : (
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: reasonData.color }}
                            />
                        )}
                        <div>
                            <DialogTitle>{selectedPerson.full_name}</DialogTitle>
                            <DialogDescription>Editando ausencia</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Fecha inicio</Label>
                            <DatePicker
                                date={editStartDate}
                                onSelect={setEditStartDate}
                                placeholder="Inicio"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Fecha fin</Label>
                            <DatePicker
                                date={editEndDate}
                                onSelect={setEditEndDate}
                                placeholder="Fin"
                            />
                        </div>
                    </div>

                    {/* Motivo */}
                    <div className="grid gap-2">
                        <Label>Motivo</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {filteredReasons.map(([key, value]) =>
                                renderReasonButton(
                                    key,
                                    value,
                                    editReason === key,
                                    () => setEditReason(key)
                                )
                            )}
                        </div>
                    </div>

                    {/* Observaciones */}
                    <div className="grid gap-2">
                        <Label htmlFor="editRemark">Observaciones (opcional)</Label>
                        <Input
                            id="editRemark"
                            value={editRemark}
                            onChange={(e) => setEditRemark(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={cancelEditing}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleUpdate} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar cambios
                    </Button>
                </DialogFooter>
            </>
        );
    };

    // ==================== VIEW COMISION MODE ====================

    const renderViewComisionMode = () => {
        if (!selectedComision || !selectedPerson) return null;

        return (
            <>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: 'var(--comision)' }}
                        >
                            📍
                        </div>
                        <div>
                            <DialogTitle>{selectedPerson.full_name}</DialogTitle>
                            <DialogDescription>
                                Comisión - {selectedComision.comision_lugar}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Lugar</span>
                        <span className="text-sm font-medium">
                            {selectedComision.comision_lugar}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Desde</span>
                        <span className="text-sm font-medium capitalize">
                            {formatDateDisplay(selectedComision.comision_start_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">Hasta</span>
                        <span className="text-sm font-medium capitalize">
                            {formatDateDisplay(selectedComision.comision_end_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Duración</span>
                        <span className="text-sm font-medium">
                            {selectedComision.comision_dias} días
                        </span>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={isSubmitting} className="flex-1">
                        Cerrar
                    </Button>

                    {hasAdministrativePermission && (
                        <Button
                            variant="destructive"
                            onClick={handleDeleteComision}
                            disabled={isSubmitting}
                            className="flex-1"
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            🗑️ Eliminar
                        </Button>
                    )}

                </DialogFooter>
            </>
        );
    };

    // ==================== RENDER ====================

    const renderContent = () => {
        // Si hay comisión seleccionada y estamos en modo view-comision
        if (selectedComision && (initialMode === 'view-comision' || mode === 'view-comision')) {
            return renderViewComisionMode();
        }

        // Modo edición
        if (mode === 'edit' && editAbsenceSk) {
            return renderEditAbsenceMode();
        }

        // Modo vista de ausencia
        if (mode === 'view' && selectedAbsence) {
            return renderViewAbsenceMode();
        }

        // Por defecto: crear
        return renderCreateMode();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                {renderContent()}
            </DialogContent>
        </Dialog>
    );
}
