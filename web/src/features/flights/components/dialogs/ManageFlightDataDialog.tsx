import React, { useState } from 'react';
import { useLogger } from '@/lib/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/shared/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {Trash2, Loader2, Database, MapPinPlusInside, Helicopter, Calendar, ChevronDown, ChevronRight} from "lucide-react";
import { cn } from "@/lib/utils";
import { http } from "@/lib/http";
import { DetailsRow } from "@/shared/components/common";
import {
    useDepartureArrivalPlaces, type DepartureArrivalPlaceLookup,
    useAircraftsManage, type AircraftManageLookup,
    useEventsManage, type EventManageLookup,
    useEventNamesLookup,
} from "@/shared/hooks";

// ============================================================================
// Types
// ============================================================================

type TabId = 'lugares' | 'aeronaves' | 'eventos';

interface DeleteTarget {
    type: TabId;
    sk: number;
    label: string;
}

interface ManageFlightDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRefresh: {
        places: () => Promise<unknown>;
        aircrafts: () => Promise<unknown>;
        events: () => Promise<unknown>;
    };
}

// ============================================================================
// Sub-components
// ============================================================================

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-slate-600 dark:text-slate-300">Cargando...</span>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="p-8 text-center text-muted-foreground">{text}</div>
    );
}

// ============================================================================
// Places tab
// ============================================================================

type PlaceFormMode = 'list' | 'add';

