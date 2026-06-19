// Tab de aeronaves (CRUD + activar/desactivar via /lookups/aircrafts).
// El modelo de la aeronave se elige de un selector (catálogo global
// operations.aircraft_model); si no existe, se crea inline desde el mismo form.

import React, { useState } from 'react';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import { Button } from "@/components/ui/button";
import { ActionButton, DetailsRow } from "@/shared/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Loader2, Helicopter, ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
    useAircraftsManage, type AircraftManageLookup,
    useAircraftModels, type AircraftModelLookup,
} from "@/shared/hooks";
import { type DeleteTarget, EmptyState, ErrorBanner, LoadingState } from './shared';

type AircraftFormMode = 'list' | 'add';

export function AircraftsTab({
    onDeleteRequest,
}: {
    onDeleteRequest: (target: DeleteTarget) => void;
}) {
    const log = useLogger('ManageFlightDataDialog.Aircrafts');
    const { id: escId } = useEscuadrilla();
    const { data: aircrafts, loading, error: fetchError } = useAircraftsManage();
    const { data: models, loading: modelsLoading } = useAircraftModels();

    // Ambas mutaciones invalidan las dos queries de aeronaves: la de gestión
    // (esta lista) y la del selector del formulario de vuelo.
    const invalidateKeys = [
        queryKeys.lookups.aircrafts(escId ?? 0),
        queryKeys.lookups.aircraftsManage(escId ?? 0),
    ];

    const toggleFlag = useApiMutation<void, { aircraft_sk: number; current_flag: boolean }>(
        'PATCH',
        (v) => `/lookups/aircrafts/${v.aircraft_sk}`,
        { invalidateKeys, body: ({ aircraft_sk, ...rest }) => rest },
    );

    const createAircraft = useApiMutation<void, {
        registration: string; number: string; aircraft_model_sk: number;
    }>('POST', '/lookups/aircrafts', { invalidateKeys });

    const createModel = useApiMutation<{ aircraft_model_sk: number }, {
        aircraft_type: string; make: string; model: string; variant: string;
        is_multi_engine: boolean; is_multi_pilot: boolean;
    }>('POST', '/lookups/aircraft-models', {
        invalidateKeys: [queryKeys.lookups.aircraftModels(escId ?? 0)],
    });

    const [mode, setMode] = useState<AircraftFormMode>('list');
    const [registration, setRegistration] = useState('');
    const [number, setNumber] = useState('');
    const [modelSk, setModelSk] = useState('');           // value del Select (sk como string)
    const [error, setError] = useState<string | null>(null);
    const [expandedSk, setExpandedSk] = useState<number | null>(null);

    // Sub-form "nuevo modelo" embebido en el form de aeronave.
    const [addingModel, setAddingModel] = useState(false);
    const [mType, setMType] = useState('');
    const [mMake, setMMake] = useState('');
    const [mModel, setMModel] = useState('');
    const [mVariant, setMVariant] = useState('');
    const [mMultiEngine, setMMultiEngine] = useState(false);
    const [mMultiPilot, setMMultiPilot] = useState(false);

    // Fila con toggle en curso: derivado del estado de la mutación (sin useState).
    const togglingSk = toggleFlag.isPending ? toggleFlag.variables?.aircraft_sk ?? null : null;

    // Base UI Select muestra el `value` crudo (el sk); resolvemos la etiqueta
    // (modelo + variante) del modelo seleccionado para pintarla en el trigger.
    const selectedModel = (models ?? []).find((m) => String(m.aircraft_model_sk) === modelSk);

    const resetModelForm = () => {
        setAddingModel(false); setMType(''); setMMake(''); setMModel('');
        setMVariant(''); setMMultiEngine(false); setMMultiPilot(false);
    };

    const reset = () => {
        setMode('list'); setRegistration(''); setNumber(''); setModelSk('');
        setError(null); resetModelForm();
    };

    const handleToggleFlag = async (a: AircraftManageLookup, nextFlag: boolean) => {
        setError(null);
        try {
            await toggleFlag.mutateAsync({ aircraft_sk: a.aircraft_sk, current_flag: nextFlag });
            log.info(`Aeronave '${a.aircraft_registration}' ${nextFlag ? 'activada' : 'desactivada'}`);
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error actualizando estado de aeronave: ${err}`);
        }
    };

    const handleCreateModel = async () => {
        if (!mType.trim()) { setError('El tipo es obligatorio'); return; }
        if (!mMake.trim()) { setError('El fabricante es obligatorio'); return; }
        if (!mModel.trim()) { setError('El modelo es obligatorio'); return; }
        if (!mVariant.trim()) { setError('La variante es obligatoria'); return; }
        setError(null);
        try {
            const created = await createModel.mutateAsync({
                aircraft_type: mType.trim(), make: mMake.trim(),
                model: mModel.trim(), variant: mVariant.trim(),
                is_multi_engine: mMultiEngine, is_multi_pilot: mMultiPilot,
            });
            log.info(`Modelo '${mModel} ${mVariant}' añadido`);
            setModelSk(String(created.aircraft_model_sk)); // auto-selecciona el nuevo
            resetModelForm();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error añadiendo modelo: ${err}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!registration.trim()) { setError('La matrícula es obligatoria'); return; }
        if (!number.trim()) { setError('El número de cola es obligatorio'); return; }
        if (!modelSk) { setError('Selecciona un modelo de aeronave'); return; }

        setError(null);
        try {
            await createAircraft.mutateAsync({
                registration: registration.trim().toUpperCase(),
                number: number.trim(),
                aircraft_model_sk: Number(modelSk),
            });
            log.info(`Aeronave '${registration}' añadida`);
            reset();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error añadiendo aeronave: ${err}`);
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
                                                            className="h-8 w-8 text-danger hover:text-danger hover:bg-danger-muted"
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
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Identificación física de la aeronave */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Identificación
                        </legend>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="ac_registration">Matrícula</Label>
                                <Input id="ac_registration" placeholder="HU.21-01"
                                    value={registration}
                                    onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                                    maxLength={20} autoFocus className="font-mono" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ac_number">N.º de cola</Label>
                                <Input id="ac_number" placeholder="01"
                                    value={number} onChange={(e) => setNumber(e.target.value)}
                                    maxLength={20} />
                            </div>
                        </div>
                    </fieldset>

                    {/* Modelo: selector del catálogo global + alta inline */}
                    <fieldset className="space-y-3">
                        <div className="flex items-center justify-between">
                            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Modelo
                            </legend>
                            {!addingModel && (
                                <Button type="button" variant="ghost" size="sm"
                                    className="h-7 px-2 text-xs text-primary hover:text-primary"
                                    onClick={() => { setAddingModel(true); setError(null); }}>
                                    <Plus className="w-3.5 h-3.5 mr-1" />Nuevo modelo
                                </Button>
                            )}
                        </div>
                        {addingModel ? (
                            <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Plus className="w-4 h-4 text-primary" />
                                    Nuevo modelo de aeronave
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m_type">Tipo</Label>
                                        <Select value={mType} onValueChange={(value) => setMType(value ?? '')}>
                                            <SelectTrigger id="m_type" className="w-full bg-background">
                                                <SelectValue placeholder="Selecciona tipo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Helicóptero">Helicóptero</SelectItem>
                                                <SelectItem value="Avión">Avión</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m_make">Fabricante</Label>
                                        <Input id="m_make" placeholder="Airbus Helicopters"
                                            value={mMake} onChange={(e) => setMMake(e.target.value)}
                                            maxLength={50} autoFocus className="bg-background" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m_model">Modelo</Label>
                                        <Input id="m_model" placeholder="NH90"
                                            value={mModel} onChange={(e) => setMModel(e.target.value)}
                                            maxLength={50} className="bg-background" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="m_variant">Variante</Label>
                                        <Input id="m_variant" placeholder="TTH"
                                            value={mVariant} onChange={(e) => setMVariant(e.target.value)}
                                            maxLength={50} className="bg-background" />
                                    </div>
                                </div>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={mMultiEngine}
                                            onChange={(e) => setMMultiEngine(e.target.checked)}
                                            className="w-4 h-4 accent-primary" />
                                        <span className="text-sm">Multimotor</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={mMultiPilot}
                                            onChange={(e) => setMMultiPilot(e.target.checked)}
                                            className="w-4 h-4 accent-primary" />
                                        <span className="text-sm">Multipiloto</span>
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                                    <Button type="button" variant="outline" size="sm"
                                        onClick={() => { resetModelForm(); setError(null); }}
                                        disabled={createModel.isPending}>Cancelar</Button>
                                    <Button type="button" size="sm"
                                        onClick={handleCreateModel} disabled={createModel.isPending}>
                                        {createModel.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar modelo
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Select value={modelSk} onValueChange={(value) => setModelSk(value ?? '')} disabled={modelsLoading}>
                                    <SelectTrigger id="ac_model" className="w-full">
                                        <SelectValue>
                                            {selectedModel
                                                ? `${selectedModel.aircraft_model} ${selectedModel.aircraft_variant}`
                                                : (modelsLoading ? 'Cargando...' : 'Selecciona un modelo')}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(models ?? []).map((m: AircraftModelLookup) => (
                                            <SelectItem key={m.aircraft_model_sk} value={String(m.aircraft_model_sk)}>
                                                {m.aircraft_model} {m.aircraft_variant}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedModel && (
                                    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">{selectedModel.aircraft_type}</span>
                                        <span aria-hidden>·</span>
                                        <span>{selectedModel.aircraft_make}</span>
                                        {selectedModel.aircraft_is_multi_engine && (
                                            <Badge variant="secondary" className="ml-auto">Multimotor</Badge>
                                        )}
                                        {selectedModel.aircraft_is_multi_pilot && (
                                            <Badge variant="secondary" className={selectedModel.aircraft_is_multi_engine ? '' : 'ml-auto'}>Multipiloto</Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </fieldset>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={reset} disabled={createAircraft.isPending}>Cancelar</Button>
                        <Button type="submit" disabled={createAircraft.isPending || addingModel}>
                            {createAircraft.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Añadir aeronave
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </>
    );
}
