import { Controller } from 'react-hook-form';
import { CardProps } from "../schema";
import { useCapbas } from "@/shared/hooks";
import Select from "react-select";
import { RemoveCardButton, NumericInput } from '../../common';
import {
    getReactSelectClassNames,
    menuPortalStyles
} from '../../../utils';

function CapbaCard({
    index,
    control,
    errors,
    onRemove,
    canRemove,
}: CardProps) {

    const {
        data: capbaArray,
        loading: capbaLoading,
        error: capbaError
    } = useCapbas();

    const capbaOptions = capbaArray?.map(capba => ({
        value: capba.capba_id,
        label: capba.capba_name
    })) || [];

    return (
        <div className="p-4 border rounded-lg min-h-40 bg-card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    Capba {index + 1}
                </h3>
                {canRemove && (
                    <RemoveCardButton index={index} onRemove={onRemove} />
                )}
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <Controller
                        name={`capbas.${index}.capba` as const}
                        control={control}
                        render={({ field: { onChange, value, ...field } }) => {
                            const selectedOption = capbaOptions.find(option => option.value === value) || null;

                            return (
                                <Select
                                    {...field}
                                    value={selectedOption}
                                    onChange={(selectedOption) => {
                                        onChange(selectedOption?.value);
                                    }}
                                    options={capbaOptions}
                                    placeholder={"Capacidad"}
                                    isLoading={capbaLoading}
                                    isDisabled={Boolean(capbaLoading || capbaError)}
                                    classNames={getReactSelectClassNames(errors, `capbas.${index}.capba`, !!selectedOption)}
                                    classNamePrefix="react-select"
                                    menuPortalTarget={document.body}
                                    styles={menuPortalStyles}
                                />
                            );
                        }}
                    />
                </div>

                <div className="flex-1">
                    <NumericInput control={control} name={`capbas.${index}.horas`} placeholder="Horas" errors={errors} mode="hour" />
                </div>
            </div>
        </div>
    );
}

export default CapbaCard;
