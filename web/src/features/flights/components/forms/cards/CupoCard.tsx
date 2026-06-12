import { Controller } from 'react-hook-form';
import { CardProps } from "../schema";
import { useAuthorities } from "@/shared/hooks";
import Select from "react-select";
import { RemoveCardButton, NumericInput } from '../../common';
import {
    getReactSelectClassNames,
    menuPortalStyles
} from '../../../utils';

function CupoCard({
    index,
    control,
    errors,
    onRemove,
    canRemove,
}: CardProps) {

    const {
        data: autoridadArray,
        loading: autoridadLoading,
        error: autoridadError
    } = useAuthorities();

    const autoridadOptions = autoridadArray?.map(autoridad => ({
        value: autoridad.authority_sk,
        label: autoridad.authority_name
    })) || [];

    return (
        <div className="p-4 border rounded-lg min-h-40 background-secondary">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    Cupo {index + 1}
                </h3>
                {canRemove && (
                    <RemoveCardButton index={index} onRemove={onRemove} />
                )}
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <Controller
                        name={`cupos.${index}.autoridad` as const}
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => {
                            const selectedOption = autoridadOptions.find(option => option.value === value) || null;

                            return (
                                <Select
                                    {...field}
                                    value={selectedOption}
                                    onChange={(selectedOption) => {
                                        onChange(selectedOption?.value);
                                    }}
                                    options={autoridadOptions}
                                    placeholder={"Autoridad"}
                                    isLoading={autoridadLoading}
                                    isDisabled={Boolean(autoridadLoading || autoridadError)}
                                    classNames={getReactSelectClassNames(errors, `cupos.${index}.autoridad`, !!selectedOption)}
                                    classNamePrefix="react-select"
                                    menuPortalTarget={document.body}
                                    styles={menuPortalStyles}
                                />
                            );
                        }}
                    />
                </div>

                <div className="flex-1">
                    <NumericInput control={control} name={`cupos.${index}.horas`} placeholder="Horas" errors={errors} mode="hour" />
                </div>
            </div>
        </div>
    );
}

export default CupoCard;
