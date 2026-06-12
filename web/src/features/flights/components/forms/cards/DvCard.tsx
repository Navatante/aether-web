import { Controller } from 'react-hook-form';
import { CardProps } from "../schema";
import { useCrewLookup } from "@/shared/hooks";
import Select from "react-select";
import { useUserData } from "@/providers";
import { RemoveCardButton, NumericInput } from '../../common';
import {
    getReactSelectClassNames,
    menuPortalStyles,
    ESCUADRILLA_14_ID
} from '../../../utils';

function DvCard({
    index,
    control,
    errors,
    onRemove
}: CardProps) {
    const { escuadrillaId } = useUserData();

    const {
        data: dvsArray,
        loading: dvsLoading,
        error: dvsError
    } = useCrewLookup();

    const dvOptions = dvsArray?.map(dv => ({
        value: dv.person_sk,
        label: dv.person_nk
    })) || [];

    // Helper para generar paths
    const p = (field: string) => `dvs.${index}.${field}`;

    return (
        <div className="p-4 border rounded-lg background-secondary">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    Dotación {index + 1}
                </h3>
                <RemoveCardButton index={index} onRemove={onRemove} />
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* Primera columna: DV - Centrado verticalmente */}
                <div className="col-span-1 flex items-center">
                    <Controller
                        name={`dvs.${index}.name` as const}
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => {
                            const selectedOption = dvOptions.find(option => option.value === value) || null;

                            return (
                                <Select
                                    {...field}
                                    value={selectedOption}
                                    onChange={(selectedOption) => {
                                        onChange(selectedOption?.value);
                                    }}
                                    options={dvOptions}
                                    placeholder={"DV"}
                                    isLoading={dvsLoading}
                                    isDisabled={Boolean(dvsLoading || dvsError)}
                                    classNames={getReactSelectClassNames(errors, `dvs.${index}.name`, !!selectedOption)}
                                    classNamePrefix="react-select"
                                    menuPortalTarget={document.body}
                                    styles={menuPortalStyles}
                                />
                            );
                        }}
                    />
                </div>

                {/* Segunda columna: Contenido principal */}
                <div className="col-span-9">
                    {/* Primera fila */}
                    <div className="flex gap-3 mb-4">
                        {/* Horas de vuelo */}
                        <div className="mr-8">
                            <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">Horas de vuelo</h4>
                            <div className="flex gap-1">
                                <div className="flex-1">
                                    <NumericInput mode="hour" control={control} name={p('person_hour.hDay')} placeholder="D" errors={errors} />
                                </div>
                                <div className="flex-1">
                                    <NumericInput mode="hour" control={control} name={p('person_hour.hNight')} placeholder="N" errors={errors} />
                                </div>
                                <div className="flex-1">
                                    <NumericInput mode="hour" control={control} name={p('person_hour.hGvn')} placeholder="G" errors={errors} />
                                </div>
                            </div>
                        </div>

                        {/* Winch Trim y Proyectiles solo para 14 Escuadrilla */}
                        {escuadrillaId === ESCUADRILLA_14_ID && (
                            <>
                                {/* Winch Trim */}
                                <div className="mr-8">
                                    <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">Winch Trim</h4>
                                    <NumericInput mode="hour" control={control} name={p('wt_hour')} errors={errors} />
                                </div>

                                {/* Proyectiles */}
                                <div className="mr-8">
                                    <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">Proyectiles</h4>
                                    <div className="flex gap-1">
                                        <div className="flex-1">
                                            <NumericInput mode="integer" control={control} name={p('projectile.m3m')} placeholder="M3M" errors={errors} />
                                        </div>
                                        <div className="flex-1">
                                            <NumericInput mode="integer" control={control} name={p('projectile.mag58')} placeholder="MAG58" errors={errors} />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DvCard;
