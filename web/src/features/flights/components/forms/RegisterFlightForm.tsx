// Formulario de registro de vuelo: composición solo-render. Toda la lógica
// (react-hook-form, field arrays, validación, lookups y submit) vive en
// useFlightForm; la sección General y las cards son componentes propios.

import { useState } from 'react';
import { Save } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

import PilotCard from './cards/PilotCard';
import DvCard from "./cards/DvCard";
import PapeletaCard from "./cards/PapeletaCard";
import CupoCard from "./cards/CupoCard";
import CapbaCard from "./cards/CapbaCard";
import PasajeroCard from "./cards/PasajeroCard";
import GeneralSection from './GeneralSection';
import ValidationErrors from "./ValidationErrors";
import { ActionButton } from "@/shared/components/common";
import { SectionHeader } from '../common';
import { ManageFlightDataDialog } from '../dialogs';
import { useFlightForm } from '../../hooks/useFlightForm';

interface RegisterFlightFormProps {
    onClose: () => void;
}

export default function RegisterFlightForm({ onClose }: RegisterFlightFormProps) {
    const [managePlacesOpen, setManagePlacesOpen] = useState(false);
    const {
        control,
        errors,
        isSubmitting,
        submit,
        hoursValidationErrors,
        duplicateErrors,
        pilotsFields, addPilot, removePilot,
        dvsFields, addDv, removeDv,
        papeletasFields, addPapeletas, removePapeleta,
        cuposFields, addCupos, removeCupos,
        capbasFields, addCapba, removeCapba,
        pasajerosFields, addPasajeros, removePasajeros,
        aircraftOptions, aircraftLoading, aircraftError,
        placeOptions, placesLoading, placesError,
        eventOptions, eventLoading, eventError,
        allSks,
    } = useFlightForm(onClose);

    return (
        <ScrollArea className="h-[calc(100vh-120px)] rounded-md border">
            <div className="w-full p-6 space-y-12 bg-background">

                {/* General */}
                <GeneralSection
                    control={control}
                    errors={errors}
                    aircraftOptions={aircraftOptions}
                    aircraftLoading={aircraftLoading}
                    aircraftError={aircraftError}
                    placeOptions={placeOptions}
                    placesLoading={placesLoading}
                    placesError={placesError}
                    eventOptions={eventOptions}
                    eventLoading={eventLoading}
                    eventError={eventError}
                    onOpenManage={() => setManagePlacesOpen(true)}
                />

                {/* Pilotos */}
                <div className="space-y-4">
                    <SectionHeader title="Pilotos" onAdd={addPilot} />
                    <ScrollArea className="h-[290px] w-full rounded-md border bg-background">
                        <div className="p-4 space-y-4">
                            {pilotsFields.map((field, index) => (
                                <PilotCard
                                    key={field.id}
                                    index={index}
                                    control={control}
                                    errors={errors}
                                    onRemove={removePilot}
                                    canRemove={pilotsFields.length > 1 && index !== 0}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Dotaciones */}
                <div className="space-y-4">
                    <SectionHeader title="Dotaciones" onAdd={addDv} />
                    <ScrollArea className="h-[201px] w-full rounded-md border bg-background">
                        <div className="p-4 space-y-4">
                            {dvsFields.map((field, index) => (
                                <DvCard
                                    key={field.id}
                                    index={index}
                                    control={control}
                                    errors={errors}
                                    onRemove={removeDv}
                                    canRemove={true}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <div className="grid grid-cols-2 items-center gap-6">
                    {/* Papeletas */}
                    <div className="space-y-4">
                        <SectionHeader title="Papeletas" onAdd={addPapeletas} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {papeletasFields.map((field, index) => (
                                    <PapeletaCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removePapeleta}
                                        canRemove={true}
                                        selectedSks={allSks}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Cupos */}
                    <div className="space-y-4">
                        <SectionHeader title="Cupos" onAdd={addCupos} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {cuposFields.map((field, index) => (
                                    <CupoCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removeCupos}
                                        canRemove={cuposFields.length > 1 && index !== 0}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Capba (capacidades básicas) */}
                    <div className="space-y-4">
                        <SectionHeader title="CAPBAS" onAdd={addCapba} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {capbasFields.map((field, index) => (
                                    <CapbaCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removeCapba}
                                        canRemove={true}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Pasajeros */}
                    <div className="space-y-4">
                        <SectionHeader title="Pasajeros" onAdd={addPasajeros} />
                        <ScrollArea className="h-[195px] w-full rounded-md border bg-background">
                            <div className="p-4 space-y-6">
                                {pasajerosFields.map((field, index) => (
                                    <PasajeroCard
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        errors={errors}
                                        onRemove={removePasajeros}
                                        canRemove={true}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Mensajes de validación */}
                <div>
                    <ValidationErrors
                        errors={errors}
                        hoursValidationErrors={hoursValidationErrors}
                        duplicateErrors={duplicateErrors}
                    />
                </div>

                {/* Botones del formulario */}
                <div className="flex justify-center gap-3">
                    <ActionButton
                        variant="add"
                        icon={Save}
                        label={isSubmitting ? "Registrando..." : "Registrar vuelo"}
                        onClick={submit}
                        disabled={isSubmitting}
                        className="cursor-pointer"
                    />
                </div>
            </div>

            <ManageFlightDataDialog
                open={managePlacesOpen}
                onOpenChange={setManagePlacesOpen}
            />
        </ScrollArea>
    );
}
