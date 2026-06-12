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
                <Loader2 className="h-12 w-12 animate-spin text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">{message}</p>
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
            <div className="text-center bg-red-50 dark:bg-red-900/20 p-8 rounded-xl">
                <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">
                    Error al cargar calificaciones
                </h2>
                <p className="text-gray-600 dark:text-gray-400">{error}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
                <p className="text-gray-500 dark:text-gray-400 text-lg">{message}</p>
            </div>
        </div>
    );
}
