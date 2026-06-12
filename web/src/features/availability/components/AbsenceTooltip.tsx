import React from 'react';
import { Calendar, User, MapPin, MessageSquare } from 'lucide-react';
import { type Absence, type PersonComision, type Person, getReasonColor } from "@/features/availability";

interface EventTooltipProps {
    person: Person;
    absence?: Absence;
    comision?: PersonComision;
}

const EMOJI_SUN = '☀️';
const EMOJI_MOON = '🌑';

const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
};

const InfoRow = ({
                     icon: Icon,
                     label,
                     children,
                     iconColor = 'text-neutral-500'
                 }: {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    iconColor?: string;
}) => (
    <div className="space-y-1">
        <div className="flex items-center gap-2">
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {label}
            </span>
        </div>
        <div className="pl-5 border-l-2 border-gray-200 dark:border-gray-700">
            {children}
        </div>
    </div>
);

export const AbsenceTooltip: React.FC<EventTooltipProps> = ({
                                                              person,
                                                              absence,
                                                              comision
                                                          }) => {
    const isComision = !!comision;
    const isAbsence = !!absence;

    if (!isComision && !isAbsence) return null;

    const startDate = isComision ? comision.comision_start_date : absence!.absence_start_date;
    const endDate = isComision ? comision.comision_end_date : absence!.absence_end_date;

    const isVueloDia = absence?.absence_reason === 'Vuelo día';
    const isVueloNoche = absence?.absence_reason === 'Vuelo noche';
    const reasonData = isAbsence ? getReasonColor(absence!.absence_reason) : null;

    return (
        <div className="space-y-3 max-w-xs min-w-[260px]">
            {/* Header con tipo de evento */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                {isComision ? (
                    <>
                        <MapPin className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Comisión
                        </span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 font-medium">
                            En servicio
                        </span>
                    </>
                ) : (
                    <>
                        {isVueloDia ? (
                            <span className="text-base">{EMOJI_SUN}</span>
                        ) : isVueloNoche ? (
                            <span className="text-base">{EMOJI_MOON}</span>
                        ) : (
                            <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: reasonData?.color }}
                            />
                        )}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {reasonData?.label || 'Ausencia'}
                        </span>
                        <span
                            className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                                backgroundColor: `${reasonData?.color}20`,
                                color: reasonData?.color
                            }}
                        >
                            Ausencia
                        </span>
                    </>
                )}
            </div>

            {/* Nombre completo */}
            <InfoRow icon={User} label="Persona" iconColor="text-neutral-500">
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {person.full_name}
                </span>
            </InfoRow>

            {/* Fechas */}
            <InfoRow icon={Calendar} label="Período" iconColor="text-neutral-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500 w-12">Desde:</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            {formatDate(startDate)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500 w-12">Hasta:</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            {formatDate(endDate)}
                        </span>
                    </div>
                </div>
            </InfoRow>

            {/* Nombre de la comisión (solo para comisiones) */}
            {isComision && comision.comision_lugar && (
                <InfoRow icon={MapPin} label="Lugar" iconColor="text-neutral-500">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        {comision.comision_lugar}
                    </span>
                </InfoRow>
            )}

            {/* Observación (solo para ausencias con observación) */}
            {isAbsence && absence!.absence_remark && (
                <InfoRow icon={MessageSquare} label="Observación" iconColor="text-neutral-500">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {absence!.absence_remark}
                    </p>
                </InfoRow>
            )}
        </div>
    );
};

export default AbsenceTooltip;