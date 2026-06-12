import { Controller } from 'react-hook-form';
import { CardProps } from "../schema";
import { usePassengerTypes } from "@/shared/hooks";
import Select from "react-select";
import { Input } from "@/components/ui/input";
import {
    getReactSelectClassNames,
    getInputClassNameCompact,
    menuPortalStyles
} from '../../../utils';
import {RemoveCardButton} from "@/features/flights/components/common";

function PasajeroCard({
    index,
    control,
    errors,
    onRemove,
}: CardProps) {

    const {
        data: pasajerosArray,
        loading: pasajerosLoading,
        error: pasajerosError
    } = usePassengerTypes();

    const pasajerosOptions = pasajerosArray?.map(pasajero => ({
        value: pasajero.passenger_type_sk,
        label: pasajero.passenger_type_name
    })) || [];

    return (
        <div className="p-4 border rounded-lg min-h-40 background-secondary">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    Pasajeros {index + 1}
                </h3>
                <RemoveCardButton index={index} onRemove={onRemove} />
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <Controller
                        name={`pasajeros.${index}.tipo` as const}
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => {
                            const selectedOption = pasajerosOptions.find(option => option.value === value) || null;

                            return (
                                <Select
                                    {...field}
                                    value={selectedOption}
                                    onChange={(selectedOption) => {
                                        onChange(selectedOption?.value);
                                    }}
                                    options={pasajerosOptions}
                                    placeholder={"Tipo"}
                                    isLoading={pasajerosLoading}
                                    isDisabled={Boolean(pasajerosLoading || pasajerosError)}
                                    classNames={getReactSelectClassNames(errors, `pasajeros.${index}.tipo`, !!selectedOption)}
                                    classNamePrefix="react-select"
                                    menuPortalTarget={document.body}
                                    styles={menuPortalStyles}
                                />
                            );
                        }}
                    />
                </div>

                <div className="flex-1">
                    <Controller
                        name={`pasajeros.${index}.cantidad` as const}
                        control={control}
                        render={({ field }) => {
                            const hasError = errors?.pasajeros?.[index]?.cantidad;
                            return (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder="Cantidad"
                                    className={getInputClassNameCompact(!!field.value, !!hasError)}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, '');
                                        field.onChange(value);
                                    }}
                                    autoComplete="off"
                                />
                            );
                        }}
                    />
                </div>

                <div className="flex-1">
                    <Controller
                        name={`pasajeros.${index}.ruta` as const}
                        control={control}
                        render={({ field }) => {
                            const hasError = errors?.pasajeros?.[index]?.ruta;
                            return (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder="Ruta"
                                    className={getInputClassNameCompact(!!field.value, !!hasError)}
                                    autoComplete="off"
                                />
                            );
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default PasajeroCard;
