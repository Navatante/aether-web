// Formulario de alta/edición de Horas extra (solo render).
// La lógica vive en hooks/useRegisterExtraHours.

import Select from 'react-select';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select as TypeSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/shared/components/common';
import { getSelectClassNames, menuPortalStyles } from '@/lib/reactSelectClassNames';
import { useRegisterExtraHours } from '../../hooks/useRegisterExtraHours';
import type { ExtraHourItem } from '@/types/generated/extrahours';

interface RegisterExtraHoursFormProps {
    mode: 'create' | 'edit';
    initial?: ExtraHourItem;
    onClose: () => void;
}

// Campos de horas (key del estado, etiqueta visible).
const HOUR_FIELDS = [
    { key: 'day', label: 'Día' },
    { key: 'convNight', label: 'Noche' },
    { key: 'gvn', label: 'GVN' },
    { key: 'inst', label: 'Instrumental' },
    { key: 'cta', label: 'HAC' },
] as const;

export default function RegisterExtraHoursForm({ mode, initial, onClose }: RegisterExtraHoursFormProps) {
    const {
        person, setPerson, date, setDate, model, setModel, isReal, setIsReal,
        cta, setCta, day, setDay, convNight, setConvNight, gvn, setGvn, inst, setInst,
        remarks, setRemarks,
        error, isSubmitting, canSubmit,
        personArray, personsLoading,
        modelArray, modelsLoading,
        addingModel, setAddingModel,
        mType, setMType, mMake, setMMake, mModel, setMModel, mVariant, setMVariant,
        mMultiEngine, setMMultiEngine, mMultiPilot, setMMultiPilot,
        creatingModel, handleCreateModel,
        handleSubmit,
    } = useRegisterExtraHours({ mode, initial, onClose });

    const hourState: Record<string, [string, (v: string) => void]> = {
        cta: [cta, setCta], day: [day, setDay], convNight: [convNight, setConvNight],
        gvn: [gvn, setGvn], inst: [inst, setInst],
    };

    const personOptions = personArray.map((p) => ({ value: p.person_sk, label: p.person_nk }));
    const selectedPerson = personOptions.find((o) => o.value === person) ?? null;

    const modelOptions = modelArray.map((m) => ({
        value: m.aircraft_model_sk,
        label: [m.aircraft_make, m.aircraft_model, m.aircraft_variant].filter(Boolean).join(' '),
    }));
    const selectedModel = modelOptions.find((o) => o.value === model) ?? null;

    const isEdit = mode === 'edit';

    return (
        <div className="space-y-6">
            {/* Persona */}
            <div className="grid gap-2">
                <Label className="text-foreground">Persona</Label>
                {isEdit ? (
                    <div className="px-3 py-2 border border-border rounded-md bg-muted/50 text-sm text-foreground">
                        {initial?.persona ?? selectedPerson?.label ?? `#${person}`}
                        {initial?.personaNk && (
                            <span className="text-xs text-muted-foreground ml-2">{initial.personaNk}</span>
                        )}
                    </div>
                ) : (
                    <Select
                        value={selectedPerson}
                        onChange={(opt) => setPerson(opt ? opt.value : null)}
                        options={personOptions}
                        placeholder={personsLoading ? 'Cargando personas...' : 'Seleccione una persona'}
                        isLoading={personsLoading}
                        isDisabled={personsLoading}
                        isSearchable
                        classNames={getSelectClassNames(false, person != null)}
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={menuPortalStyles}
                        noOptionsMessage={() => 'Sin personas'}
                    />
                )}
            </div>

            {/* Modelo de aeronave: selector del catálogo global + alta inline */}
            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label className="text-foreground">Modelo de aeronave</Label>
                    {!addingModel && (
                        <Button type="button" variant="ghost" size="sm"
                            className="h-7 px-2 text-xs text-primary hover:text-primary"
                            onClick={() => setAddingModel(true)}>
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
                            <div className="grid gap-1.5">
                                <Label htmlFor="m_type">Tipo</Label>
                                <TypeSelect value={mType} onValueChange={(value) => setMType(value ?? '')}>
                                    <SelectTrigger id="m_type" className="w-full bg-background">
                                        <SelectValue placeholder="Selecciona tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Helicóptero">Helicóptero</SelectItem>
                                        <SelectItem value="Avión">Avión</SelectItem>
                                    </SelectContent>
                                </TypeSelect>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="m_make">Fabricante</Label>
                                <Input id="m_make" placeholder="Airbus Helicopters"
                                    value={mMake} onChange={(e) => setMMake(e.target.value)}
                                    maxLength={50} className="bg-background" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="m_model">Modelo</Label>
                                <Input id="m_model" placeholder="NH90"
                                    value={mModel} onChange={(e) => setMModel(e.target.value)}
                                    maxLength={50} className="bg-background" />
                            </div>
                            <div className="grid gap-1.5">
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
                                onClick={() => setAddingModel(false)}
                                disabled={creatingModel}>Cancelar</Button>
                            <Button type="button" size="sm"
                                onClick={handleCreateModel} disabled={creatingModel}>
                                {creatingModel && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar modelo
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Select
                        value={selectedModel}
                        onChange={(opt) => setModel(opt ? opt.value : null)}
                        options={modelOptions}
                        placeholder={modelsLoading ? 'Cargando modelos...' : 'Seleccione un modelo'}
                        isLoading={modelsLoading}
                        isDisabled={modelsLoading}
                        isSearchable
                        classNames={getSelectClassNames(false, model != null)}
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={menuPortalStyles}
                        noOptionsMessage={() => 'Sin modelos'}
                    />
                )}
            </div>

            {/* Fecha + Tipo */}
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label className="text-foreground">Fecha</Label>
                    <DatePicker value={date} onChange={setDate} placeholder="Seleccionar fecha" />
                </div>
                <div className="grid gap-2">
                    <Label className="text-foreground">Tipo</Label>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={isReal ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setIsReal(true)}
                        >
                            Real
                        </Button>
                        <Button
                            type="button"
                            variant={!isReal ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setIsReal(false)}
                        >
                            Simulador
                        </Button>
                    </div>
                </div>
            </div>

            {/* Horas */}
            <div className="grid grid-cols-3 gap-4">
                {HOUR_FIELDS.map(({ key, label }) => {
                    const [value, setValue] = hourState[key];
                    return (
                        <div key={key} className="grid gap-2">
                            <Label className="text-foreground">{label}</Label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                min="0"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Observaciones */}
            <div className="grid gap-2">
                <Label className="text-foreground">Observaciones</Label>
                <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    maxLength={200}
                    rows={3}
                    placeholder="Opcional"
                />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            {/* Acciones */}
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit || addingModel}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                </Button>
            </div>
        </div>
    );
}
