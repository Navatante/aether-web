// src/features/ratings/components/RatingFilters.tsx
//
// Controles de filtrado para páginas de ratings.

import { Search, RefreshCw } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ActionButton, PageControls } from '@/shared/components/common';
import type { Rating } from '../types';
import type { ColorName } from '../utils/colors';
import { COLOR_PALETTE } from '../utils/colors';

// ============================================================================
// TYPES
// ============================================================================

export interface RatingFiltersProps {
    /** Término de búsqueda actual */
    searchTerm: string;
    /** Callback al cambiar búsqueda */
    onSearchChange: (value: string) => void;
    /** Rating seleccionado (ID como string o 'Todas las calificaciones') */
    selectedRating: string;
    /** Callback al cambiar rating seleccionado */
    onRatingChange: (value: string) => void;
    /** Lista de ratings disponibles */
    ratings: Rating[];
    /** Mapa de colores por rating ID */
    colorMap: Record<number, ColorName>;
    /** Placeholder para búsqueda */
    searchPlaceholder?: string;
    /** Callback al refrescar */
    onRefresh?: () => void;
    /** Si está refrescando */
    isRefreshing?: boolean;
    /** Contenido adicional (botones extra, etc.) */
    children?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RatingFilters({
                                  searchTerm,
                                  onSearchChange,
                                  selectedRating,
                                  onRatingChange,
                                  ratings,
                                  colorMap,
                                  searchPlaceholder = 'Buscar...',
                                  onRefresh,
                                  isRefreshing = false,
                                  children,
                              }: RatingFiltersProps) {

    const currentRating = ratings.find(r => String(r.crew_rating_sk) === String(selectedRating));

    return (
        <PageControls>
            <div className="flex flex-wrap gap-4 items-center">
                {/* Campo de búsqueda */}
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                onSearchChange(e.target.value)
                            }
                            className="bg-card border-input border focus:border-ring focus:outline-none transition-all placeholder:text-muted-foreground text-foreground w-full pl-10 pr-4 py-2.5 rounded-xl"
                        />
                    </div>
                </div>

                {/* Selector de rating */}
                <Select value={selectedRating} onValueChange={(value) => onRatingChange(value ?? 'Todas las calificaciones')}>
                    <SelectTrigger className="min-w-[200px] bg-card border-input">
                        <SelectValue>
                            {currentRating ? (
                                <span className="flex items-center gap-2">
                                    <span className={`${COLOR_PALETTE[colorMap[currentRating.crew_rating_sk] || 'gray'].text} font-semibold`}>
                                        {currentRating.abbreviation}
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300">-</span>
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {currentRating.name}
                                    </span>
                                </span>
                            ) : (
                                "Todas las calificaciones"
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Todas las calificaciones">
                            Todas las calificaciones
                        </SelectItem>

                        {ratings.map((rating) => {
                            const colorName = colorMap[rating.crew_rating_sk] || 'gray';
                            const color = COLOR_PALETTE[colorName];

                            return (
                                <SelectItem
                                    key={rating.crew_rating_sk}
                                    value={String(rating.crew_rating_sk)}
                                >
                                    {/* Es exactamente la misma estructura que pusimos arriba */}
                                    <span className="flex items-center gap-2">
                                        <span className={`${color.text} font-semibold`}>
                                            {rating.abbreviation}
                                        </span>
                                        <span className="text-gray-700 dark:text-gray-300">-</span>
                                        <span className="text-gray-700 dark:text-gray-300">
                                            {rating.name}
                                        </span>
                                    </span>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>

                {/* Botón de refrescar */}
                {onRefresh && (
                    <div className="flex gap-3 items-center">
                        <ActionButton
                            variant="refresh"
                            icon={RefreshCw}
                            label="Refrescar"
                            onClick={(e) => {
                                onRefresh();
                                const icon = e.currentTarget.querySelector('svg');
                                if (icon) {
                                    icon.classList.remove('animate-spin-once');
                                    requestAnimationFrame(() => {
                                        icon.classList.add('animate-spin-once');
                                    });
                                }
                            }}
                            disabled={isRefreshing}
                            loading={isRefreshing}
                        />
                    </div>
                )}

                {/* Contenido adicional */}
                {children}
            </div>
        </PageControls>
    );
}

export default RatingFilters;