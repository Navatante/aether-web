import { Controller } from 'react-hook-form';
import { CardProps } from "../schema";
import { usePapeletasLookup } from "@/shared/hooks";
import Select from "react-select";
import { RemoveCardButton } from '../../common';
import {
    getReactSelectClassNames,
    getReactSelectMultiClassNames,
    menuPortalStyles,
    SELECT_ALL_VALUE
} from '../../../utils';
import { useCrewByPersonSks } from '../../../hooks';
import { cn } from "@/lib/utils";

function PapeletaCard({
    index,
    control,
    errors,
    onRemove,
    selectedSks
}: CardProps) {
    const { crewArray, loading: crewLoading, error: crewError } = useCrewByPersonSks(selectedSks || []);

    const {
        data: papeletasArray,
        loading: papeletasLoading,
        error: papeletasError
    } = usePapeletasLookup();

    return (
        <div className="p-4 border rounded-lg background-secondary">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    Asignación {index + 1}
                </h3>
                <RemoveCardButton index={index} onRemove={onRemove} />
            </div>

            <div className="space-y-3">
                {/* Crew selector */}
                <Controller
                    name={`papeletas.${index}.crew` as const}
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => {
                        const crewOptions = crewArray?.map(crew => ({
                            value: crew.person_sk,
                            label: crew.person_nk
                        })) || [];

                        const selectAllOption = {
                            value: SELECT_ALL_VALUE,
                            label: '✓ Seleccionar todos'
                        };

                        const allOptions = crewOptions.length > 0
                            ? [selectAllOption, ...crewOptions]
                            : crewOptions;

                        const selectedOptions = crewOptions.filter(option =>
                            value?.includes(option.value)
                        );

                        return (
                            <Select
                                {...field}
                                value={selectedOptions}
                                onChange={(selectedOptions: readonly { value: number; label: string }[] | null) => {
                                    const selectAllClicked = selectedOptions?.some(
                                        (option) => option.value === SELECT_ALL_VALUE
                                    );

                                    if (selectAllClicked) {
                                        if (selectedOptions && selectedOptions.length - 1 === crewOptions.length) {
                                            onChange([]);
                                        } else {
                                            const allCrewValues = crewOptions.map(option => option.value);
                                            onChange(allCrewValues);
                                        }
                                    } else {
                                        if (selectedOptions && selectedOptions.length > 0) {
                                            const values = selectedOptions.map((option) => option.value);
                                            onChange(values);
                                        } else {
                                            onChange([]);
                                        }
                                    }
                                }}
                                options={allOptions}
                                placeholder={"CREW"}
                                isLoading={crewLoading}
                                isDisabled={Boolean(crewLoading || crewError)}
                                classNames={getReactSelectMultiClassNames(errors, `papeletas.${index}.crew.0`, selectedOptions.length > 0)}
                                classNamePrefix="react-select"
                                isMulti
                                menuPortalTarget={document.body}
                                styles={menuPortalStyles}
                                formatOptionLabel={(option: { value: number; label: string }) => {
                                    if (option.value === SELECT_ALL_VALUE) {
                                        return (
                                            <div style={{ color: 'var(--foreground)' }}>
                                                {option.label}
                                            </div>
                                        );
                                    }
                                    return option.label;
                                }}
                                filterOption={(option, searchText) => {
                                    if (option.data.value === SELECT_ALL_VALUE) {
                                        return true;
                                    }
                                    return option.label.toLowerCase().includes(searchText.toLowerCase());
                                }}
                            />
                        );
                    }}
                />

                {/* Papeletas picker + lista con toggle por item */}
                <Controller
                    name={`papeletas.${index}.papeleta` as const}
                    control={control}
                    render={({ field }) => {
                        const items: { sk: number; period: 'dia' | 'gvn' }[] = field.value || [];
                        const selectedSks = items.map(i => i.sk);

                        const papeletaOptions = papeletasArray?.map(p => ({
                            value: p.papeleta_sk,
                            label: p.papeleta_name,
                        })) || [];

                        const availableOptions = papeletaOptions.filter(o => !selectedSks.includes(o.value));

                        return (
                            <div className="space-y-2">
                                {/* Picker: single select sin valor visible, actúa como adder */}
                                <Select
                                    options={availableOptions}
                                    value={null}
                                    onChange={(opt) => {
                                        if (!opt) return;
                                        const isGvn = opt.label.startsWith('(G)');
                                        field.onChange([...items, { sk: opt.value, period: isGvn ? 'gvn' : 'dia' }]);
                                    }}
                                    placeholder="Añadir papeleta..."
                                    isLoading={papeletasLoading}
                                    isDisabled={Boolean(papeletasLoading || papeletasError)}
                                    classNames={getReactSelectClassNames(errors, `papeletas.${index}.papeleta`, false)}
                                    classNamePrefix="react-select"
                                    menuPortalTarget={document.body}
                                    styles={menuPortalStyles}
                                />

                                {/* Lista custom: una fila por papeleta seleccionada */}
                                {items.map((item) => {
                                    const label = papeletasArray?.find(p => p.papeleta_sk === item.sk)?.papeleta_name ?? String(item.sk);
                                    return (
                                        <div key={item.sk} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/40">
                                            <span className="flex-1 text-sm text-foreground">{label}</span>

                                            {/* Toggle Dia/GVN */}
                                            <div className="flex rounded-lg overflow-hidden border border-input text-xs font-medium">
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange(items.map(i => i.sk === item.sk ? { ...i, period: 'dia' } : i))}
                                                    className={cn("px-2 py-0.5 transition-colors",
                                                        item.period === 'dia'
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                    )}>
                                                    Dia
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => field.onChange(items.map(i => i.sk === item.sk ? { ...i, period: 'gvn' } : i))}
                                                    className={cn("px-2 py-0.5 transition-colors",
                                                        item.period === 'gvn'
                                                            ? "bg-lime-500 text-black"
                                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                    )}>
                                                    GVN
                                                </button>
                                            </div>

                                            {/* Botón eliminar */}
                                            <button
                                                type="button"
                                                onClick={() => field.onChange(items.filter(i => i.sk !== item.sk))}
                                                className="text-muted-foreground hover:text-destructive transition-colors text-xs">
                                                ✕
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    }}
                />
            </div>
        </div>
    );
}

export default PapeletaCard;
