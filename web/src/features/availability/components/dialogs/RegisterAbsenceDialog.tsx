import {useEffect, useState} from 'react';
import {useLogger} from '@/lib/logger';
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
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Calendar} from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {CalendarIcon, Loader2} from "lucide-react";
import {toast} from "sonner";
import {PermissionLevel, useHasPermission} from "@/providers";
import {http} from "@/lib/http";
import {format} from "date-fns";
import {es} from "date-fns/locale";
import {cn} from "@/lib/utils";
import {usePersonsLookup} from "@/shared/hooks";

// ==================== TAURI TYPES ====================

interface AbsenceFormData {
    person_fk: number;
    start_date: string;
    end_date: string;
    absence_reason: string;
    remark?: string;
}

interface AbsenceUpdateData {
    start_date: string;
    end_date: string;
    absence_reason: string;
    remark?: string;
}

interface AbsenceInsertResult {
    absence_sk: number;
    success: boolean;
    message: string;
}

// ==================== TYPES ====================

export interface Person {
    person_sk: number;
    full_name: string;
    person_rol: string;
    escala: string;
}

export interface Absence {
    absence_sk: number;
    absence_start_date: string;
    absence_end_date: string;
    absence_dias: number;
    absence_person_fk: number;
    absence_reason: string;
    absence_remark: string | null;
}

export interface PersonComision {
    person_comision_sk: number;
    person_fk: number;
    comision_start_date: string;
    comision_end_date: string;
    comision_dias: number;
    comision_lugar: string;
}

export interface AbsenceReason {
    label: string;
    color: string;
}

export interface NewAbsenceData {
    personId: number | '';
    startDate: Date | undefined;
    endDate: Date | undefined;
    reason: string;
    remark?: string;
}

export type DialogMode = 'create' | 'view' | 'edit' | 'view-comision';

// ==================== CONSTANTS ====================

export const absenceReasonColors: Record<string, AbsenceReason> = {
    'Permiso': { label: 'Permiso', color: 'oklch(0.568 0.111 146.545)' },
    'Asuntos propios': { label: 'Asuntos propios', color: 'oklch(0.566 0.057 163.845)' },
    'Dia adicional': { label: 'Dia adicional', color: 'oklch(0.743 0.084 164.484)' },
    'Baja médica': { label: 'Baja médica', color: 'oklch(0.623 0.127 18.979)' },
    'Guardia': { label: 'Guardia', color: 'oklch(0.785 0.139 96.303)' },
    'Saliente': { label: 'Saliente', color: 'oklch(0.87 0.116 105.302)' },
    'Curso': { label: 'Curso', color: 'oklch(0.709 0.107 65.486)' },
    'Reconocimiento médico': { label: 'Reconocimiento médico', color: 'oklch(0.91 0 89.876)' },
    'Dunker': { label: 'Dunker', color: 'oklch(0.727 0.092 213.697)' },
    'Vuelo día': { label: 'Vuelo día', color: '' },
    'Vuelo noche': { label: 'Vuelo noche', color: '' },
    'Otro': { label: 'Otro', color: 'oklch(0.55 0.02 265)' },
};

const defaultReasonColor: AbsenceReason = { label: 'Otro', color: '#6B7280' };

const EMOJI_SUN = '☀️';
const EMOJI_MOON = '🌑';

export const getReasonColor = (reason: string): AbsenceReason => {
    return absenceReasonColors[reason] || { ...defaultReasonColor, label: reason };
};

const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
};

// Helper para parsear string de fecha a Date
const parseDate = (dateStr: string | undefined): Date | undefined => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
};

