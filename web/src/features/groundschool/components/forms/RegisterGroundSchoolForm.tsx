// Formulario de alta de Ground School (solo render). La lógica vive en
// hooks/useRegisterGroundSchool.

import Select from 'react-select';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/shared/components/common';
import { getSelectClassNames, menuPortalStyles } from '@/lib/reactSelectClassNames';
import { useRegisterGroundSchool } from '../../hooks/useRegisterGroundSchool';

interface RegisterGroundSchoolFormProps {
    onClose: () => void;
}

export default function RegisterGroundSchoolForm({ onClose }: RegisterGroundSchoolFormProps) {
    const {
        date,
        setDate,
        papeleta,
        setPapeleta,
        persons,
        togglePerson,
        removePerson,
        error,
        isSubmitting,
        canSubmit,
        papeletaArray,
        papeletasLoading,
        papeletasError,
        personArray,
        personsLoading,
        handleSubmit,
    } = useRegisterGroundSchool({ onClose });

    const personOptions = personArray.map((p) => ({ value: p.person_sk, label: p.person_nk }));
    const getPersonName = (sk: number) =>
        personArray.find((p) => p.person_sk === sk)?.person_nk ?? `#${sk}`;

    const papeletaOptions = papeletaArray.map((p) => ({ value: p.papeleta_sk, label: p.papeleta_name }));
    const selectedPapeleta = papeletaOptions.find((o) => o.value.toString() === papeleta) ?? null;

    return (
        <div className="space-y-6">
            {/* Fecha */}
            <div className="grid gap-2">
                <Label className="text-foreground">Fecha</Label>
                <DatePicker
                    value={date}
                    onChange={setDate}
                    placeholder="Seleccionar fecha"
                />
            </div>

            {/* Papeleta (buscable) */}
            <div className="grid gap-2">
                <Label className="text-foreground">Papeleta</Label>
                <Select
                    value={selectedPapeleta}
                    onChange={(opt) => setPapeleta(opt ? opt.value.toString() : '')}
                    options={papeletaOptions}
                    placeholder={
                        papeletasError
                            ? 'Error al cargar papeletas'
                            : papeletasLoading
                                ? 'Cargando...'
                                : 'Seleccione una papeleta'
                    }
                    isLoading={papeletasLoading}
                    isDisabled={papeletasLoading}
                    isClearable
                    isSearchable
                    classNames={getSelectClassNames(false, !!papeleta)}
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    styles={menuPortalStyles}
                    noOptionsMessage={() => 'Sin papeletas'}
                />
            </div>

            {/* Personas (multi-select buscable) */}
            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label className="text-foreground">Personas</Label>
                    <span className="text-xs text-muted-foreground">
                        {persons.length} seleccionada(s)
                    </span>
                </div>

                {persons.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border border-border rounded-md bg-muted/50 max-h-40 overflow-y-auto">
                        {persons.map((sk) => (
                            <Badge
                                key={sk}
                                variant="secondary"
                                className="flex items-center gap-1 px-2 py-1"
                            >
                                <span className="text-xs truncate">{getPersonName(sk)}</span>
                                <button
                                    type="button"
                                    onClick={() => removePerson(sk)}
                                    className="hover:bg-destructive/20 rounded-full p-0.5 flex-shrink-0"
                                    aria-label={`Remover ${getPersonName(sk)}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}

                <Select
                    value={null}
                    onChange={(opt) => { if (opt) togglePerson(opt.value); }}
                    options={personOptions.filter((o) => !persons.includes(o.value))}
                    placeholder={personsLoading ? 'Cargando personas...' : 'Agregar persona...'}
                    isLoading={personsLoading}
                    isDisabled={personsLoading}
                    isSearchable
                    classNames={getSelectClassNames(false, persons.length > 0)}
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    styles={menuPortalStyles}
                    noOptionsMessage={() => 'Sin personas'}
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
