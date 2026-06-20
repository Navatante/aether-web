// Modo vista de una comisión (con borrado solo para Administrativo).

import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
    type Person,
    type PersonComision,
    formatDateDisplay,
} from '../../../absences';

interface ViewComisionModeProps {
    selectedComision: PersonComision;
    selectedPerson: Person;
    hasAdministrativePermission: boolean;
    isSubmitting: boolean;
    onClose: () => void;
    onDelete: () => void;
}

export function ViewComisionMode({
    selectedComision,
    selectedPerson,
    hasAdministrativePermission,
    isSubmitting,
    onClose,
    onDelete,
}: ViewComisionModeProps) {
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
                <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
                    Cerrar
                </Button>

                {hasAdministrativePermission && (
                    <Button
                        variant="destructive"
                        onClick={onDelete}
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
}
