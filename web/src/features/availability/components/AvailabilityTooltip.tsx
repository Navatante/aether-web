import React from 'react';
import { Calendar, Users, MapPin, FileText } from 'lucide-react';
import { type Absence, type PersonComision, type Person, getReasonColor } from "@/features/availability";

interface Day {
    day: number;
    dayOfWeek: number;
    isWeekend: boolean;
    dateStr: string;
}

interface AvailabilityTooltipProps {
    day: Day;
    availableCount: number;
    totalCount: number;
    absentPersons: Array<{
        person: Person;
        absence?: Absence;
        comision?: PersonComision;
    }>;
}

const dayNamesLong: string[] = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const monthNames: string[] = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const EMOJI_SUN = '☀️';
const EMOJI_MOON = '🌑';

export const AvailabilityTooltip: React.FC<AvailabilityTooltipProps> = ({
                                                                            day,
                                                                            availableCount,
                                                                            totalCount,
                                                                            absentPersons
                                                                        }) => {
    const date = new Date(day.dateStr);
    const formattedDate = `${dayNamesLong[day.dayOfWeek]}, ${day.day} de ${monthNames[date.getMonth()]}`;
    const absentCount = totalCount - availableCount;
    const availabilityPercentage = totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0;

    // Agrupar ausentes por tipo
    const groupedAbsents = absentPersons.reduce((acc, item) => {
        const type = item.comision ? 'comision' : (item.absence?.absence_reason || 'Otro');
        if (!acc[type]) acc[type] = [];
        acc[type].push(item);
        return acc;
    }, {} as Record<string, typeof absentPersons>);

    const InfoSection = ({
                             icon: Icon,
                             title,
                             children
                         }: {
        icon: React.ElementType;
        title: string;
        children: React.ReactNode;
    }) => (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {title}
                </span>
            </div>
            <div className="pl-5 border-l-2 border-border">
                {children}
            </div>
        </div>
    );

    const AbsentItem = ({
                            item
                        }: {
        item: { person: Person; absence?: Absence; comision?: PersonComision }
    }) => {
        const isComision = !!item.comision;
        const isVueloDia = item.absence?.absence_reason === 'Vuelo día';
        const isVueloNoche = item.absence?.absence_reason === 'Vuelo noche';

        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                {isComision ? (
                    <MapPin className="w-3 h-3 text-info flex-shrink-0" />
                ) : isVueloDia ? (
                    <span className="text-xs flex-shrink-0">{EMOJI_SUN}</span>
                ) : isVueloNoche ? (
                    <span className="text-xs flex-shrink-0">{EMOJI_MOON}</span>
                ) : (
                    <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getReasonColor(item.absence?.absence_reason || '').color }}
                    />
                )}
                <span className="truncate">{item.person.full_name}</span>
            </div>
        );
    };

    return (
        <div className="space-y-3 max-w-xs min-w-[240px] max-h-[340px] overflow-y-auto pr-4">
            {/* Fecha */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                    {formattedDate}
                </span>
                {day.isWeekend && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-warning-muted text-warning-muted-foreground font-medium">
                        Fin de semana
                    </span>
                )}
            </div>

            {/* Resumen de disponibilidad */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-success" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Disponibilidad
                        </span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        availabilityPercentage >= 80
                            ? 'bg-success-muted text-success-muted-foreground'
                            : availabilityPercentage >= 50
                                ? 'bg-warning-muted text-warning-muted-foreground'
                                : 'bg-danger-muted text-danger-muted-foreground'
                    }`}>
                        {availabilityPercentage}%
                    </span>
                </div>

                {/* Barra de progreso */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 rounded-full ${
                            availabilityPercentage >= 80
                                ? 'bg-success'
                                : availabilityPercentage >= 50
                                    ? 'bg-warning'
                                    : 'bg-danger'
                        }`}
                        style={{ width: `${availabilityPercentage}%` }}
                    />
                </div>

                {/* Contadores */}
                <div className="flex justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span className="text-muted-foreground">
                            <span className="font-semibold text-success">{availableCount}</span> disponibles
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <span className="text-muted-foreground">
                            <span className="font-semibold text-foreground">{absentCount}</span> ausentes
                        </span>
                    </div>
                </div>
            </div>

            {/* Lista de ausentes agrupados */}
            {absentCount > 0 && (
                <div className="pt-2 border-t border-border space-y-3">
                    {Object.entries(groupedAbsents).map(([type, items]) => {
                        const isComision = type === 'comision';
                        const reasonData = !isComision ? getReasonColor(type) : null;

                        return (
                            <InfoSection
                                key={type}
                                icon={isComision ? MapPin : FileText}
                                title={isComision ? 'En comisión' : reasonData?.label || type}
                            >
                                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                    {items.map((item, idx) => (
                                        <AbsentItem key={idx} item={item} />
                                    ))}
                                </div>
                            </InfoSection>
                        );
                    })}
                </div>
            )}

            {/* Mensaje cuando no hay ausentes */}
            {absentCount === 0 && (
                <div className="pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-success">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        Todo el personal disponible
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvailabilityTooltip;