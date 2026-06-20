// Tarjeta de detalle de un miembro de tripulación (piloto o dotación) dentro de
// la fila expandida de un vuelo. Solo render a partir de `member`.

import { User } from 'lucide-react';
import { cn } from "@/lib/utils";
import type { CrewMember } from "@/types/flights";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface CrewMemberDetailsProps {
    member: CrewMember;
    role: 'pilot' | 'dotacion';
    index: number;
}

export function CrewMemberDetails({ member, role, index }: CrewMemberDetailsProps) {
    if (!member) return null;
    const isPilot = role === 'pilot';
    const label = isPilot ? `Piloto ${index + 1}` : `Dotación ${index + 1}`;

    return (
        <div className="bg-glass rounded-lg p-4 backdrop-blur-sm border border-glass-border">
            <div className="flex justify-between items-start mb-4">
                <h4 className="text-foreground font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {label}
                    <span className="text-sm font-normal text-foreground/80">- {member.nombre}</span>
                </h4>
                <span className="text-xs text-muted-foreground">{member.nk}</span>
            </div>

            {/* Horas de Vuelo */}
            <div className="mb-8">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Horas de Vuelo</p>
                <div className="grid grid-cols-2 gap-14 text-sm">
                    <div className="space-y-2">
                        {isPilot && member.horaVueloPiloto ? (
                            <>
                                <div className="flex justify-between"><span className="text-hour-day/60">Día:</span><span className={member.horaVueloPiloto.dia === 0 ? "text-foreground/30" : "text-hour-day"}>{member.horaVueloPiloto.dia}h</span></div>
                                <div className="flex justify-between"><span className="text-hour-night/60">Noche:</span><span className={member.horaVueloPiloto.noche === 0 ? "text-foreground/30" : "text-hour-night"}>{member.horaVueloPiloto.noche}h</span></div>
                                <div className="flex justify-between"><span className="text-hour-gvn/60">GVN:</span><span className={member.horaVueloPiloto.gvn.total === 0 ? "text-foreground/30" : "text-hour-gvn"}>{member.horaVueloPiloto.gvn.total}h</span></div>
                                <div className="flex justify-between pl-4"><span className="text-hour-gvn/60 text-xs">→ IIT:</span><span className={member.horaVueloPiloto.gvn.iit === 0 ? "text-foreground/30" : "text-hour-gvn/80"}><span className="text-xs">{member.horaVueloPiloto.gvn.iit}h</span></span></div>
                                <div className="flex justify-between pl-4"><span className="text-hour-gvn/60 text-xs">→ ANVIS:</span><span className={`text-xs ${member.horaVueloPiloto.gvn.anvis === 0 ? "text-foreground/30" : "text-hour-gvn/80"}`}>{member.horaVueloPiloto.gvn.anvis}h</span></div>
                            </>
                        ) : member.horaVueloDotacion ? (
                            <>
                                <div className="flex justify-between"><span className="text-hour-day/60">Día:</span><span className={member.horaVueloDotacion.dia === 0 ? "text-foreground/30" : "text-hour-day"}>{member.horaVueloDotacion.dia}h</span></div>
                                <div className="flex justify-between"><span className="text-hour-night/60">Noche:</span><span className={member.horaVueloDotacion.noche === 0 ? "text-foreground/30" : "text-hour-night"}>{member.horaVueloDotacion.noche}h</span></div>
                                <div className="flex justify-between"><span className="text-hour-gvn/60">GVN:</span><span className={member.horaVueloDotacion.gvn === 0 ? "text-foreground/30" : "text-hour-gvn"}>{member.horaVueloDotacion.gvn}h</span></div>
                            </>
                        ) : null}
                    </div>
                    <div className="space-y-2">
                        {isPilot && member.horaVueloPiloto ? (
                            <>
                                <div className="flex justify-between"><span className="text-muted-foreground">Instructor:</span><span className={member.horaVueloPiloto.instructor === 0 ? "text-foreground/30" : "text-foreground"}>{member.horaVueloPiloto.instructor}h</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Instrumentos:</span><span className={member.horaVueloPiloto.instrumentos === 0 ? "text-foreground/30" : "text-foreground"}>{member.horaVueloPiloto.instrumentos}h</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Form. Día:</span><span className={member.horaVueloPiloto.formacionDia === 0 ? "text-foreground/30" : "text-foreground"}>{member.horaVueloPiloto.formacionDia}h</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Form. GVN:</span><span className={member.horaVueloPiloto.formacionGvn === 0 ? "text-foreground/30" : "text-foreground"}>{member.horaVueloPiloto.formacionGvn}h</span></div>
                            </>
                        ) : member.horaVueloDotacion ? (
                            <div className="flex justify-between"><span className="text-muted-foreground">Winch Trim:</span><span className={member.horaVueloDotacion.winchTrim === 0 ? "text-foreground/30" : "text-foreground"}>{member.horaVueloDotacion.winchTrim}h</span></div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Papeletas */}
            <div className="mb-8">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Papeletas</p>
                {member.papeletas && member.papeletas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {member.papeletas.map((p) => (
                            <Tooltip key={p.nombre}>
                                <TooltipTrigger render={
                                    <span className={cn(
                                        "px-2 py-1 rounded text-sm cursor-help font-medium",
                                        p.periodo === 3
                                            ? "bg-success-muted text-success-muted-foreground"
                                            : p.periodo === 2
                                                ? "bg-danger-muted text-danger-muted-foreground"
                                                : "bg-info-muted text-info-muted-foreground"
                                    )}>{p.nombre}</span>
                                } />
                                <TooltipContent variant="info"><p>{p.descripcion}</p></TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                ) : (
                    <div className="text-foreground/40 text-sm italic">Sin papeletas registradas</div>
                )}
            </div>

            {/* Tomas */}
            {isPilot && member.tomas && (
                <div className="mb-8">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Tomas</p>
                    <div className="space-y-1 text-sm">
                        <div className="grid grid-cols-5 gap-2 text-muted-foreground">
                            <span></span><span className="text-center">Tierra</span><span className="text-center">Mono</span><span className="text-center">Multi</span><span className="text-center">Carrier</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            <span className="text-hour-day/60">Día:</span>
                            <span className={`text-center ${member.tomas.dia.tierra === 0 ? "text-foreground/30" : "text-hour-day"}`}>{member.tomas.dia.tierra}</span>
                            <span className={`text-center ${member.tomas.dia.monospot === 0 ? "text-foreground/30" : "text-hour-day"}`}>{member.tomas.dia.monospot}</span>
                            <span className={`text-center ${member.tomas.dia.multispot === 0 ? "text-foreground/30" : "text-hour-day"}`}>{member.tomas.dia.multispot}</span>
                            <span className={`text-center ${member.tomas.dia.carrier === 0 ? "text-foreground/30" : "text-hour-day"}`}>{member.tomas.dia.carrier}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            <span className="text-hour-night/60">Noche:</span>
                            <span className={`text-center ${member.tomas.nocheConv.tierra === 0 ? "text-foreground/30" : "text-hour-night"}`}>{member.tomas.nocheConv.tierra}</span>
                            <span className={`text-center ${member.tomas.nocheConv.monospot === 0 ? "text-foreground/30" : "text-hour-night"}`}>{member.tomas.nocheConv.monospot}</span>
                            <span className={`text-center ${member.tomas.nocheConv.multispot === 0 ? "text-foreground/30" : "text-hour-night"}`}>{member.tomas.nocheConv.multispot}</span>
                            <span className={`text-center ${member.tomas.nocheConv.carrier === 0 ? "text-foreground/30" : "text-hour-night"}`}>{member.tomas.nocheConv.carrier}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            <span className="text-hour-gvn/60">GVN:</span>
                            <span className={`text-center ${member.tomas.gvn.tierra === 0 ? "text-foreground/30" : "text-hour-gvn"}`}>{member.tomas.gvn.tierra}</span>
                            <span className={`text-center ${member.tomas.gvn.monospot === 0 ? "text-foreground/30" : "text-hour-gvn"}`}>{member.tomas.gvn.monospot}</span>
                            <span className={`text-center ${member.tomas.gvn.multispot === 0 ? "text-foreground/30" : "text-hour-gvn"}`}>{member.tomas.gvn.multispot}</span>
                            <span className={`text-center ${member.tomas.gvn.carrier === 0 ? "text-foreground/30" : "text-hour-gvn"}`}>{member.tomas.gvn.carrier}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Aproximaciones */}
            {isPilot && member.aproximacionesInstr && (
                <>
                    <div className="mb-8">
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Aproximaciones Instrumentales</p>
                        <div className="grid grid-cols-2 gap-14 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Precisión:</span><span className={member.aproximacionesInstr.precision === 0 ? "text-foreground/30" : "text-foreground"}>{member.aproximacionesInstr.precision}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">No Precisión:</span><span className={member.aproximacionesInstr.noPrecision === 0 ? "text-foreground/30" : "text-foreground"}>{member.aproximacionesInstr.noPrecision}</span></div>
                        </div>
                    </div>
                    {member.aproximacionesSar && (
                        <div className="mb-4">
                            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Aproximaciones SAR</p>
                            <div className="grid grid-cols-2 gap-14 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">T/D:</span><span className={member.aproximacionesSar.td === 0 ? "text-foreground/30" : "text-foreground"}>{member.aproximacionesSar.td}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Search Pattern:</span><span className={member.aproximacionesSar.sp === 0 ? "text-foreground/30" : "text-foreground"}>{member.aproximacionesSar.sp}</span></div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Proyectiles */}
            {!isPilot && member.proyectiles && (
                <div>
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Proyectiles Disparados</p>
                    <div className="grid grid-cols-2 gap-14 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">M3M:</span><span className={member.proyectiles.m3m === 0 ? "text-foreground/30" : "text-foreground"}>{member.proyectiles.m3m}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">MAG58:</span><span className={member.proyectiles.mag58 === 0 ? "text-foreground/30" : "text-foreground"}>{member.proyectiles.mag58}</span></div>
                    </div>
                </div>
            )}
        </div>
    );
}
