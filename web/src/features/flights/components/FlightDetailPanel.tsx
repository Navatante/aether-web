// Contenido de la fila expandida de un vuelo: navegación de pestañas
// (Tripulación / Autoridad) y, para Operacional, el diálogo de borrado.

import { Users, Shield, Layers, MapPin } from 'lucide-react';
import type { FlightData } from "@/types/flights";
import { PageCard } from "@/shared/components/common";
import { CrewMemberDetails } from "./CrewMemberDetails";
import { FlightDeleteDialog, type FlightDeleteControls } from "./FlightDeleteDialog";

interface FlightDetailPanelProps {
    flight: FlightData;
    activeTab: string;
    onTabChange: (tab: string) => void;
    canDelete: boolean;
    deleteControls: FlightDeleteControls;
}

export function FlightDetailPanel({ flight, activeTab, onTabChange, canDelete, deleteControls }: FlightDetailPanelProps) {
    const { tripulacion, cuposAutoridad, capacidadesBasicas, pasajeros } = flight.detalles;

    // Comandante primero, luego el resto de pilotos por orden.
    const commander = tripulacion.pilotos.find(p => p.nombre === flight.cteAeronave);
    const otherPilots = tripulacion.pilotos.filter(p => p.nombre !== flight.cteAeronave).sort((a, b) => a.orden - b.orden);
    const orderedPilots = commander ? [commander, ...otherPilots] : tripulacion.pilotos;
    const orderedDotaciones = [...tripulacion.dotaciones].sort((a, b) => a.orden - b.orden);

    const noAuthorityInfo = cuposAutoridad.length === 0 && capacidadesBasicas.length === 0 && pasajeros.length === 0;

    return (
        <>
            <div className="flex gap-4 mb-6 border-b border-border">
                <button onClick={() => onTabChange('tripulacion')} className={`pb-2 px-4 transition-all ${activeTab === 'tripulacion' ? 'text-foreground border-b-2 border-foreground/50' : 'text-muted-foreground hover:text-foreground'}`}><Users className="w-4 h-4 inline mr-2" />Tripulación</button>
                <button onClick={() => onTabChange('autoridad')} className={`pb-2 px-4 transition-all ${activeTab === 'autoridad' ? 'text-foreground border-b-2 border-foreground/50' : 'text-muted-foreground hover:text-foreground'}`}><Shield className="w-4 h-4 inline mr-2" />Autoridad, Capba y Pasajeros</button>
                {canDelete && <FlightDeleteDialog rowFlightId={flight.id} {...deleteControls} />}
            </div>

            {activeTab === 'tripulacion' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {orderedPilots.map((pilot, i) => (
                        <CrewMemberDetails key={`pilot-${pilot.nk}-${i}`} member={pilot} role="pilot" index={i} />
                    ))}
                    {orderedDotaciones.map((d, i) => (
                        <CrewMemberDetails key={`dotacion-${d.nk}-${i}`} member={d} role="dotacion" index={i} />
                    ))}
                </div>
            )}

            {activeTab === 'autoridad' && (
                <div className="space-y-6">
                    {cuposAutoridad.length > 0 && (
                        <PageCard>
                            <h4 className="text-foreground font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-muted-foreground" />Cupos de Autoridad</h4>
                            <div className="space-y-2">
                                {cuposAutoridad.map((c) => (
                                    <div key={c.autoridad} className="flex justify-between items-center p-3 rounded">
                                        <span className="text-foreground text-sm font-normal">{c.autoridad}</span>
                                        <span className="text-muted-foreground text-sm">{c.horas} horas</span>
                                    </div>
                                ))}
                            </div>
                        </PageCard>
                    )}
                    {capacidadesBasicas.length > 0 && (
                        <PageCard>
                            <h4 className="text-foreground font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" />Capacidades Básicas</h4>
                            <div className="space-y-2">
                                {capacidadesBasicas.map((c) => (
                                    <div key={c.capba} className="flex justify-between items-center p-3 rounded">
                                        <span className="text-foreground text-sm font-normal">{c.capba}</span>
                                        <span className="text-muted-foreground text-sm">{c.horas} horas</span>
                                    </div>
                                ))}
                            </div>
                        </PageCard>
                    )}
                    {pasajeros.length > 0 && (
                        <PageCard>
                            <h4 className="text-foreground font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />Información de Pasajeros</h4>
                            <div className="space-y-4">
                                {pasajeros.map((p) => (
                                    <div key={`${p.tipo}-${p.ruta}`} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded">
                                        <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Tipo</p><p className="text-foreground capitalize">{p.tipo}</p></div>
                                        <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Cantidad</p><p className="text-foreground text-lg font-semibold">{p.cantidad} {p.cantidad === 1 ? 'pasajero' : 'pasajeros'}</p></div>
                                        <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Ruta</p><p className="text-foreground flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" />{p.ruta}</p></div>
                                    </div>
                                ))}
                            </div>
                        </PageCard>
                    )}
                    {noAuthorityInfo && (
                        <div className="text-center text-muted-foreground py-8">No hay información de autoridad, capacidades o pasajeros</div>
                    )}
                </div>
            )}
        </>
    );
}
