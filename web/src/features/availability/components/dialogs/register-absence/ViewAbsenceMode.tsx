// Modo vista de una ausencia existente (con acciones editar / eliminar).

import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
    type Absence,
    type Person,
    EMOJI_MOON,
    EMOJI_SUN,
    formatDateDisplay,
    getReasonColor,
} from '../../../absences';

interface ViewAbsenceModeProps {
    selectedAbsence: Absence;
    selectedPerson: Person;
    isSubmitting: boolean;
    onEdit: (absence: Absence) => void;
    onDelete: () => void;
}

export function ViewAbsenceMode({ selectedAbsence, selectedPerson, isSubmitting, onEdit, onDelete }: ViewAbsenceModeProps) {
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
                    onClick={() => onEdit(selectedAbsence)}
                    disabled={isSubmitting}
                    className="flex-1"
                >
                    ✏️ Editar
                </Button>
                <Button
                    variant="destructive"
                    onClick={onDelete}
                    disabled={isSubmitting}
                    className="flex-1"
                >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    🗑️ Eliminar
                </Button>
            </DialogFooter>
        </>
    );
}
