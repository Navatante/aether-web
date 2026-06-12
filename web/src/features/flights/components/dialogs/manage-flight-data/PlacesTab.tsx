// Tab de lugares de salida/llegada (CRUD de /lookups/departure-arrival-places).

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
import { Trash2, Loader2, MapPinPlusInside } from "lucide-react";
import { useDepartureArrivalPlaces, type DepartureArrivalPlaceLookup } from "@/shared/hooks";
import { type DeleteTarget, EmptyState, ErrorBanner, LoadingState } from './shared';

type PlaceFormMode = 'list' | 'add';

export function PlacesTab({
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
