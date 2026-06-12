// src/features/ratings/components/RatingStates.tsx
//
// Estados de carga y error para páginas de ratings.

import { Loader2, X } from 'lucide-react';

// ============================================================================
// LOADING STATE
// ============================================================================

export interface RatingLoadingProps {
    message?: string;
}

export function RatingLoading({ message = 'Cargando calificaciones...' }: RatingLoadingProps) {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}

// ============================================================================
// ERROR STATE
// ============================================================================

export interface RatingErrorProps {
    error: string;
    onRetry?: () => void;
}

export function RatingError({ error, onRetry }: RatingErrorProps) {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center bg-danger-muted p-8 rounded-xl">
                <X className="h-12 w-12 text-danger mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-danger-muted-foreground mb-2">
                    Error al cargar calificaciones
                </h2>
                <p className="text-muted-foreground">{error}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-4 px-4 py-2 bg-danger text-danger-foreground rounded-lg hover:bg-danger/90 transition-colors"
                    >
                        Reintentar
                    </button>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

export interface RatingEmptyProps {
    message?: string;
}

export function RatingEmpty({ message = 'No hay datos disponibles' }: RatingEmptyProps) {
    return (
        <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center">
                <p className="text-muted-foreground text-lg">{message}</p>
            </div>
        </div>
    );
}
