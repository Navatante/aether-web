// Tab de aeronaves (CRUD + activar/desactivar via /lookups/aircrafts).

import React, { useState } from 'react';
import { useLogger } from '@/lib/logger';
import { http } from '@/lib/http';
import { Button } from "@/components/ui/button";
import { ActionButton, DetailsRow } from "@/shared/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogFooter } from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Loader2, Helicopter, ChevronDown, ChevronRight } from "lucide-react";
import { useAircraftsManage, type AircraftManageLookup } from "@/shared/hooks";
import { type DeleteTarget, EmptyState, ErrorBanner, LoadingState } from './shared';

type AircraftFormMode = 'list' | 'add';

export function AircraftsTab({
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
