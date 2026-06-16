import React, { useState, useTransition } from 'react';
import { useApiPaginatedQuery, useApiMutation } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { transformFlightsFromDB } from "../utils/transformFlightsFromDB";
import { cn } from "@/lib/utils";
import { FlightData, CrewMember } from "@/types/flights";
import type { FlightItem } from "@/types/generated/flights";
import {
    User, ChevronDown, ChevronUp, Users, MapPin, Shield, Layers,
    Search, ChevronLeft, ChevronRight, RefreshCw, Trash2
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { PermissionLevel, useUser } from "@/providers";
import {
    ActionButton,
    GradientTitle,
    PageControls,
    PageTableContainer,
    PageCard,
    StickyTableHeader,
    TableRow,
    DetailsRow,
    SearchInput,
    EventBadge,
} from "@/shared/components/common";

interface DeleteActionState {
    status: 'idle' | 'pending' | 'success' | 'error';
    error?: string;
    deletedId?: number;
}

// Función para formatear fecha UTC a hora local de España
const formatDateTimeSpain = (dateString: string, timeString?: string): string => {
    // Crear fecha en UTC
    let utcDate: Date;

    if (timeString) {
        // Si tenemos fecha y hora separados
        utcDate = new Date(`${dateString}T${timeString}Z`);
    } else {
        // Si solo tenemos fecha, asumimos que ya incluye la hora o es solo fecha
        const dateStr = dateString.includes('T') ? dateString : `${dateString}T00:00:00`;
        utcDate = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`);
    }

    // Formatear a hora local de España
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };

    return utcDate.toLocaleString('es-ES', options);
};

const Flights = () => {
    const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);
    const [activeTab, setActiveTab] = useState('tripulacion');
    const [confirmationText, setConfirmationText] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [flightToDelete, setFlightToDelete] = useState<number | null>(null);
    const { hasPermission, escuadrillaId } = useUser();
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');

    // Params state for pagination
    const [params, setParamsState] = useState({ limit: 20, offset: 0, flight_sk: null as number | null });
    const setParams = (newParams: Partial<typeof params>) => {
        setParamsState(prev => ({ ...prev, ...newParams }));
    };

    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.flight_sk != null) query.flight_sk = params.flight_sk;

    const {
        data: flights,
        totalCount,
        isLoading,
        refetch,
    } = useApiPaginatedQuery<FlightData, FlightItem>({
        path: "/flights",
        query,
        queryKey: queryKeys.flights.list(escuadrillaId ?? 0, params),
        transform: transformFlightsFromDB,
    });

    const itemsPerPage = params.limit;
    const currentPage = Math.floor(params.offset / itemsPerPage) + 1;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    // Invalida todo el dominio de vuelos de la escuadrilla (cualquier lista, sin
    // depender de los params). El error HTTP lo notifica el toast de useApiMutation.
    const deleteFlight = useApiMutation<void, { flightId: number }>(
        'DELETE', (v) => `/flights/${v.flightId}`,
        {
            invalidateKeys: [queryKeys.flights.all(escuadrillaId ?? 0)],
            successMessage: "Vuelo eliminado con éxito.",
        },
    );

    const [, deleteAction, isDeleting] = React.useActionState<DeleteActionState, number>(
        async (_prev, flightId) => {
            try {
                await deleteFlight.mutateAsync({ flightId });
                if (selectedFlight?.id === flightId) setSelectedFlight(null);
                setConfirmationText('');
                setDeleteDialogOpen(false);
                setFlightToDelete(null);
                return { status: 'success', deletedId: flightId };
            } catch (error) {
                // El error HTTP ya lo notifica el toast de useApiMutation.
                return { status: 'error', error: error instanceof Error ? error.message : 'Error' };
            }
        },
        { status: 'idle' }
    );

    const handleRowClick = (flight: FlightData) => {
        setSelectedFlight(selectedFlight?.id === flight.id ? null : flight);
        setActiveTab('tripulacion');
    };

    const handleRefresh = () => startTransition(() => { refetch(); });

    const openDeleteDialog = (flightId: number) => {
        setFlightToDelete(flightId);
        setConfirmationText('');
        setDeleteDialogOpen(true);
    };

    const getEventType = (evento: string): "mision" | "maniobra-nacional" | "maniobra-internacional" | "pruebas" | "adaptacion" | "adiestramiento" | "default" => {
        const type = evento.split(' - ')[0];

        switch (type) {
            case 'Misión':
                return 'mision';
            case 'Maniobra nacional':
                return 'maniobra-nacional';
            case 'Maniobra internacional':
                return 'maniobra-internacional';
            case 'Pruebas':
                return 'pruebas';
            case 'Adaptación':
                return 'adaptacion';
            case 'Adiestramiento':
                return 'adiestramiento';
            default:
                return 'default';
        }
    };


    const renderCrewMemberDetails = (member: CrewMember, role: string, index: number) => {
        if (!member) return null;
        const isPilot = role === 'pilot';
        const label = isPilot ? `Piloto ${index + 1}` : `Dotación ${index + 1}`;

        return (
            <div key={`${role}-${index}`} className="bg-glass rounded-lg p-4 backdrop-blur-sm border border-glass-border">
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
                            {member.papeletas.map((p, i) => (
                                <Tooltip key={i}>
                                    <TooltipTrigger asChild>
                                        <span className={cn(
                                            "px-2 py-1 rounded text-sm cursor-help font-medium",
                                            p.periodo === 3
                                                ? "bg-success-muted text-success-muted-foreground"
                                                : "bg-info-muted text-info-muted-foreground"
                                        )}>{p.nombre}</span>
                                    </TooltipTrigger>
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
    };

    return (
        <div className="h-full p-3 sm:p-6 pb-8 flex flex-col">
            <div className="w-full mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="mb-8 text-center flex-shrink-0">
                    <GradientTitle>Vuelos</GradientTitle>
                </div>

                {/* Controles */}
                <PageControls className="flex-shrink-0">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por ID..."
                            />
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <ActionButton
                                variant="refresh"
                                icon={Search}
                                label="Buscar"
                                onClick={() => {
                                    setParams({
                                        flight_sk: searchQuery ? parseInt(searchQuery) : null,
                                        offset: 0
                                    });
                                }}
                            />

                            <ActionButton
                                variant="refresh"
                                icon={RefreshCw}
                                label="Actualizar"
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
                                disabled={isPending}
                                loading={isPending}
                            />

                        </div>
                    </div>
                </PageControls>

                {/* Tabla */}
                <PageTableContainer className="flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full min-w-[760px]" role="table">
                            <StickyTableHeader>
                            <tr>
                                <th className="text-left p-4 font-semibold text-table-header-foreground">ID</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Fecha</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Helicóptero</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Evento</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Comte Aeronave</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground">Horas</th>
                                <th className="text-center p-4 font-semibold text-table-header-foreground"></th>
                            </tr>
                            </StickyTableHeader>
                            <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                            ) : flights.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No se encontraron vuelos</td></tr>
                            ) : (
                                flights.map((flight, idx) => (
                                    <React.Fragment key={flight.id}>
                                        <TableRow
                                            index={idx}
                                            isSelected={selectedFlight?.id === flight.id}
                                            onClick={() => handleRowClick(flight)}
                                        >
                                            <td className="p-4">
                                                <span className="text-sm text-muted-foreground">{flight.id}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDateTimeSpain(flight.fecha, flight.hora)}
                                                </span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">{flight.helicoptero}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <EventBadge type={getEventType(flight.evento)}>{flight.evento}</EventBadge>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-foreground">{flight.cteAeronave}</span>
                                            </td>
                                            <td className="text-center p-4">
                                                <span className="text-sm text-muted-foreground">{flight.horas}h</span>
                                            </td>
                                            <td className="text-center p-4">
                                                {selectedFlight?.id === flight.id ? (
                                                    <ChevronUp className="w-5 h-5 text-muted-foreground mx-auto" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-muted-foreground mx-auto" />
                                                )}
                                            </td>
                                        </TableRow>

                                        {selectedFlight?.id === flight.id && (
                                            <DetailsRow colSpan={7}>
                                                        <div className="flex gap-4 mb-6 border-b border-border">
                                                            <button onClick={() => setActiveTab('tripulacion')} className={`pb-2 px-4 transition-all ${activeTab === 'tripulacion' ? 'text-foreground border-b-2 border-foreground/50' : 'text-muted-foreground hover:text-foreground'}`}><Users className="w-4 h-4 inline mr-2" />Tripulación</button>
                                                            <button onClick={() => setActiveTab('autoridad')} className={`pb-2 px-4 transition-all ${activeTab === 'autoridad' ? 'text-foreground border-b-2 border-foreground/50' : 'text-muted-foreground hover:text-foreground'}`}><Shield className="w-4 h-4 inline mr-2" />Autoridad, Capba y Pasajeros</button>
                                                            {hasPermission(PermissionLevel.OPERACIONAL) && (
                                                                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                                                    <AlertDialogTrigger asChild>
                                                                        <button onClick={() => openDeleteDialog(flight.id)} className="ml-auto pb-2 px-4 text-danger hover:text-danger/80 transition-all text-xs">
                                                                            <Trash2 className="pb-1 w-4 h-4 inline mr-1" />Eliminar
                                                                        </button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <form action={() => {
                                                                            if (flightToDelete && confirmationText === `eliminarvuelo${flightToDelete}`) {
                                                                                deleteAction(flightToDelete);
                                                                            }
                                                                        }}>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle className="text-xl font-semibold">
                                                                                    ¿Estás absolutamente seguro?
                                                                                </AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    Esta acción no se puede deshacer. Eliminará permanentemente el vuelo{' '}
                                                                                    <span className="font-semibold text-foreground">ID: {flightToDelete}</span>.
                                                                                    <br /><br />
                                                                                    Escribe: <strong className="text-danger">eliminarvuelo{flightToDelete}</strong>
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <Input
                                                                                placeholder="Escribe aquí..."
                                                                                value={confirmationText}
                                                                                onChange={(e) => setConfirmationText(e.target.value)}
                                                                                className="mt-4"
                                                                                disabled={isDeleting}
                                                                            />
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel
                                                                                    disabled={isDeleting}
                                                                                >
                                                                                    Cancelar
                                                                                </AlertDialogCancel>
                                                                                <AlertDialogAction
                                                                                    type="submit"
                                                                                    disabled={confirmationText !== `eliminarvuelo${flightToDelete}` || isDeleting}
                                                                                    className="bg-danger hover:bg-danger/90 text-danger-foreground"
                                                                                >
                                                                                    {isDeleting ? (
                                                                                        <span className="flex items-center gap-2">
                                                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                                                                Eliminando...
                                                                                            </span>
                                                                                    ) : 'Continuar'}
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </form>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </div>

                                                        {activeTab === 'tripulacion' && (
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                {(() => {
                                                                    const commander = flight.detalles.tripulacion.pilotos.find(p => p.nombre === flight.cteAeronave);
                                                                    const otherPilots = flight.detalles.tripulacion.pilotos.filter(p => p.nombre !== flight.cteAeronave).sort((a, b) => a.orden - b.orden);
                                                                    const orderedPilots = commander ? [commander, ...otherPilots] : flight.detalles.tripulacion.pilotos;
                                                                    return orderedPilots.map((pilot, i) => renderCrewMemberDetails(pilot, 'pilot', i));
                                                                })()}
                                                                {flight.detalles.tripulacion.dotaciones.sort((a, b) => a.orden - b.orden).map((d, i) => renderCrewMemberDetails(d, 'dotacion', i))}
                                                            </div>
                                                        )}

                                                        {activeTab === 'autoridad' && (
                                                            <div className="space-y-6">
                                                                {flight.detalles.cuposAutoridad.length > 0 && (
                                                                    <PageCard>
                                                                        <h4 className="text-foreground font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-muted-foreground" />Cupos de Autoridad</h4>
                                                                        <div className="space-y-2">
                                                                            {flight.detalles.cuposAutoridad.map((c, i) => (
                                                                                <div key={i} className="flex justify-between items-center p-3 rounded">
                                                                                    <span className="text-foreground text-sm font-normal">{c.autoridad}</span>
                                                                                    <span className="text-muted-foreground text-sm">{c.horas} horas</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </PageCard>
                                                                )}
                                                                {flight.detalles.capacidadesBasicas.length > 0 && (
                                                                    <PageCard>
                                                                        <h4 className="text-foreground font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" />Capacidades Básicas</h4>
                                                                        <div className="space-y-2">
                                                                            {flight.detalles.capacidadesBasicas.map((c, i) => (
                                                                                <div key={i} className="flex justify-between items-center p-3 rounded">
                                                                                    <span className="text-foreground text-sm font-normal">{c.capba}</span>
                                                                                    <span className="text-muted-foreground text-sm">{c.horas} horas</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </PageCard>
                                                                )}
                                                                {flight.detalles.pasajeros.length > 0 && (
                                                                    <PageCard>
                                                                        <h4 className="text-foreground font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />Información de Pasajeros</h4>
                                                                        <div className="space-y-4">
                                                                            {flight.detalles.pasajeros.map((p, i) => (
                                                                                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded">
                                                                                    <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Tipo</p><p className="text-foreground capitalize">{p.tipo}</p></div>
                                                                                    <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Cantidad</p><p className="text-foreground text-lg font-semibold">{p.cantidad} {p.cantidad === 1 ? 'pasajero' : 'pasajeros'}</p></div>
                                                                                    <div><p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Ruta</p><p className="text-foreground flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" />{p.ruta}</p></div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </PageCard>
                                                                )}
                                                                {flight.detalles.cuposAutoridad.length === 0 && flight.detalles.capacidadesBasicas.length === 0 && flight.detalles.pasajeros.length === 0 && (
                                                                    <div className="text-center text-muted-foreground py-8">No hay información de autoridad, capacidades o pasajeros</div>
                                                                )}
                                                            </div>
                                                        )}
                                            </DetailsRow>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-muted/50 border-t border-border">
                            <div className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} vuelos
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setParams({ offset: Math.max(0, params.offset - itemsPerPage) })} disabled={currentPage === 1 || isPending} className={`p-2 rounded-lg transition-colors ${currentPage === 1 || isPending ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronLeft className="w-5 h-5" /></button>
                                <div className="flex gap-1">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                                        return (
                                            <button key={pageNum} onClick={() => setParams({ offset: (pageNum - 1) * itemsPerPage })} disabled={isPending} className={`px-3 py-1 rounded-lg transition-colors ${currentPage === pageNum ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button onClick={() => setParams({ offset: Math.min((totalPages - 1) * itemsPerPage, params.offset + itemsPerPage) })} disabled={currentPage === totalPages || isPending} className={`p-2 rounded-lg transition-colors ${currentPage === totalPages || isPending ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-foreground hover:bg-muted'}`}><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )}
                </PageTableContainer>
            </div>
        </div>
    );
};

export default Flights;
