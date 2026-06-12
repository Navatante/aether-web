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
                     iconColor = 'text-muted-foreground'
                 }: {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    iconColor?: string;
}) => (
    <div className="space-y-1">
        <div className="flex items-center gap-2">
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
            </span>
        </div>
        <div className="pl-5 border-l-2 border-border">
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
            <div className="flex items-center gap-2 pb-2 border-b border-border">
                {isComision ? (
                    <>
                        <MapPin className="w-4 h-4 text-info" />
                        <span className="text-sm font-medium text-foreground">
                            Comisión
                        </span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-info-muted text-info-muted-foreground font-medium">
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
                        <span className="text-sm font-medium text-foreground">
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
            <InfoRow icon={User} label="Persona" iconColor="text-muted-foreground">
                <span className="text-sm text-foreground font-medium">
                    {person.full_name}
                </span>
            </InfoRow>

            {/* Fechas */}
            <InfoRow icon={Calendar} label="Período" iconColor="text-muted-foreground">
                <div className="text-sm text-muted-foreground space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Desde:</span>
                        <span className="font-medium text-foreground">
                            {formatDate(startDate)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12">Hasta:</span>
                        <span className="font-medium text-foreground">
                            {formatDate(endDate)}
                        </span>
                    </div>
                </div>
            </InfoRow>

            {/* Nombre de la comisión (solo para comisiones) */}
            {isComision && comision.comision_lugar && (
                <InfoRow icon={MapPin} label="Lugar" iconColor="text-muted-foreground">
                    <span className="text-sm text-foreground">
                        {comision.comision_lugar}
                    </span>
                </InfoRow>
            )}

            {/* Observación (solo para ausencias con observación) */}
            {isAbsence && absence!.absence_remark && (
                <InfoRow icon={MessageSquare} label="Observación" iconColor="text-muted-foreground">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {absence!.absence_remark}
                    </p>
                </InfoRow>
            )}
        </div>
    );
};

export default AbsenceTooltip;