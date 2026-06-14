// Celda del calendario de Disponibilidad. Como comisión y ausencia no pueden
// coexistir (triggers de BD), una celda es O una comisión O 1..N ausencias
// solapadas, que se pintan como franjas horizontales apiladas.

import React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AbsenceTooltip } from './AbsenceTooltip';
import {
    getReasonColor,
    EMOJI_SUN,
    EMOJI_MOON,
    type Absence,
    type Person,
    type PersonComision,
} from '../absences';
import type { Day } from '../hooks/useDisponibilidad';

interface CalendarCellProps {
    person: Person;
    day: Day;
    absences: Absence[];
    comision?: PersonComision;
    cellClass: string;
    onViewAbsence: (person: Person, absence: Absence) => void;
    onViewComision: (person: Person, comision: PersonComision) => void;
    onCreate: (person: Person, day: Day) => void;
}

// Una franja de color dentro de la celda (ausencia o comisión).
interface Segment {
    key: string;
    color: string;
    isStart: boolean;
    isEnd: boolean;
    emoji: string | null;
    onClick: () => void;
    tooltip: React.ReactNode;
}

const onDay = (dateStr: string, day: string) => dateStr.slice(0, 10) === day;

export const CalendarCell: React.FC<CalendarCellProps> = ({
    person,
    day,
    absences,
    comision,
    cellClass,
    onViewAbsence,
    onViewComision,
    onCreate,
}) => {
    const segments: Segment[] = comision
        ? [{
            key: `c-${comision.person_comision_sk}`,
            color: 'var(--comision)',
            isStart: onDay(comision.comision_start_date, day.dateStr),
            isEnd: onDay(comision.comision_end_date, day.dateStr),
            emoji: null,
            onClick: () => onViewComision(person, comision),
            tooltip: <AbsenceTooltip person={person} comision={comision} />,
        }]
        : absences.map((absence): Segment => {
            const isVueloDia = absence.absence_reason === 'Vuelo día';
            const isVueloNoche = absence.absence_reason === 'Vuelo noche';
            return {
                key: `a-${absence.absence_sk}`,
                color: getReasonColor(absence.absence_reason).color,
                isStart: onDay(absence.absence_start_date, day.dateStr),
                isEnd: onDay(absence.absence_end_date, day.dateStr),
                emoji: isVueloDia ? EMOJI_SUN : isVueloNoche ? EMOJI_MOON : null,
                onClick: () => onViewAbsence(person, absence),
                tooltip: <AbsenceTooltip person={person} absence={absence} />,
            };
        });

    return (
        <td
            className={`p-1 text-center border-b border-border cursor-pointer transition-colors hover:bg-table-row-hover ${cellClass}`}
            onClick={() => onCreate(person, day)}
        >
            {segments.length > 0 && (
                <div className="flex flex-col gap-px h-7">
                    {segments.map((seg) => (
                        <HoverCard key={seg.key}>
                            <HoverCardTrigger
                                delay={0}
                                closeDelay={150}
                                render={
                                    <div
                                        className="flex-1 flex items-center justify-center transition-transform hover:scale-105"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            seg.onClick();
                                        }}
                                        style={{
                                            backgroundColor: seg.emoji ? 'transparent' : seg.color,
                                            borderRadius: seg.isStart && seg.isEnd
                                                ? '6px'
                                                : seg.isStart
                                                    ? '6px 0 0 6px'
                                                    : seg.isEnd
                                                        ? '0 6px 6px 0'
                                                        : '0',
                                            marginLeft: seg.isStart ? '2px' : '-1px',
                                            marginRight: seg.isEnd ? '2px' : '-1px',
                                        }}
                                    />
                                }
                            >
                                {seg.emoji}
                            </HoverCardTrigger>
                            <HoverCardContent side="top" className="w-auto p-4">
                                {seg.tooltip}
                            </HoverCardContent>
                        </HoverCard>
                    ))}
                </div>
            )}
        </td>
    );
};

export default CalendarCell;
