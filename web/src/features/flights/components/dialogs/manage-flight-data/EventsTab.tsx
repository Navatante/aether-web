// Tab de eventos (CRUD de /events; nombres desde el lookup event-names).

import React, { useState } from 'react';
import { useLogger } from '@/lib/logger';
import { http } from '@/lib/http';
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
