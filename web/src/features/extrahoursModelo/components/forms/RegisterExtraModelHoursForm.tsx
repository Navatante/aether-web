// Formulario de alta/edición de Horas extra del modelo (NH-90) (solo render).
// La lógica vive en hooks/useRegisterExtraModelHours.

import Select from 'react-select';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/shared/components/common';
import { getSelectClassNames, menuPortalStyles } from '@/lib/reactSelectClassNames';
import { useRegisterExtraModelHours } from '../../hooks/useRegisterExtraModelHours';
import type { ExtraModelHourItem } from '@/types/generated/extramodelhours';

interface RegisterExtraModelHoursFormProps {
    mode: 'create' | 'edit';
    initial?: ExtraModelHourItem;
    onClose: () => void;
}

// Campos de horas (key del estado, etiqueta visible).
const HOUR_FIELDS = [
    { key: 'day', label: 'Día' },
    { key: 'convNight', label: 'Noche convencional' },
    { key: 'gvn', label: 'GVN' },
    { key: 'inst', label: 'Inst.' },
    { key: 'cta', label: 'HAC' },
] as const;

export default function RegisterExtraModelHoursForm({ mode, initial, onClose }: RegisterExtraModelHoursFormProps) {
    const {
        person, setPerson, date, setDate, isReal, setIsReal,
        cta, setCta, day, setDay, convNight, setConvNight, gvn, setGvn, inst, setInst,
        remarks, setRemarks,
        error, isSubmitting, canSubmit,
        personArray, personsLoading,
        handleSubmit,
    } = useRegisterExtraModelHours({ mode, initial, onClose });

    const hourState: Record<string, [string, (v: string) => void]> = {
        cta: [cta, setCta], day: [day, setDay], convNight: [convNight, setConvNight],
        gvn: [gvn, setGvn], inst: [inst, setInst],
    };

    const personOptions = personArray.map((p) => ({ value: p.person_sk, label: p.person_nk }));
    const selectedPerson = personOptions.find((o) => o.value === person) ?? null;
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
            <div className="grid grid-cols-2 gap-4">
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
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                </Button>
            </div>
        </div>
    );
}
