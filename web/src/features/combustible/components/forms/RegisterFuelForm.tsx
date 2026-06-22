// Formulario de alta/edición de un repostaje de combustible (solo render).
// La lógica vive en hooks/useRegisterFuel.

import Select from 'react-select';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select as TypeSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/shared/components/common';
import { getSelectClassNames, menuPortalStyles } from '@/lib/reactSelectClassNames';
import { useRegisterFuel } from '../../hooks/useRegisterFuel';
import { FUEL_PLACE_TYPES } from '../../fuel';
import type { FuelItem } from '@/types/generated/fuel';

interface RegisterFuelFormProps {
    mode: 'create' | 'edit';
    initial?: FuelItem;
    onClose: () => void;
}

interface Option {
    value: number;
    label: string;
}

export default function RegisterFuelForm({ mode, initial, onClose }: RegisterFuelFormProps) {
    const {
        date, setDate, helo, setHelo, place, setPlace, payer, setPayer,
        event, setEvent, phase, setPhase, type, setType, qty, setQty,
        error, isSubmitting, canSubmit,
        helos, helosLoading, places, placesLoading, payers, payersLoading,
        events, eventsLoading, phases, phasesLoading, types, typesLoading,
        addingPlace, setAddingPlace, newPlaceName, setNewPlaceName,
        newPlaceType, setNewPlaceType, creatingPlace, handleCreatePlace, resetPlaceForm,
        handleSubmit,
    } = useRegisterFuel({ mode, initial, onClose });

    const heloOptions: Option[] = helos.map((a) => ({ value: a.aircraft_sk, label: a.aircraft_number }));
    const placeOptions: Option[] = places.map((p) => ({ value: p.fuel_place_sk, label: `${p.fuel_place_name} · ${p.fuel_place_type}` }));
    const payerOptions: Option[] = payers.map((p) => ({ value: p.fuel_payer_sk, label: `${p.fuel_payer_abbrev} · ${p.fuel_payer_name}` }));
    const eventOptions: Option[] = events.map((e) => ({ value: e.event_sk, label: e.event }));
    const phaseOptions: Option[] = phases.map((p) => ({ value: p.fuel_phase_sk, label: p.fuel_phase }));
    const typeOptions: Option[] = types.map((t) => ({ value: t.fuel_type_sk, label: t.fuel_type }));

    const find = (opts: Option[], v: number | null) => opts.find((o) => o.value === v) ?? null;

    const renderSelect = (
        opts: Option[], value: number | null, onChange: (v: number | null) => void,
        loading: boolean, placeholder: string, emptyMsg: string,
    ) => (
        <Select
            value={find(opts, value)}
            onChange={(opt) => onChange(opt ? opt.value : null)}
            options={opts}
            placeholder={loading ? 'Cargando...' : placeholder}
            isLoading={loading}
            isDisabled={loading}
            isSearchable
            classNames={getSelectClassNames(false, value != null)}
            classNamePrefix="react-select"
            menuPortalTarget={document.body}
            styles={menuPortalStyles}
            noOptionsMessage={() => emptyMsg}
        />
    );

    return (
        <div className="space-y-6">
            {/* Aeronave (helo) */}
            <div className="grid gap-2">
                <Label className="text-foreground">Aeronave</Label>
                {renderSelect(heloOptions, helo, setHelo, helosLoading, 'Seleccionar', 'Sin aeronaves')}
            </div>

            {/* Lugar de repostaje: selector del catálogo + alta inline */}
            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label className="text-foreground">Lugar</Label>
                    {!addingPlace && (
                        <Button type="button" variant="ghost" size="sm"
                            className="h-7 px-2 text-xs text-primary hover:text-primary"
                            onClick={() => setAddingPlace(true)}>
                            <Plus className="w-3.5 h-3.5 mr-1" />Nuevo lugar
                        </Button>
                    )}
                </div>
                {addingPlace ? (
                    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Plus className="w-4 h-4 text-primary" />
                            Nuevo lugar de repostaje
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5 min-w-0">
                                <Label htmlFor="place_name">Nombre</Label>
                                <Input id="place_name" placeholder="LEMO"
                                    value={newPlaceName} onChange={(e) => setNewPlaceName(e.target.value)}
                                    maxLength={50} className="bg-background" />
                            </div>
                            <div className="grid gap-1.5 min-w-0">
                                <Label htmlFor="place_type">Tipo</Label>
                                <TypeSelect value={newPlaceType} onValueChange={(value) => value && setNewPlaceType(value as typeof newPlaceType)}>
                                    <SelectTrigger id="place_type" className="w-full min-w-0 bg-background">
                                        <SelectValue placeholder="Selecciona tipo" className="min-w-0" />
                                    </SelectTrigger>
                                    <SelectContent alignItemWithTrigger={false} className="w-auto">
                                        {FUEL_PLACE_TYPES.map((t) => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </TypeSelect>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                            <Button type="button" variant="outline" size="sm"
                                onClick={resetPlaceForm} disabled={creatingPlace}>Cancelar</Button>
                            <Button type="button" size="sm"
                                onClick={handleCreatePlace} disabled={creatingPlace}>
                                {creatingPlace && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar lugar
                            </Button>
                        </div>
                    </div>
                ) : (
                    renderSelect(placeOptions, place, setPlace, placesLoading, 'Seleccionar', 'Sin lugares')
                )}
            </div>

            {/* Pagador + Evento */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="text-foreground">Pagador</Label>
                    {renderSelect(payerOptions, payer, setPayer, payersLoading, 'Seleccionar', 'Sin pagadores')}
                </div>
                <div className="grid gap-2">
                    <Label className="text-foreground">Evento</Label>
                    {renderSelect(eventOptions, event, setEvent, eventsLoading, 'Seleccionar', 'Sin eventos')}
                </div>
            </div>

            {/* Fase + Tipo de combustible */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="text-foreground">Fase</Label>
                    {renderSelect(phaseOptions, phase, setPhase, phasesLoading, 'Seleccionar', 'Sin fases')}
                </div>
                <div className="grid gap-2">
                    <Label className="text-foreground">Tipo</Label>
                    {renderSelect(typeOptions, type, setType, typesLoading, 'Seleccionar', 'Sin tipos')}
                </div>
            </div>

            {/* Fecha + Cantidad */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="text-foreground">Fecha</Label>
                    <DatePicker value={date} onChange={setDate} placeholder="Seleccionar" />
                </div>
                <div className="grid gap-2">
                    <Label className="text-foreground">Cantidad (litros)</Label>
                    <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="0"
                    />
                </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit || addingPlace}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                </Button>
            </div>
        </div>
    );
}
