import { Controller } from 'react-hook-form';
import { CardProps } from "../schema";
import { usePilotsLookup } from "@/shared/hooks";
import Select from "react-select";
import { useUserData } from "@/providers";
import { RemoveCardButton, NumericInput } from '../../common';
import {
    getReactSelectClassNames,
    menuPortalStyles,
    ESCUADRILLA_14_ID
} from '../../../utils';

function PilotCard({
    index,
    control,
    errors,
    onRemove,
    canRemove
}: CardProps) {
    const { escuadrillaId } = useUserData();

    const {
        data: pilotsArray,
        loading: pilotsLoading,
        error: pilotsError
    } = usePilotsLookup();

    const pilotOptions = pilotsArray?.map(pilot => ({
        value: pilot.person_sk,
        label: pilot.person_nk
    })) || [];

    // Helper para generar paths
    const p = (field: string) => `pilots.${index}.${field}`;

    return (
        <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    Piloto {index + 1}
                </h3>
                {canRemove && (
                    <RemoveCardButton index={index} onRemove={onRemove} />
                )}
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* Primera columna: HAC/H2P - Centrado verticalmente */}
                <div className="col-span-1 flex items-center">
                    <Controller
                        name={`pilots.${index}.name` as const}
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => {
                            const selectedOption = pilotOptions.find(option => option.value === value) || null;

                            return (
                                <Select
                                    {...field}
                                    value={selectedOption}
                                    onChange={(selectedOption) => {
                                        onChange(selectedOption?.value);
                                    }}
                                    options={pilotOptions}
                                    placeholder={index === 0 ? "HAC" : "H2P"}
                                    isLoading={pilotsLoading}
                                    isDisabled={Boolean(pilotsLoading || pilotsError)}
                                    classNames={getReactSelectClassNames(errors, `pilots.${index}.name`, !!selectedOption)}
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

                        {/* IIT y ANVIS solo para 14 Escuadrilla */}
                        {escuadrillaId === ESCUADRILLA_14_ID && (
                            <>
                                {/* IIT */}
                                <div className="mr-8">
                                    <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">IIT</h4>
                                    <NumericInput mode="hour" control={control} name={p('gvnType_hour.hIit')} errors={errors} />
                                </div>

                                {/* ANVIS */}
                                <div className="mr-8">
                                    <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">ANVIS</h4>
                                    <NumericInput mode="hour" control={control} name={p('gvnType_hour.hAnvis')} errors={errors} />
                                </div>
                            </>
                        )}

                        {/* Instrumentos */}
                        <div className="mr-8">
                            <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">Instrumentos</h4>
                            <NumericInput mode="hour" control={control} name={p('ift_hour')} errors={errors} />
                        </div>

                        {/* Instructor */}
                        <div className="mr-8">
                            <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">Instructor</h4>
                            <NumericInput mode="hour" control={control} name={p('instructor_hour')} errors={errors} />
                        </div>

                        {/* Formación */}
                        <div className="mr-8">
                            <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">Formación</h4>
                            <div className="flex gap-1">
                                <div className="flex-1">
                                    <NumericInput mode="hour" control={control} name={p('formation_hour.hfDay')} placeholder="D" errors={errors} />
                                </div>
                                <div className="flex-1">
                                    <NumericInput mode="hour" control={control} name={p('formation_hour.hfGvn')} placeholder="G" errors={errors} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Segunda fila - Tomas */}
                    <div>
                        <h4 className="text-sm font-medium mb-2 text-center border-b pb-1 mr-8">Tomas</h4>
                        <div className="grid grid-cols-4 gap-3">
                            {/* Tierra */}
                            <div className="mr-8">
                                <h5 className="text-xs text-center mb-1">Tierra</h5>
                                <div className="flex gap-1">
                                    <NumericInput mode="integer" control={control} name={p('landing.tierra.lDay')} placeholder="D" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.tierra.lNight')} placeholder="N" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.tierra.lGvn')} placeholder="G" errors={errors} />
                                </div>
                            </div>

                            {/* Monospot */}
                            <div className="mr-8">
                                <h5 className="text-xs text-center mb-1">Monospot</h5>
                                <div className="flex gap-1">
                                    <NumericInput mode="integer" control={control} name={p('landing.mono.lDay')} placeholder="D" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.mono.lNight')} placeholder="N" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.mono.lGvn')} placeholder="G" errors={errors} />
                                </div>
                            </div>

                            {/* Multispot */}
                            <div className="mr-8">
                                <h5 className="text-xs text-center mb-1">Multispot</h5>
                                <div className="flex gap-1">
                                    <NumericInput mode="integer" control={control} name={p('landing.multi.lDay')} placeholder="D" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.multi.lNight')} placeholder="N" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.multi.lGvn')} placeholder="G" errors={errors} />
                                </div>
                            </div>

                            {/* Carrier */}
                            <div className="mr-8">
                                <h5 className="text-xs text-center mb-1">Carrier</h5>
                                <div className="flex gap-1">
                                    <NumericInput mode="integer" control={control} name={p('landing.carrier.lDay')} placeholder="D" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.carrier.lNight')} placeholder="N" errors={errors} />
                                    <NumericInput mode="integer" control={control} name={p('landing.carrier.lGvn')} placeholder="G" errors={errors} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tercera columna */}
                <div className="col-span-2">
                    {/* Primera fila - Instr. App */}
                    <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">Instr. App</h4>
                        <div className="flex gap-2 justify-center">
                            <div className="w-40">
                                <NumericInput mode="integer" control={control} name={p('app.precision')} placeholder="Precisión" errors={errors} />
                            </div>
                            <div className="w-40">
                                <NumericInput mode="integer" control={control} name={p('app.noPrecision')} placeholder="No Prec." errors={errors} />
                            </div>
                        </div>
                    </div>

                    {/* Segunda fila - SAR */}
                    <div>
                        <h4 className="text-sm font-medium mb-2 text-center border-b pb-1">SAR</h4>
                        <div className="flex gap-2 justify-center">
                            <div className="w-40">
                                <h5 className="text-xs text-center mb-1">&nbsp;</h5>
                                <NumericInput mode="integer" control={control} name={p('app.td')} placeholder="T/D" errors={errors} />
                            </div>
                            <div className="w-40">
                                <h5 className="text-xs text-center mb-1">&nbsp;</h5>
                                <NumericInput mode="integer" control={control} name={p('app.sp')} placeholder="Srch. Patt." errors={errors} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PilotCard;

