// Página de disponibilidad mensual. La lógica vive en hooks/useDisponibilidad;
// aquí solo el render del calendario, filtros y diálogos.

import React from 'react';
import {Select, SelectContent, SelectItem, SelectTrigger} from "@/components/ui/select";
import {Loader2, PartyPopper, RefreshCw, Search} from "lucide-react";
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    StickyTableHeader,
    STICKY_CORNER,
    stickyFirstColClass,
} from "@/shared/components/common";
import {HoverCard, HoverCardContent, HoverCardTrigger} from "@/components/ui/hover-card";
import {
    RegisterAbsenceDialog,
    FestivosDialog,
    getReasonColor,
    type Absence,
    type Person,
    type PersonComision,
} from "../components";
import {AvailabilityTooltip} from "../components/AvailabilityTooltip";
import {AbsenceTooltip} from "../components/AbsenceTooltip";
import { EMOJI_SUN, EMOJI_MOON } from "../absences";
import {
    useDisponibilidad,
    type Day,
    monthNames,
    dayNames,
    displayRoles,
} from "../hooks/useDisponibilidad";

// Re-exportar tipos si son necesarios en otros lugares
export type { Person, Absence, PersonComision };

export default function Disponibilidad(): React.ReactElement {
    const {
        data,
        isLoading,
        error,
        days,
        filteredPersons,
        uniqueEscala,
        uniqueAbsenceReasons,
        selectedYear,
        setSelectedYear,
        selectedMonth,
        setSelectedMonth,
        isHoliday,
        getHolidayName,
        getDayHeaderClass,
        getDayCellClass,
        searchTerm,
        setSearchTerm,
        roleFilter,
        setRoleFilter,
        escalaFilter,
        setEscalaFilter,
        getAbsenceForDay,
        getComisionForDay,
        getAbsentPersonsForDay,
        getAvailabilityForDay,
        isDialogOpen,
        setIsDialogOpen,
        dialogMode,
        selectedAbsence,
        selectedPerson,
        selectedComision,
        initialDialogData,
        isFestivosDialogOpen,
        setIsFestivosDialogOpen,
        handleFestivosDialogClose,
        handleDialogSuccess,
        handleCellClick,
        handleRefresh,
        hasAdministrativePermission,
    } = useDisponibilidad();

    return (
        <div className="h-full flex flex-col p-3 sm:p-6 pb-8">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header - Sticky */}
                <div className="flex-shrink-0 sticky top-0 z-20 bg-inherit pb-4">
                    <div className="mb-6 text-center">
                        <GradientTitle>Disponibilidad</GradientTitle>
                    </div>

                    {/* Controles */}
                    <PageControls>
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Campo de búsqueda */}
                            <div className="flex-1 min-w-[200px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-card border-input border focus:border-ring focus:outline-none transition-all placeholder:text-muted-foreground text-foreground w-full pl-10 pr-4 py-2.5 rounded-xl"
                                        aria-label="Buscar personal"
                                    />
                                </div>
                            </div>

                            {/* Filtro por Rol */}
                            <Select value={roleFilter} onValueChange={(value) => setRoleFilter( value ?? 'Todos los roles')}>
                                <SelectTrigger className="min-w-[160px] bg-card border-input">
                                    <span>{roleFilter}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Todos los roles">Todos los roles</SelectItem>
                                    {displayRoles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Filtro por Escala */}
                            <Select value={escalaFilter} onValueChange={(value)=> setEscalaFilter(value ?? 'Todas las escalas')}>
                                <SelectTrigger className="min-w-[160px] bg-card border-input">
                                    <span>{escalaFilter}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Todas las escalas">Todos las escalas</SelectItem>
                                    {uniqueEscala.map((escala) => (
                                        <SelectItem key={escala} value={escala}>
                                            {escala}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Select de Mes */}
                            <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(parseInt(value ?? ''))}>
                                <SelectTrigger className="min-w-[140px] bg-card border-input">
                                    <span>{monthNames[selectedMonth]}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    {monthNames.map((month, i) => (
                                        <SelectItem key={i} value={String(i)}>{month}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Select de Año */}
                            <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(parseInt(value ?? ''))}>
                                <SelectTrigger className="min-w-[100px] bg-card border-input">
                                    <span>{selectedYear}</span>
                                </SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026].map((year) => (
                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex flex-wrap gap-3 items-center">
                                {/* Botón Festivos */}
                                {hasAdministrativePermission && (
                                    <ActionButton
                                        variant={undefined}
                                        icon={PartyPopper}
                                        label="Festivos"
                                        onClick={() => setIsFestivosDialogOpen(true)}
                                    />
                                )}
                                {/* Botón Refrescar */}
                                <ActionButton
                                    variant="refresh"
                                    icon={RefreshCw}
                                    label="Refrescar"
                                    onClick={(e) => {
                                        handleRefresh();
                                        const icon = e.currentTarget.querySelector("svg");
                                        if (icon) {
                                            icon.classList.remove("animate-spin-once");
                                            requestAnimationFrame(() => {
                                                icon.classList.add("animate-spin-once");
                                            });
                                        }
                                    }}
                                    disabled={isLoading}
                                    loading={isLoading}
                                />
                            </div>
                        </div>
                    </PageControls>

                    {/* Legend */}
                    <PageControls>
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: 'var(--comision)' }}
                                />
                                <span className="text-sm text-muted-foreground">Comisión</span>
                            </div>
                            {uniqueAbsenceReasons.map((reason) => {
                                const reasonData = getReasonColor(reason);
                                const isVueloDia = reason === 'Vuelo día';
                                const isVueloNoche = reason === 'Vuelo noche';

                                return (
                                    <div key={reason} className="flex items-center gap-2">
                                        {isVueloDia ? (
                                            <span className="text-base">{EMOJI_SUN}</span>
                                        ) : isVueloNoche ? (
                                            <span className="text-base">{EMOJI_MOON}</span>
                                        ) : (
                                            <div
                                                className="w-3 h-3 rounded"
                                                style={{ backgroundColor: reasonData.color }}
                                            />
                                        )}
                                        <span className="text-sm text-muted-foreground">{reasonData.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </PageControls>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="flex-shrink-0 mb-4 p-4 bg-danger-muted border border-danger/30 rounded-lg">
                        <p className="text-danger">Error: {error}</p>
                        <button
                            onClick={handleRefresh}
                            className="mt-2 text-sm text-danger underline hover:no-underline"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-info" />
                        <span className="ml-3 text-muted-foreground">Cargando disponibilidad...</span>
                    </div>
                )}

                {/* Calendar Grid */}
                {!isLoading && (
                    <PageTableContainer className="flex-1 overflow-auto">
                        <table className="w-full" role="table">
                            <StickyTableHeader>
                            <tr>
                                <th className={`text-left p-4 font-semibold text-table-header-foreground min-w-[220px] ${STICKY_CORNER}`}>
                                </th>
                                {days.map((day: Day) => {
                                    const holiday = isHoliday(day.dateStr);

                                    return (
                                        <th
                                            key={day.day}
                                            className={`text-center p-0 min-w-[38px] font-semibold text-table-header-foreground ${getDayHeaderClass(day)}`}
                                        >
                                            <HoverCard>
                                                <HoverCardTrigger
                                                    delay={0}
                                                    closeDelay={150}
                                                    render={<div className="p-2 cursor-help" />}
                                                >
                                                    <span className={`block text-[10px] uppercase tracking-wide ${holiday ? 'text-danger font-semibold' : 'text-muted-foreground'}`}>
                                                        {dayNames[day.dayOfWeek]}
                                                    </span>
                                                    <span className={`block text-sm font-medium mt-0.5 ${holiday ? 'text-danger' : ''}`}>
                                                        {day.day}
                                                    </span>
                                                </HoverCardTrigger>
                                                <HoverCardContent side="bottom" className="w-auto p-4 max-h-[400px] overflow-auto">
                                                    {/* Mostrar nombre del festivo si aplica */}
                                                    {isHoliday(day.dateStr) && (
                                                        <div className="mb-2 pb-2 border-b border-danger/30">
                                                            <span className="text-sm font-semibold text-danger">
                                                                🎉 {getHolidayName(day.dateStr)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <AvailabilityTooltip
                                                        day={day}
                                                        availableCount={getAvailabilityForDay(day.dateStr)}
                                                        totalCount={filteredPersons.length}
                                                        absentPersons={getAbsentPersonsForDay(day.dateStr)}
                                                    />
                                                </HoverCardContent>
                                            </HoverCard>
                                        </th>
                                    );
                                })}
                            </tr>
                            </StickyTableHeader>
                            <tbody>
                            {filteredPersons.length === 0 ? (
                                <tr>
                                    <td colSpan={days.length + 1} className="p-8 text-center text-muted-foreground">
                                        No se encontraron empleados
                                    </td>
                                </tr>
                            ) : (
                                filteredPersons.map((person: Person, idx: number) => (
                                    <tr
                                        key={person.person_sk}
                                        className={`border-b border-border hover:bg-table-row-hover transition-colors ${idx % 2 === 0 ? 'bg-table-row-even' : 'bg-table-row-odd'}`}
                                    >
                                        <td className={stickyFirstColClass(idx, "p-3 border-b border-border shadow-sm")}>
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-foreground">
                                                            {person.full_name}
                                                        </span>
                                                </div>
                                            </div>
                                        </td>
                                        {days.map((day: Day) => {
                                            const absence = getAbsenceForDay(person.person_sk, day.dateStr);
                                            const comision = getComisionForDay(person.person_sk, day.dateStr);

                                            const event = absence || comision;

                                            let isStart = false;
                                            let isEnd = false;
                                            let color = '';
                                            let isVueloDia = false;
                                            let isVueloNoche = false;

                                            if (absence) {
                                                isStart = absence.absence_start_date.startsWith(day.dateStr);
                                                isEnd = absence.absence_end_date.startsWith(day.dateStr);
                                                color = getReasonColor(absence.absence_reason).color;
                                                isVueloDia = absence.absence_reason === 'Vuelo día';
                                                isVueloNoche = absence.absence_reason === 'Vuelo noche';
                                            } else if (comision) {
                                                isStart = comision.comision_start_date.startsWith(day.dateStr);
                                                isEnd = comision.comision_end_date.startsWith(day.dateStr);
                                                color = 'var(--comision)';
                                            }

                                            return (
                                                <td
                                                    key={day.day}
                                                    className={`p-1 text-center border-b border-border cursor-pointer transition-colors hover:bg-table-row-hover ${getDayCellClass(day)}`}
                                                    onClick={() => handleCellClick(person, day)}
                                                >
                                                    {event && (
                                                        <HoverCard>
                                                            <HoverCardTrigger
                                                                delay={0}
                                                                closeDelay={150}
                                                                render={
                                                                    <div
                                                                        className="h-7 flex items-center justify-center transition-transform hover:scale-105"
                                                                        style={{
                                                                            backgroundColor:
                                                                                isVueloDia || isVueloNoche ? "transparent" : color,
                                                                            borderRadius: isStart && isEnd
                                                                                ? "6px"
                                                                                : isStart
                                                                                    ? "6px 0 0 6px"
                                                                                    : isEnd
                                                                                        ? "0 6px 6px 0"
                                                                                        : "0",
                                                                            marginLeft: isStart ? "2px" : "-1px",
                                                                            marginRight: isEnd ? "2px" : "-1px",
                                                                        }}
                                                                    />
                                                                }
                                                            >
                                                                {isVueloDia && EMOJI_SUN}
                                                                {isVueloNoche && EMOJI_MOON}
                                                            </HoverCardTrigger>
                                                            <HoverCardContent side="top" className="w-auto p-4">
                                                                <AbsenceTooltip
                                                                    person={person}
                                                                    absence={absence}
                                                                    comision={comision}
                                                                />
                                                            </HoverCardContent>
                                                        </HoverCard>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </PageTableContainer>
                )}
            </div>

            {/* Dialog de Ausencias/Comisiones */}
            <RegisterAbsenceDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                mode={dialogMode}
                persons={data.persons}
                initialData={initialDialogData}
                selectedAbsence={selectedAbsence}
                selectedPerson={selectedPerson}
                selectedComision={selectedComision}
                onSuccess={handleDialogSuccess}
            />

            {/* Dialog de Festivos */}
            <FestivosDialog
                open={isFestivosDialogOpen}
                onOpenChange={handleFestivosDialogClose}
            />

        </div>
    );
}