function PlacesTab({
    onRefresh,
    onDeleteRequest,
}: {
    onRefresh: () => Promise<unknown>;
    onDeleteRequest: (target: DeleteTarget) => void;
}) {
    const log = useLogger('ManageFlightDataDialog.Places');
    const { data: places, loading, error: fetchError, refetch } = useDepartureArrivalPlaces();

    const [mode, setMode] = useState<PlaceFormMode>('list');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => { setMode('list'); setCode(''); setName(''); setError(null); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) { setError('El código es obligatorio'); return; }
        if (!name.trim()) { setError('El nombre es obligatorio'); return; }
        setSaving(true); setError(null);
        try {
            await http<void>('POST', '/lookups/departure-arrival-places', {
                body: {
                    code: code.trim().toUpperCase(),
                    name: name.trim(),
                },
            });
            await refetch();
            await onRefresh();
            log.info(`Lugar '${name}' añadido`);
            reset();
        } catch (err) {
            log.error(`Error añadiendo lugar: ${err}`);
            setError(String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {error && <ErrorBanner message={error} />}
            {fetchError && !error && <ErrorBanner message={fetchError} />}

            {mode === 'list' ? (
                <>
                    <div className="flex justify-end mb-2">
                        <ActionButton
                            variant="add"
                            size="sm"
                            icon={MapPinPlusInside}
                            label="Añadir lugar"
                            onClick={() => { setMode('add'); setError(null); }}
                        />
                    </div>
                    <div className="flex-1 overflow-auto border rounded-lg">
                        {loading ? <LoadingState /> : !places?.length ? (
                            <EmptyState text="No hay lugares registrados" />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="w-[60px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {places.map((p: DepartureArrivalPlaceLookup) => (
                                        <TableRow key={p.departure_arrival_place_sk}>
                                            <TableCell className="font-mono font-medium">{p.departure_arrival_place_code}</TableCell>
                                            <TableCell>{p.departure_arrival_place_name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon"
                                                    onClick={() => onDeleteRequest({
                                                        type: 'lugares',
                                                        sk: p.departure_arrival_place_sk,
                                                        label: `${p.departure_arrival_place_name} (${p.departure_arrival_place_code})`,
                                                    })}
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="place_code">Código OACI</Label>
                        <Input id="place_code" placeholder="LELL" value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            maxLength={20} autoFocus />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="place_name">Nombre</Label>
                        <Input id="place_name" placeholder="Sabadell" value={name}
                            onChange={(e) => setName(e.target.value)} maxLength={100} />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={reset} disabled={saving}>Cancelar</Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Añadir
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </>
    );
}

// ============================================================================
// Aircraft tab
// ============================================================================

type AircraftFormMode = 'list' | 'add';

function AircraftsTab({
    onRefresh,
    onDeleteRequest,
}: {
    onRefresh: () => Promise<unknown>;
    onDeleteRequest: (target: DeleteTarget) => void;
}) {
    const log = useLogger('ManageFlightDataDialog.Aircrafts');
    const { data: aircrafts, loading, error: fetchError, refetch } = useAircraftsManage();

    const [mode, setMode] = useState<AircraftFormMode>('list');
    const [registration, setRegistration] = useState('');
    const [number, setNumber] = useState('');
    const [aircraftType, setAircraftType] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [variant, setVariant] = useState('');
    const [isMultiEngine, setIsMultiEngine] = useState(false);
    const [isMultiPilot, setIsMultiPilot] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [togglingSk, setTogglingSk] = useState<number | null>(null);
    const [expandedSk, setExpandedSk] = useState<number | null>(null);

    const reset = () => {
        setMode('list'); setRegistration(''); setNumber(''); setAircraftType('');
        setMake(''); setModel(''); setVariant(''); setIsMultiEngine(false);
        setIsMultiPilot(false); setError(null);
    };

    const handleToggleFlag = async (a: AircraftManageLookup, nextFlag: boolean) => {
        setTogglingSk(a.aircraft_sk);
        setError(null);
        try {
            await http<void>('PATCH', `/lookups/aircrafts/${a.aircraft_sk}`, {
                body: { current_flag: nextFlag },
            });
            await refetch();
            await onRefresh();
            log.info(`Aeronave '${a.aircraft_registration}' ${nextFlag ? 'activada' : 'desactivada'}`);
        } catch (err) {
            log.error(`Error actualizando estado de aeronave: ${err}`);
            setError(String(err));
        } finally {
            setTogglingSk(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!registration.trim()) { setError('La matrícula es obligatoria'); return; }
        if (!number.trim()) { setError('El número de cola es obligatorio'); return; }
        if (!aircraftType.trim()) { setError('El tipo es obligatorio'); return; }
        if (!make.trim()) { setError('El fabricante es obligatorio'); return; }
        if (!model.trim()) { setError('El modelo es obligatorio'); return; }
        if (!variant.trim()) { setError('La variante es obligatoria'); return; }

        setSaving(true); setError(null);
        try {
            await http<void>('POST', '/lookups/aircrafts', {
                body: {
                    registration: registration.trim().toUpperCase(),
                    number: number.trim(),
                    aircraft_type: aircraftType.trim(),
                    make: make.trim(),
                    model: model.trim(),
                    variant: variant.trim(),
                    is_multi_engine: isMultiEngine,
                    is_multi_pilot: isMultiPilot,
                },
            });
            await refetch();
            await onRefresh();
            log.info(`Aeronave '${registration}' añadida`);
            reset();
        } catch (err) {
            log.error(`Error añadiendo aeronave: ${err}`);
            setError(String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {error && <ErrorBanner message={error} />}
            {fetchError && !error && <ErrorBanner message={fetchError} />}

            {mode === 'list' ? (
                <>
                    <div className="flex justify-end mb-2">
                        <ActionButton
                            variant="add"
                            size="sm"
                            icon={Helicopter}
                            label="Añadir aeronave"
                            onClick={() => { setMode('add'); setError(null); }}
                        />
                    </div>
                    <div className="flex-1 overflow-auto border rounded-lg">
                        {loading ? <LoadingState /> : !aircrafts?.length ? (
                            <EmptyState text="No hay aeronaves registradas" />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]" />
                                        <TableHead>Matrícula</TableHead>
                                        <TableHead className="w-[80px]">N.º cola</TableHead>
                                        <TableHead className="w-[80px]">Activa</TableHead>
                                        <TableHead className="w-[60px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {aircrafts.map((a: AircraftManageLookup) => {
                                        const isExpanded = expandedSk === a.aircraft_sk;
                                        return (
                                            <React.Fragment key={a.aircraft_sk}>
                                                <TableRow
                                                    className="cursor-pointer"
                                                    onClick={() => setExpandedSk(prev => prev === a.aircraft_sk ? null : a.aircraft_sk)}
                                                >
                                                    <TableCell className="text-muted-foreground">
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </TableCell>
                                                    <TableCell className="font-mono">{a.aircraft_registration}</TableCell>
                                                    <TableCell>{a.aircraft_number}</TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                id={`aircraft-flag-${a.aircraft_sk}`}
                                                                checked={a.aircraft_current_flag}
                                                                onCheckedChange={(checked) => handleToggleFlag(a, checked)}
                                                                disabled={togglingSk !== null}
                                                                aria-label={a.aircraft_current_flag ? 'Desactivar aeronave' : 'Activar aeronave'}
                                                            />
                                                            {togglingSk === a.aircraft_sk && (
                                                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon"
                                                            onClick={() => onDeleteRequest({
                                                                type: 'aeronaves',
                                                                sk: a.aircraft_sk,
                                                                label: `${a.aircraft_registration} (${a.aircraft_number})`,
                                                            })}
                                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <DetailsRow colSpan={5}>
                                                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                                            <div><span className="text-muted-foreground">Tipo:</span> {a.aircraft_type}</div>
                                                            <div><span className="text-muted-foreground">Fabricante:</span> {a.aircraft_make}</div>
                                                            <div><span className="text-muted-foreground">Modelo:</span> {a.aircraft_model}</div>
                                                            <div><span className="text-muted-foreground">Variante:</span> {a.aircraft_variant}</div>
                                                            <div><span className="text-muted-foreground">Multimotor:</span> {a.aircraft_is_multi_engine ? 'Sí' : 'No'}</div>
                                                            <div><span className="text-muted-foreground">Multipiloto:</span> {a.aircraft_is_multi_pilot ? 'Sí' : 'No'}</div>
                                                        </div>
                                                    </DetailsRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="ac_registration">Matrícula</Label>
                            <Input id="ac_registration" placeholder="HU.21-01"
                                value={registration}
                                onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                                maxLength={20} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ac_number">N.º de cola</Label>
                            <Input id="ac_number" placeholder="01"
                                value={number} onChange={(e) => setNumber(e.target.value)}
                                maxLength={20} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ac_type">Tipo</Label>
                            <Input id="ac_type" placeholder="Helicóptero"
                                value={aircraftType} onChange={(e) => setAircraftType(e.target.value)}
                                maxLength={50} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ac_make">Fabricante</Label>
                            <Input id="ac_make" placeholder="Airbus"
                                value={make} onChange={(e) => setMake(e.target.value)}
                                maxLength={50} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ac_model">Modelo</Label>
                            <Input id="ac_model" placeholder="H215"
                                value={model} onChange={(e) => setModel(e.target.value)}
                                maxLength={50} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ac_variant">Variante</Label>
                            <Input id="ac_variant" placeholder="Super Puma"
                                value={variant} onChange={(e) => setVariant(e.target.value)}
                                maxLength={50} />
                        </div>
                    </div>

                    <div className="flex gap-6 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isMultiEngine}
                                onChange={(e) => setIsMultiEngine(e.target.checked)}
                                className="w-4 h-4 accent-primary" />
                            <span className="text-sm">Multimotor</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isMultiPilot}
                                onChange={(e) => setIsMultiPilot(e.target.checked)}
                                className="w-4 h-4 accent-primary" />
                            <span className="text-sm">Multipiloto</span>
                        </label>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={reset} disabled={saving}>Cancelar</Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Añadir
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </>
    );
}

// ============================================================================
// Events tab
// ============================================================================

type EventFormMode = 'list' | 'add';

function EventsTab({
    onRefresh,
    onDeleteRequest,
}: {
    onRefresh: () => Promise<unknown>;
    onDeleteRequest: (target: DeleteTarget) => void;
}) {
    const log = useLogger('ManageFlightDataDialog.Events');
    const { data: events, loading, error: fetchError, refetch } = useEventsManage();
    const { data: eventNames, loading: namesLoading } = useEventNamesLookup();

    const [mode, setMode] = useState<EventFormMode>('list');
    const [eventName, setEventName] = useState('');
    const [eventPlace, setEventPlace] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => { setMode('list'); setEventName(''); setEventPlace(''); setError(null); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName) { setError('Selecciona un nombre de evento'); return; }
        if (!eventPlace.trim()) { setError('El lugar es obligatorio'); return; }
        setSaving(true); setError(null);
        try {
            await http<void>('POST', '/events', {
                body: {
                    event_name: eventName,
                    event_place: eventPlace.trim(),
                },
            });
            await refetch();
            await onRefresh();
            log.info(`Evento '${eventName}' en '${eventPlace}' añadido`);
            reset();
        } catch (err) {
            log.error(`Error añadiendo evento: ${err}`);
            setError(String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {error && <ErrorBanner message={error} />}
            {fetchError && !error && <ErrorBanner message={fetchError} />}

            {mode === 'list' ? (
                <>
                    <div className="flex justify-end mb-2">
                        <ActionButton
                            variant="add"
                            size="sm"
                            icon={Calendar}
                            label="Añadir evento"
                            onClick={() => { setMode('add'); setError(null); }}
                        />
                    </div>
                    <div className="flex-1 overflow-auto border rounded-lg">
                        {loading ? <LoadingState /> : !events?.length ? (
                            <EmptyState text="No hay eventos registrados" />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Lugar</TableHead>
                                        <TableHead className="w-[60px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.map((ev: EventManageLookup) => (
                                        <TableRow key={ev.event_sk}>
                                            <TableCell className="font-medium">{ev.event_name}</TableCell>
                                            <TableCell>{ev.event_place}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon"
                                                    onClick={() => onDeleteRequest({
                                                        type: 'eventos',
                                                        sk: ev.event_sk,
                                                        label: `${ev.event_name} — ${ev.event_place}`,
                                                    })}
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre del evento</Label>
                        <Select value={eventName} onValueChange={(value) => setEventName(value ?? '')} disabled={namesLoading}>
                            <SelectTrigger>
                                <SelectValue placeholder={namesLoading ? 'Cargando...' : 'Selecciona un nombre'} />
                            </SelectTrigger>
                            <SelectContent>
                                {(eventNames ?? []).map((name: string) => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ev_place">Lugar</Label>
                        <Input id="ev_place" placeholder="Base Aérea de Rota"
                            value={eventPlace} onChange={(e) => setEventPlace(e.target.value)}
                            maxLength={100} autoFocus />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={reset} disabled={saving}>Cancelar</Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Añadir
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </>
    );
}

// ============================================================================
// Main dialog
// ============================================================================

const TABS: { id: TabId; label: string }[] = [
    { id: 'lugares', label: 'Lugares' },
    { id: 'aeronaves', label: 'Aeronaves' },
    { id: 'eventos', label: 'Eventos' },
];

export default function ManageFlightDataDialog({ open, onOpenChange, onRefresh }: ManageFlightDataDialogProps): React.ReactElement {
    const log = useLogger('ManageFlightDataDialog');

    const { refetch: refetchPlaces } = useDepartureArrivalPlaces();
    const { refetch: refetchAircrafts } = useAircraftsManage();
    const { refetch: refetchEvents } = useEventsManage();

    const [activeTab, setActiveTab] = useState<TabId>('lugares');
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleClose = () => {
        setActiveTab('lugares');
        setDeleteTarget(null);
        setDeleteError(null);
        onOpenChange(false);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        const target = deleteTarget;
        setDeleteTarget(null);
        try {
            if (target.type === 'lugares') {
                await http<void>('DELETE', `/lookups/departure-arrival-places/${target.sk}`);
                await refetchPlaces();
                await onRefresh.places();
            } else if (target.type === 'aeronaves') {
                await http<void>('DELETE', `/lookups/aircrafts/${target.sk}`);
                await refetchAircrafts();
                await onRefresh.aircrafts();
            } else {
                await http<void>('DELETE', `/events/${target.sk}`);
                await refetchEvents();
                await onRefresh.events();
            }
            log.info(`Eliminado: ${target.label}`);
        } catch (err) {
            log.error(`Error eliminando ${target.type}: ${err}`);
            setDeleteError(String(err));
        } finally {
            setDeleting(false);
        }
    };

    const tabDescriptions: Record<TabId, string> = {
        lugares: 'Gestiona los lugares disponibles para los selectores de salida y llegada.',
        aeronaves: 'Gestiona las aeronaves disponibles para el registro de vuelos.',
        eventos: 'Gestiona los eventos disponibles para el registro de vuelos.',
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); else onOpenChange(true); }}>
                <DialogContent
                    overlayClassName="bg-black/5! supports-backdrop-filter:backdrop-blur-sm!"
                    className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl ring-2 ring-foreground/20"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Database className="w-5 h-5" />
                            Gestión de datos generales de vuelo
                        </DialogTitle>
                        <DialogDescription>
                            {tabDescriptions[activeTab]}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tab navigation */}
                    <div className="flex border-b border-border -mx-1 px-1">
                        {TABS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setActiveTab(id)}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                                    activeTab === id
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {deleteError && <ErrorBanner message={deleteError} />}

                    {/* Tab content */}
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-2">
                        {activeTab === 'lugares' && (
                            <PlacesTab
                                onRefresh={onRefresh.places}
                                onDeleteRequest={setDeleteTarget}
                            />
                        )}
                        {activeTab === 'aeronaves' && (
                            <AircraftsTab
                                onRefresh={onRefresh.aircrafts}
                                onDeleteRequest={setDeleteTarget}
                            />
                        )}
                        {activeTab === 'eventos' && (
                            <EventsTab
                                onRefresh={onRefresh.events}
                                onDeleteRequest={setDeleteTarget}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirmación de eliminación compartida */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar elemento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget && (
                                <>
                                    Vas a eliminar <strong>{deleteTarget.label}</strong>.
                                    {' '}Esta acción fallará si el elemento está siendo usado en vuelos registrados.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={deleting}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
