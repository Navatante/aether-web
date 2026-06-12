// src/features/ratings/components/RatingButton.tsx
//
// Botón de certificación reutilizable para todas las páginas de ratings.

import React from 'react';
import { Check, Lock, X, Loader2 } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { COLOR_PALETTE, type ColorName } from '../utils/colors';

// ============================================================================
// TYPES
// ============================================================================

export interface RatingButtonProps {
    /** Si está certificado */
    isCertified: boolean;
    /** Si está deshabilitado */
    isDisabled: boolean;
    /** Si tiene permiso para editar */
    hasPermission: boolean;
    /** Nombre del color desde la paleta */
    colorName: ColorName;
    /** Contenido del tooltip */
    tooltipContent?: React.ReactNode;
    /** Estado de la certificación (muestra dot indicador) */
    state?: 'valid' | 'warning' | 'expired';
    /** Si el popover está abierto */
    popoverOpen?: boolean;
    /** Fecha seleccionada en el calendar */
    selectedDate?: Date;
    /** Callback al abrir popover */
    onPopoverOpen?: () => void;
    /** Callback al cerrar popover */
    onPopoverClose?: () => void;
    /** Callback al seleccionar fecha */
    onDateSelect?: (date: Date | undefined) => void;
    /** Callback al guardar (para añadir certificación) */
    onSave?: () => void;
    /** Callback al hacer click (para toggle/delete) */
    onClick?: () => void;
    /** Si está guardando */
    isSaving?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RatingButton({
    isCertified,
    isDisabled,
    hasPermission,
    colorName,
    tooltipContent,
    state,
    popoverOpen = false,
    selectedDate,
    onPopoverOpen,
    onPopoverClose,
    onDateSelect,
    onSave,
    onClick,
    isSaving = false,
}: RatingButtonProps) {
    const color = COLOR_PALETTE[colorName] || COLOR_PALETTE.gray;

    // Clases base del botón
    const baseClasses = 'p-3 rounded-xl transition-all transform border-2';

    // Determinar clases según estado
    const getButtonClasses = (): string => {
        if (isDisabled && !isCertified) {
            return `${baseClasses} bg-muted border-border opacity-30 cursor-not-allowed`;
        }

        if (isCertified) {
            const canInteract = hasPermission && !isDisabled;
            return `${baseClasses} ${color.bg} ${color.border} shadow-lg ${color.shadow} ${
                canInteract ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed'
            }`;
        }

        if (!hasPermission) {
            return `${baseClasses} bg-muted border-border cursor-not-allowed opacity-50`;
        }

        return `${baseClasses} bg-muted border-border hover:scale-110 cursor-pointer`;
    };

    // Determinar el icono
    const getIcon = () => {
        if (isSaving) {
            return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
        }
        if (isDisabled && !isCertified) {
            return <Lock className="w-5 h-5 text-muted-foreground opacity-30" />;
        }
        if (isCertified) {
            return <Check className={`w-5 h-5 ${color.text}`} />;
        }
        return <X className="w-5 h-5 text-muted-foreground" />;
    };

    // Si no está certificado, no está deshabilitado y tiene permiso: mostrar popover
    if (!isCertified && !isDisabled && hasPermission) {
        return (
            <Popover
                open={popoverOpen}
                onOpenChange={(open) => {
                    if (!open) onPopoverClose?.();
                }}
            >
                <PopoverTrigger asChild>
                    <button
                        onClick={onPopoverOpen}
                        className={getButtonClasses()}
                        disabled={isSaving}
                    >
                        {getIcon()}
                    </button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Fecha de calificación
                            </label>
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={onDateSelect}
                                className="rounded-md border"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onPopoverClose}
                                disabled={isSaving}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                disabled={!selectedDate || isSaving}
                                onClick={onSave}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Guardar'
                                )}
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    // Dot indicador de estado (warning/expired)
    const stateDot = isCertified && (state === 'warning' || state === 'expired') ? (
        <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
            state === 'warning' ? 'bg-warning' : 'bg-danger'
        }`} />
    ) : null;

    // Si tiene tooltip, envolver en Tooltip
    if (tooltipContent) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative inline-block">
                        <button
                            disabled={!hasPermission || isDisabled || !isCertified}
                            onClick={() => {
                                if (isCertified && hasPermission) {
                                    onClick?.();
                                }
                            }}
                            className={getButtonClasses()}
                        >
                            {getIcon()}
                        </button>
                        {stateDot}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" variant="info" className="p-4">
                    {tooltipContent}
                </TooltipContent>
            </Tooltip>
        );
    }

    // Botón simple sin tooltip
    return (
        <div className="relative inline-block">
            <button
                disabled={!hasPermission || isDisabled || !isCertified}
                onClick={() => {
                    if (isCertified && hasPermission) {
                        onClick?.();
                    }
                }}
                className={getButtonClasses()}
            >
                {getIcon()}
            </button>
            {stateDot}
        </div>
    );
}

export default RatingButton;