// ==================== DATE PICKER COMPONENT ====================

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
            <PopoverTrigger asChild>
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
            </PopoverTrigger>
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
    const log = useLogger('RegisterAbsenceDialog');
    const [mode, setMode] = useState<DialogMode>(initialMode);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasAdministrativePermission = useHasPermission(PermissionLevel.ADMINISTRATIVO);
    const hasOperationalPermission = useHasPermission(PermissionLevel.OPERACIONAL);

    // Hook para cargar personas si no se pasan como prop
    const { data: personsFromLookup, loading: personsLoading } = usePersonsLookup();

    // Usar personas del prop si existe, sino usar las del hook
    const persons = (() => {
        if (personsProp && personsProp.length > 0) {
            return personsProp;
        }
        // Mapear PersonLookup a Person (solo necesitamos person_sk y full_name)
        return personsFromLookup.map(p => ({
            person_sk: p.person_sk,
            full_name: p.full_name,
            person_rol: '',
            escala: ''
        }));
    })();

    // Aqui restrinjo que algunos motivos solo los pueda asignar el Detall y otros solo Operaciones.
    const filteredReasons = Object.entries(absenceReasonColors).filter(([key]) => {
        const adminOnlyReasons = ['Permiso', 'Asuntos propios', 'Dia adicional', 'Baja médica', 'Curso', 'Reconocimiento médico', 'Dunker'];
        const operationalOnlyReasons = ['Vuelo día', 'Vuelo noche', 'Guardia', 'Saliente'];

        if (adminOnlyReasons.includes(key)) {
            return hasAdministrativePermission;
        }
        if (operationalOnlyReasons.includes(key)) {
            return hasOperationalPermission;
        }
        return true;
    });

    // Estado para nueva ausencia
    const [formData, setFormData] = useState<NewAbsenceData>({
        personId: '',
        startDate: undefined,
        endDate: undefined,
        reason: 'Permiso',
        remark: ''
    });

    // Estado para editar ausencia
    const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
    const [editEndDate, setEditEndDate] = useState<Date | undefined>(undefined);
    const [editReason, setEditReason] = useState<string>('');
    const [editRemark, setEditRemark] = useState<string>('');
    const [editAbsenceSk, setEditAbsenceSk] = useState<number | null>(null);

    // Reset cuando cambian las props o se abre/cierra
    useEffect(() => {
        if (open) {
            setMode(initialMode);

            if (initialMode === 'create') {
                setFormData({
                    personId: initialData?.personId ?? '',
                    startDate: parseDate(initialData?.startDate),
                    endDate: parseDate(initialData?.endDate),
                    reason: initialData?.reason ?? 'Permiso',
                    remark: ''
                });
                // Reset edit state
                setEditStartDate(undefined);
                setEditEndDate(undefined);
                setEditReason('');
                setEditRemark('');
                setEditAbsenceSk(null);
            } else if (initialMode === 'view' && selectedAbsence) {
                // Reset edit state
                setEditStartDate(undefined);
                setEditEndDate(undefined);
                setEditReason('');
                setEditRemark('');
                setEditAbsenceSk(null);
            } else if (initialMode === 'edit' && selectedAbsence) {
                setEditStartDate(parseDate(selectedAbsence.absence_start_date));
                setEditEndDate(parseDate(selectedAbsence.absence_end_date));
                setEditReason(selectedAbsence.absence_reason);
                setEditRemark(selectedAbsence.absence_remark || '');
                setEditAbsenceSk(selectedAbsence.absence_sk);
            }
        }
    }, [open, initialMode, initialData, selectedAbsence]);

    const handleClose = () => {
        onOpenChange(false);
    };

    const handleCreate = async () => {
        if (!formData.personId || !formData.startDate || !formData.endDate) return;

        setIsSubmitting(true);
        try {
            const absenceData: AbsenceFormData = {
                person_fk: formData.personId as number,
                start_date: format(formData.startDate, 'yyyy-MM-dd'),
                end_date: format(formData.endDate, 'yyyy-MM-dd'),
                absence_reason: formData.reason,
                remark: formData.remark || undefined,
            };

            const result = await http<AbsenceInsertResult>('POST', '/absences', { body: absenceData });

            log.info(`Ausencia creada: ${JSON.stringify(result)}`);
            toast.success('Ausencia creada correctamente.');

            // También llamar al callback si existe (para compatibilidad)
            await onCreateAbsence?.(formData);
            onSuccess?.();
            handleClose();
        } catch (error) {
            log.error(`Error creating absence: ${error}`);
            const errorMessage = typeof error === 'string' ? error : 'Error al crear la ausencia';
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editAbsenceSk || !editStartDate || !editEndDate) return;

        setIsSubmitting(true);
        try {
            const updateData: AbsenceUpdateData = {
                start_date: format(editStartDate, 'yyyy-MM-dd'),
                end_date: format(editEndDate, 'yyyy-MM-dd'),
                absence_reason: editReason,
                remark: editRemark || undefined,
            };

            await http<void>('PUT', `/absences/${editAbsenceSk}`, { body: updateData });

            log.info(`Ausencia actualizada: id ${editAbsenceSk}`);
            toast.success('Ausencia actualizada correctamente.');

            // Construir objeto Absence para el callback
            if (selectedAbsence) {
                const updatedAbsence: Absence = {
                    ...selectedAbsence,
                    absence_start_date: format(editStartDate, 'yyyy-MM-dd'),
                    absence_end_date: format(editEndDate, 'yyyy-MM-dd'),
                    absence_reason: editReason,
                    absence_remark: editRemark || null,
                };
                await onUpdateAbsence?.(updatedAbsence);
            }
            onSuccess?.();
            handleClose();
        } catch (error) {
            log.error(`Error updating absence: ${error}`);
            const errorMessage = typeof error === 'string' ? error : 'Error al actualizar la ausencia';
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAbsence = async () => {
        if (!selectedAbsence) return;

        setIsSubmitting(true);
        try {
            await http<void>('DELETE', `/absences/${selectedAbsence.absence_sk}`);

            log.info(`Ausencia eliminada: id ${selectedAbsence.absence_sk}`);
            toast.success('Ausencia eliminada correctamente.');

            await onDeleteAbsence?.(selectedAbsence.absence_sk);
            onSuccess?.();
            handleClose();
        } catch (error) {
            log.error(`Error deleting absence: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteComision = async () => {
        if (!selectedComision) return;

        setIsSubmitting(true);
        try {
            await http<void>('DELETE', `/person-comisiones/${selectedComision.person_comision_sk}`);

            log.info(`Person comision eliminada: id ${selectedComision.person_comision_sk}`);
            toast.success('Comision eliminada correctamente.')

            await onDeleteComision?.(selectedComision.person_comision_sk);
            onSuccess?.();
            handleClose();
        } catch (error) {
            log.error(`Error deleting comision: ${error}`);
        } finally {
            setIsSubmitting(false);
        }
    };

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
                        placeholder={personsLoading && !personsProp ? "Cargando personas..." : "Seleccionar persona..."}
                        isLoading={personsLoading && !personsProp}
                        isDisabled={personsLoading && !personsProp}
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
                        onClick={() => {
                            setEditStartDate(parseDate(selectedAbsence.absence_start_date));
                            setEditEndDate(parseDate(selectedAbsence.absence_end_date));
                            setEditReason(selectedAbsence.absence_reason);
                            setEditRemark(selectedAbsence.absence_remark || '');
                            setEditAbsenceSk(selectedAbsence.absence_sk);
                            setMode('edit');
                        }}
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
                        onClick={() => {
                            setEditStartDate(undefined);
                            setEditEndDate(undefined);
                            setEditReason('');
                            setEditRemark('');
                            setEditAbsenceSk(null);
                            setMode('view');
                        }}
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
                            style={{ backgroundColor: 'rgba(79,164,200,0.76)' }}
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