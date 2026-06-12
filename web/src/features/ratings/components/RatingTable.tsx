// src/features/ratings/components/RatingTable.tsx
//
// Tabla principal de ratings con headers y filas.

import React from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { PageTableContainer, StickyTableHeader, TableRow } from '@/shared/components/common';
import type { Rating, CertificationData } from '../types';
import type { ColorName } from '../utils/colors';
import { COLOR_PALETTE } from '../utils/colors';

// ============================================================================
// TYPES
// ============================================================================

export interface RatingTableProps {
    /** Lista de personal filtrado */
    personnel: string[];
    /** Lista de ratings a mostrar */
    ratings: Rating[];
    /** Datos de certificaciones */
    certifications: CertificationData;
    /** Mapa de colores por rating ID */
    colorMap: Record<number, ColorName>;
    /** Mapa de nombres completos */
    personFullNameMap: Record<string, string>;
    /** Label para la columna de persona (ej: "Piloto", "Dotación") */
    personColumnLabel: string;
    /** Función para renderizar cada celda */
    renderCell: (personKey: string, rating: Rating) => React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RatingTable({
    personnel,
    ratings,
    colorMap,
    personFullNameMap,
    personColumnLabel,
    renderCell,
}: RatingTableProps) {
    return (
        <PageTableContainer>
            <table className="w-full" role="table">
                <StickyTableHeader offset="topbar">
                    <tr>
                        <th className="text-left p-4 font-semibold text-table-header-foreground">
                            {personColumnLabel}
                        </th>
                        {ratings.map((rating) => {
                            const colorName = colorMap[rating.crew_rating_sk] || 'gray';
                            const color = COLOR_PALETTE[colorName];
                            return (
                                <th
                                    key={rating.crew_rating_sk}
                                    className="text-center p-4 min-w-[120px]"
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={`${color.text} font-bold text-lg`}>
                                            {rating.abbreviation}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-normal">
                                            {rating.name}
                                        </span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </StickyTableHeader>
                <tbody>
                    {personnel.map((personKey, idx) => (
                        <TableRow
                            key={personKey}
                            index={idx}
                            className="cursor-default"
                        >
                            <td className="p-4">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="font-medium text-lg text-muted-foreground cursor-help">
                                            {personKey}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" variant="info" className="max-w-xs">
                                        <p className="text-sm font-medium">
                                            {personFullNameMap[personKey] ||
                                                'Nombre completo no disponible'}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </td>
                            {ratings.map((rating) => (
                                <td key={rating.crew_rating_sk} className="text-center p-4">
                                    {renderCell(personKey, rating)}
                                </td>
                            ))}
                        </TableRow>
                    ))}
                </tbody>
            </table>
        </PageTableContainer>
    );
}

export default RatingTable;
