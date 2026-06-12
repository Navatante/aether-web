// Tooltip de requisitos y métricas por calificación general/táctica.
// Los umbrales (horas/tomas por ventana de días) están inline por ratingId.

import React from 'react';
import { Info } from 'lucide-react';
import type { CertificationStatus } from '../types';

interface MetricRowProps {
    icon: string;
    label: string;
    value: string;
    status?: 'valid' | 'warning' | 'expired';
}

function MetricRow({ icon, label, value, status }: MetricRowProps) {
    const statusColors = {
        valid: 'text-green-500',
        warning: 'text-yellow-500',
        expired: 'text-red-500'
    };

    return (
        <div className="flex items-start gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{icon}</span>
            <div className="flex-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}:</span>
                <span className={`text-sm ml-2 font-semibold ${status ? statusColors[status] : 'text-gray-700 dark:text-gray-300'}`}>
                    {value}
                </span>
            </div>
        </div>
    );
}

interface RequirementSectionProps {
    title: string;
    requirements: React.ReactNode[];
}

function RequirementSection({ title, requirements }: RequirementSectionProps) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <Info className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {title}
                </span>
            </div>
            {requirements.map((req, idx) => (
                <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 pl-5 border-l-2 border-gray-300 dark:border-gray-600 flex items-center gap-2">
                    {req}
                </div>
            ))}
        </div>
    );
}

interface GeneralTacticalTooltipProps {
    cert: CertificationStatus;
    ratingId: number;
    isPilot: boolean;
}

