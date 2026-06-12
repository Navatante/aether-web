// src/features/ratings/components/RatingDeleteDialog.tsx
//
// Diálogo de confirmación para eliminar certificaciones.

import { Loader2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { DeleteTarget, Rating } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface RatingDeleteDialogProps {
    /** Target de eliminación (null si cerrado) */
    deleteTarget: DeleteTarget | null;
    /** Callback al cerrar */
    onClose: () => void;
    /** Callback al confirmar eliminación */
    onConfirm: () => Promise<void>;
    /** Si está eliminando */
    isDeleting: boolean;
    /** Lista de ratings para mostrar nombre */
    ratings: Rating[];
    /** Mapa de nombres completos */
    personFullNameMap: Record<string, string>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RatingDeleteDialog({
    deleteTarget,
    onClose,
    onConfirm,
    isDeleting,
    ratings,
    personFullNameMap,
}: RatingDeleteDialogProps) {
    const ratingName = deleteTarget
        ? ratings.find((r) => r.crew_rating_sk === deleteTarget.ratingId)?.abbreviation
        : '';

    const personName = deleteTarget
        ? personFullNameMap[deleteTarget.personKey] || deleteTarget.personKey
        : '';

    return (
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar calificación?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {deleteTarget && (
                            <>
                                Estás a punto de eliminar la calificación{' '}
                                <strong>{ratingName}</strong> de:
                                <br />
                                <span className="text-sm text-warning">
                                    <strong>{personName}</strong>
                                </span>
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose} disabled={isDeleting}>
                        Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={async (e) => {
                            e.preventDefault();
                            await onConfirm();
                        }}
                        disabled={isDeleting}
                        className="bg-danger text-danger-foreground hover:bg-danger/90"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Eliminando...
                            </>
                        ) : (
                            'Eliminar'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default RatingDeleteDialog;
