// Tab de capacidades básicas (capba) de la escuadrilla.
// Gestiona operations.escuadrilla_capba: asignar capbas del catálogo global,
// editar su capacidad operativa y desasignarlas. Es por-escuadrilla (RLS),
// no toca el catálogo global compartido.

import React, { useState } from 'react';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import Select from "react-select";
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
import { Trash2, Loader2, Layers, Pencil, Check, X } from "lucide-react";
import { useCapbaCatalog, useEscuadrillaCapbas, type EscuadrillaCapbaLookup } from "@/shared/hooks";
import { menuPortalStyles } from '../../../utils';
import { type DeleteTarget, EmptyState, ErrorBanner, LoadingState } from './shared';

type CapbaFormMode = 'list' | 'add';

interface CatalogOption {
    value: number;
    label: string;
}

export function CapbasTab({
    onDeleteRequest,
}: {
    onDeleteRequest: (target: DeleteTarget) => void;
}) {
    const log = useLogger('ManageFlightDataDialog.Capba');
    const { id: escId } = useEscuadrilla();
    const { data: assigned, loading, error: fetchError } = useEscuadrillaCapbas();
    const { data: catalog, loading: catalogLoading, error: catalogError } = useCapbaCatalog();

    // Ambas mutaciones invalidan la vista de gestión y el selector del formulario
    // de vuelo (useCapbas), que solo muestra las capbas asignadas a la escuadrilla.
    const invalidateKeys = [
        queryKeys.lookups.escuadrillaCapbas(escId ?? 0),
        queryKeys.lookups.capbas(escId ?? 0),
    ];

    const createCapba = useApiMutation<void, { capba_id: number; capacidad_operativa: number }>(
        'POST', '/lookups/escuadrilla-capbas', { invalidateKeys },
    );

    const updateCapba = useApiMutation<void, { escuadrilla_capba_sk: number; capacidad_operativa: number }>(
        'PATCH',
        (v) => `/lookups/escuadrilla-capbas/${v.escuadrilla_capba_sk}`,
        { invalidateKeys, body: ({ escuadrilla_capba_sk, ...rest }) => rest },
    );

    const [mode, setMode] = useState<CapbaFormMode>('list');
    const [selectedCapba, setSelectedCapba] = useState<CatalogOption | null>(null);
    const [capacidad, setCapacidad] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Edición inline de la capacidad operativa de una fila.
    const [editingSk, setEditingSk] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    // Catálogo sin las capbas ya asignadas a la escuadrilla.
    const assignedIds = new Set((assigned ?? []).map(c => c.capba_id));
    const catalogOptions: CatalogOption[] = (catalog ?? [])
        .filter(c => !assignedIds.has(c.capba_id))
        .map(c => ({ value: c.capba_id, label: `${c.capba_id} — ${c.capba_name}` }));

    const selectClassNames = {
        control: (s: { isFocused: boolean }) =>
            `react-select-control${selectedCapba ? ' react-select-control--filled' : ''}${s.isFocused ? ' react-select-control--focused' : ''}`,
        valueContainer: () => 'react-select-value-container',
        singleValue: () => 'react-select-single-value',
        placeholder: () => 'react-select-placeholder',
        input: () => 'react-select-input',
        menu: () => 'react-select-menu',
        menuList: () => 'react-select-menu-list',
        option: (s: { isFocused: boolean; isSelected: boolean }) =>
            `react-select-option${s.isFocused ? ' react-select-option--focused' : ''}${s.isSelected ? ' react-select-option--selected' : ''}`,
        indicatorSeparator: () => 'react-select-indicator-separator',
        dropdownIndicator: () => 'react-select-dropdown-indicator',
        clearIndicator: () => 'react-select-clear-indicator',
        loadingIndicator: () => 'react-select-loading-indicator',
    };

    const reset = () => {
        setMode('list'); setSelectedCapba(null); setCapacidad(''); setError(null);
    };

    const parseCapacidad = (raw: string): number | null => {
        if (!/^\d+$/.test(raw.trim())) return null;
        return parseInt(raw, 10);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCapba) { setError('Selecciona una capacidad básica'); return; }
        const cap = parseCapacidad(capacidad);
        if (cap === null) { setError('La capacidad operativa debe ser un número entero ≥ 0'); return; }

        setError(null);
        try {
            await createCapba.mutateAsync({ capba_id: selectedCapba.value, capacidad_operativa: cap });
            log.info(`Capba '${selectedCapba.label}' asignada (capacidad ${cap})`);
            reset();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error asignando capba: ${err}`);
        }
    };

    const startEdit = (c: EscuadrillaCapbaLookup) => {
        setEditingSk(c.escuadrilla_capba_sk);
        setEditValue(String(c.escuadrilla_capba_capacidad_operativa));
        setError(null);
    };

    const cancelEdit = () => { setEditingSk(null); setEditValue(''); };

    const saveEdit = async (c: EscuadrillaCapbaLookup) => {
        const cap = parseCapacidad(editValue);
        if (cap === null) { setError('La capacidad operativa debe ser un número entero ≥ 0'); return; }
        setError(null);
        try {
            await updateCapba.mutateAsync({ escuadrilla_capba_sk: c.escuadrilla_capba_sk, capacidad_operativa: cap });
            log.info(`Capacidad de '${c.capba_name}' actualizada a ${cap}`);
            cancelEdit();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error actualizando capacidad: ${err}`);
        }
    };

    const savingSk = updateCapba.isPending ? updateCapba.variables?.escuadrilla_capba_sk ?? null : null;

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
                            icon={Layers}
                            label="Asignar CAPBA"
                            onClick={() => { setMode('add'); setError(null); }}
                        />
                    </div>
                    <div className="flex-1 overflow-auto border rounded-lg">
                        {loading ? <LoadingState /> : !assigned?.length ? (
                            <EmptyState text="No hay capacidades básicas asignadas a la escuadrilla" />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60px]">Código</TableHead>
                                        <TableHead>Capacidad básica</TableHead>
                                        <TableHead className="w-[120px]">C. operativa</TableHead>
                                        <TableHead className="w-[90px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assigned.map((c: EscuadrillaCapbaLookup) => {
                                        const isEditing = editingSk === c.escuadrilla_capba_sk;
                                        return (
                                            <TableRow key={c.escuadrilla_capba_sk}>
                                                <TableCell className="font-mono text-muted-foreground">{c.capba_id}</TableCell>
                                                <TableCell className="whitespace-normal break-words">
                                                    <div className="text-sm">{c.capba_name}</div>
                                                    <div className="text-xs text-muted-foreground">{c.capba_group_name}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {isEditing ? (
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            className="h-8 w-20"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        c.escuadrilla_capba_capacidad_operativa
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon"
                                                                onClick={() => saveEdit(c)}
                                                                disabled={savingSk !== null}
                                                                className="h-8 w-8 text-success hover:text-success">
                                                                {savingSk === c.escuadrilla_capba_sk
                                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                    : <Check className="w-4 h-4" />}
                                                            </Button>
                                                            <Button variant="ghost" size="icon"
                                                                onClick={cancelEdit}
                                                                disabled={savingSk !== null}
                                                                className="h-8 w-8 text-muted-foreground">
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon"
                                                                onClick={() => startEdit(c)}
                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon"
                                                                onClick={() => onDeleteRequest({
                                                                    type: 'capba',
                                                                    sk: c.escuadrilla_capba_sk,
                                                                    label: `${c.capba_id} — ${c.capba_name}`,
                                                                })}
                                                                className="h-8 w-8 text-danger hover:text-danger hover:bg-danger-muted">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="capba_select">Capacidad básica</Label>
                        <Select<CatalogOption>
                            inputId="capba_select"
                            value={selectedCapba}
                            onChange={(opt) => setSelectedCapba(opt)}
                            options={catalogOptions}
                            placeholder="Selecciona del catálogo..."
                            isSearchable
                            isLoading={catalogLoading}
                            isDisabled={Boolean(catalogLoading || catalogError)}
                            classNames={selectClassNames}
                            classNamePrefix="react-select"
                            menuPortalTarget={document.body}
                            styles={menuPortalStyles}
                        />
                        {catalogError && <p className="text-xs text-danger">{catalogError}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="capba_capacidad">Capacidad operativa</Label>
                        <Input id="capba_capacidad" type="number" min={0} placeholder="p. ej. 2"
                            value={capacidad} onChange={(e) => setCapacidad(e.target.value)}
                            className="w-32" />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={reset} disabled={createCapba.isPending}>Cancelar</Button>
                        <Button type="submit" disabled={createCapba.isPending}>
                            {createCapba.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Asignar
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </>
    );
}