export function GeneralTacticalTooltip({ cert, ratingId, isPilot }: GeneralTacticalTooltipProps) {
    return (
        <div className="space-y-4 max-w-md">
            {/* Fecha de calificación */}
            {cert?.date_qualified && (
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <div className="flex-1">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha de obtención:</span>
                            <span className="text-xs ml-2 text-gray-700 dark:text-gray-300">
                                {new Date(cert.date_qualified).toLocaleDateString('es-ES')}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* VFR-D (12) */}
            {ratingId === 12 && cert?.total_horas_VFR_diurno_365 !== undefined && (
                <>
                    <div className="space-y-2">
                        <MetricRow
                            icon="☀️"
                            label="Horas VFR Diurno (365 días)"
                            value={`${cert.total_horas_VFR_diurno_365.toFixed(1)}h`}
                            status={
                                cert.total_horas_VFR_diurno_365 >= 55 ? 'valid' :
                                cert.total_horas_VFR_diurno_365 >= 50 ? 'warning' : 'expired'
                            }
                        />
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <RequirementSection
                            title="Requisitos"
                            requirements={[
                                <>Horas en los últimos 365 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥55h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />50-54.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;50h</>
                            ]}
                        />
                    </div>
                </>
            )}

            {/* VFR-N (13) */}
            {ratingId === 13 && cert?.total_horas_VFR_nocturno_365 !== undefined && (
                <>
                    <div className="space-y-2">
                        <MetricRow
                            icon="🌙"
                            label="Horas VFR Nocturno (365 días)"
                            value={`${cert.total_horas_VFR_nocturno_365.toFixed(1)}h`}
                            status={
                                cert.total_horas_VFR_nocturno_365 >= 17 ? 'valid' :
                                cert.total_horas_VFR_nocturno_365 >= 12 ? 'warning' : 'expired'
                            }
                        />
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <RequirementSection
                            title="Requisitos"
                            requirements={[
                                <>Horas Noche conv./GVN en los últimos 365 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥17h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />12-16.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;12h</>
                            ]}
                        />
                    </div>
                </>
            )}

            {/* GVN (14) */}
            {ratingId === 14 && cert?.total_horas_GVN_90 !== undefined && (
                <>
                    <div className="space-y-2">
                        <MetricRow
                            icon="🥽"
                            label="Horas GVN (90 días)"
                            value={`${cert.total_horas_GVN_90.toFixed(1)}h`}
                            status={
                                cert.total_horas_GVN_90 >= (isPilot ? 8 : 7) ? 'valid' :
                                cert.total_horas_GVN_90 >= (isPilot ? 3 : 2) ? 'warning' : 'expired'
                            }
                        />
                        {isPilot && cert?.total_horas_GVN_365 !== undefined && (
                            <MetricRow
                                icon="🥽"
                                label="Horas GVN (365 días)"
                                value={`${cert.total_horas_GVN_365.toFixed(1)}h`}
                                status={
                                    cert.total_horas_GVN_365 >= 17 ? 'valid' :
                                    cert.total_horas_GVN_365 >= 12 ? 'warning' : 'expired'
                                }
                            />
                        )}
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <RequirementSection
                            title="Requisitos"
                            requirements={isPilot ? [
                                <>Horas GVN en los últimos 90 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥8h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />3-7.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;3h</>,
                                <>Horas GVN en los últimos 365 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥17h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />12-16.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;12h</>
                            ] : [
                                <>Horas GVN en los últimos 90 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥7h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />2-6.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;2h</>
                            ]}
                        />
                    </div>
                </>
            )}

            {/* IFR (15) */}
            {ratingId === 15 && (
                <>
                    <div className="space-y-2">
                        {cert?.total_horas_IFR_365 !== undefined && (
                            <MetricRow
                                icon="☁️"
                                label="Horas IFR (365 días)"
                                value={`${cert.total_horas_IFR_365.toFixed(1)}h`}
                                status={
                                    cert.total_horas_IFR_365 >= 17 ? 'valid' :
                                    cert.total_horas_IFR_365 >= 12 ? 'warning' : 'expired'
                                }
                            />
                        )}
                        {cert?.total_app_precision_365 !== undefined && (
                            <MetricRow
                                icon="🎯"
                                label="Aproximaciones precisión"
                                value={`${cert.total_app_precision_365}`}
                                status={
                                    cert.total_app_precision_365 >= 11 ? 'valid' :
                                    cert.total_app_precision_365 >= 6 ? 'warning' : 'expired'
                                }
                            />
                        )}
                        {cert?.total_app_no_precision_365 !== undefined && (
                            <MetricRow
                                icon="📍"
                                label="Aproximaciones no-precisión"
                                value={`${cert.total_app_no_precision_365}`}
                                status={
                                    cert.total_app_no_precision_365 >= 11 ? 'valid' :
                                    cert.total_app_no_precision_365 >= 6 ? 'warning' : 'expired'
                                }
                            />
                        )}
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <RequirementSection
                            title="Requisitos"
                            requirements={[
                                <>Horas IFR en los últimos 365 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥17h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />12-16.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;12h</>,
                                <>Aproximaciones IFR en los últimos 365 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥11 aprox.</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />6-10 aprox.</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;6 aprox.</>
                            ]}
                        />
                    </div>
                </>
            )}

            {/* Aeronaval (16) */}
            {ratingId === 16 && (
                <>
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <span className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">⚓</span>
                            <div className="flex-1">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-2">
                                    Tomas en buque (Últimos 182 días):
                                </span>
                                <div className="space-y-1 pl-2">
                                    {cert?.total_tomas_dia_buque_182 !== undefined && (
                                        <div className="text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">Día:</span>
                                            <span className="text-sm ml-2 font-semibold text-gray-700 dark:text-gray-300">
                                                {cert.total_tomas_dia_buque_182}
                                            </span>
                                        </div>
                                    )}
                                    {cert?.total_tomas_nocheConv_buque_182 !== undefined && (
                                        <div className="text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">Noche:</span>
                                            <span className="text-sm ml-2 font-semibold text-gray-700 dark:text-gray-300">
                                                {cert.total_tomas_nocheConv_buque_182}
                                            </span>
                                        </div>
                                    )}
                                    {cert?.total_tomas_GVN_buque_182 !== undefined && (
                                        <div className="text-xs">
                                            <span className="text-gray-600 dark:text-gray-400">GVN:</span>
                                            <span className="text-sm ml-2 font-semibold text-gray-700 dark:text-gray-300">
                                                {cert.total_tomas_GVN_buque_182}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <RequirementSection
                            title="Requisitos"
                            requirements={isPilot ? [
                                <>Tomas en buque en los últimos 182 días</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥9</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />4-8</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;4</>
                            ] : [
                                <>TBD</>
                            ]}
                        />
                    </div>
                </>
            )}

            {/* Anfibia (17) */}
            {ratingId === 17 && cert?.total_horas_GVN_90 !== undefined && cert?.total_horas_GVN_365 !== undefined && (
                <>
                    <div className="space-y-2">
                        <MetricRow
                            icon="🥽"
                            label="Horas GVN (90 días)"
                            value={`${cert.total_horas_GVN_90.toFixed(1)}h`}
                            status={
                                cert.total_horas_GVN_90 >= 11 ? 'valid' :
                                cert.total_horas_GVN_90 >= 6 ? 'warning' : 'expired'
                            }
                        />
                        <MetricRow
                            icon="🥽"
                            label="Horas GVN (365 días)"
                            value={`${cert.total_horas_GVN_365.toFixed(1)}h`}
                            status={
                                cert.total_horas_GVN_365 >= 29 ? 'valid' :
                                cert.total_horas_GVN_365 >= 24 ? 'warning' : 'expired'
                            }
                        />
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <RequirementSection
                            title="Requisitos"
                            requirements={[
                                <>Horas GVN en los últimos 90 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥11h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />6-10.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;6h</>,
                                <>Horas GVN en los últimos 365 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥29h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />24-28.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;24h</>
                            ]}
                        />
                    </div>
                </>
            )}

            {/* Operaciones especiales (18) */}
            {ratingId === 18 && cert?.total_horas_GVN_90 !== undefined && cert?.total_horas_GVN_365 !== undefined && (
                <>
                    <div className="space-y-2">
                        <MetricRow
                            icon="🥽"
                            label="Horas GVN (90 días)"
                            value={`${cert.total_horas_GVN_90.toFixed(1)}h`}
                            status={
                                cert.total_horas_GVN_90 >= 14 ? 'valid' :
                                cert.total_horas_GVN_90 >= 9 ? 'warning' : 'expired'
                            }
                        />
                        <MetricRow
                            icon="🥽"
                            label="Horas GVN (365 días)"
                            value={`${cert.total_horas_GVN_365.toFixed(1)}h`}
                            status={
                                cert.total_horas_GVN_365 >= 41 ? 'valid' :
                                cert.total_horas_GVN_365 >= 36 ? 'warning' : 'expired'
                            }
                        />
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <RequirementSection
                            title="Requisitos"
                            requirements={[
                                <>Horas GVN en los últimos 90 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥14h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />9-13.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;9h</>,
                                <>Horas GVN en los últimos 365 días:</>,
                                <><div className="w-2 h-2 rounded-full bg-green-500" />≥41h</>,
                                <><div className="w-2 h-2 rounded-full bg-yellow-500" />36-40.9h</>,
                                <><div className="w-2 h-2 rounded-full bg-red-500" />&lt;36h</>
                            ]}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
