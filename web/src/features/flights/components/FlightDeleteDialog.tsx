// Diálogo de confirmación para eliminar un vuelo (incluye el botón disparador).
// El usuario debe escribir `eliminarvuelo<id>` para habilitar el borrado.

import { RefreshCw, Trash2 } from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

/** Controles del borrado, compartidos por la página, el panel y el diálogo. */
export interface FlightDeleteControls {
    /** Vuelo actualmente apuntado para borrar (lo fija `onOpenDialog`). */
    flightToDelete: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenDialog: (flightId: number) => void;
    confirmationText: string;
    onConfirmationChange: (text: string) => void;
    onConfirm: (flightId: number) => void;
    isDeleting: boolean;
}

interface FlightDeleteDialogProps extends FlightDeleteControls {
    /** Id del vuelo de la fila que muestra el botón "Eliminar". */
    rowFlightId: number;
}

export function FlightDeleteDialog({
    rowFlightId,
    flightToDelete,
    open,
    onOpenChange,
    onOpenDialog,
    confirmationText,
    onConfirmationChange,
    onConfirm,
    isDeleting,
}: FlightDeleteDialogProps) {
    const expectedText = `eliminarvuelo${flightToDelete}`;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogTrigger render={
                <button onClick={() => onOpenDialog(rowFlightId)} className="ml-auto pb-2 px-4 text-danger hover:text-danger/80 transition-all text-xs">
                    <Trash2 className="pb-1 w-4 h-4 inline mr-1" />Eliminar
                </button>
            } />
            <AlertDialogContent>
                <form action={() => {
                    if (flightToDelete && confirmationText === expectedText) {
                        onConfirm(flightToDelete);
                    }
                }}>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">
                            ¿Estás absolutamente seguro?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Eliminará permanentemente el vuelo{' '}
                            <span className="font-semibold text-foreground">ID: {flightToDelete}</span>.
                            <br /><br />
                            Escribe: <strong className="text-danger">eliminarvuelo{flightToDelete}</strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        placeholder="Escribe aquí..."
                        value={confirmationText}
                        onChange={(e) => onConfirmationChange(e.target.value)}
                        className="mt-4"
                        disabled={isDeleting}
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="submit"
                            disabled={confirmationText !== expectedText || isDeleting}
                            className="bg-danger hover:bg-danger/90 text-danger-foreground"
                        >
                            {isDeleting ? (
                                <span className="flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Eliminando...
                                </span>
                            ) : 'Continuar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
