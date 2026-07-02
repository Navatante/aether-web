// Tab de eventos (CRUD de /events; nombres desde el lookup event-names).

import React, { useState } from 'react';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/shared/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, Calendar } from "lucide-react";
import { useEventsManage, type EventManageLookup, useEventNamesLookup } from "@/shared/hooks";
import { type DeleteTarget, EmptyState, ErrorBanner, LoadingState } from './shared';

type EventFormMode = 'list' | 'add';

export function EventsTab({
    onDeleteRequest,
}: {
    onDeleteRequest: (target: DeleteTarget) => void;
}) {
    const log = useLogger('ManageFlightDataDialog.Events');
    const { id: escId } = useEscuadrilla();
    const { data: events, loading, error: fetchError } = useEventsManage();
    const { data: eventNames, loading: namesLoading } = useEventNamesLookup();

    // POST /events. Invalida tanto la lista de gestión como el selector de
    // eventos del formulario de vuelo (dos queries distintas) de una vez.
    const createEvent = useApiMutation<void, { event_name: string; event_place: string }>(
        'POST',
        '/events',
        {
            invalidateKeys: [
                queryKeys.lookups.eventsManage(escId ?? 0),
                queryKeys.lookups.eventsLookup(escId ?? 0),
            ],
        },
    );

    const [mode, setMode] = useState<EventFormMode>('list');
    const [eventName, setEventName] = useState('');
    const [eventPlace, setEventPlace] = useState('');
    const [error, setError] = useState<string | null>(null);

    const reset = () => { setMode('list'); setEventName(''); setEventPlace(''); setError(null); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName) { setError('Selecciona un nombre de evento'); return; }
        if (!eventPlace.trim()) { setError('El lugar es obligatorio'); return; }
        setError(null);
        try {
            await createEvent.mutateAsync({
                event_name: eventName,
                event_place: eventPlace.trim(),
            });
            log.info(`Evento '${eventName}' en '${eventPlace}' añadido`);
            reset();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error añadiendo evento: ${err}`);
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
                                                    className="h-8 w-8 text-danger hover:text-danger hover:bg-danger-muted"
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
                        <Label htmlFor="event-name-trigger">Nombre del evento</Label>
                        <Select value={eventName} onValueChange={(value) => setEventName(value ?? '')} disabled={namesLoading}>
                            <SelectTrigger id="event-name-trigger">
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
                        <Button type="button" variant="outline" onClick={reset} disabled={createEvent.isPending}>Cancelar</Button>
                        <Button type="submit" disabled={createEvent.isPending}>
                            {createEvent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Añadir
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </>
    );
}
