// Lógica del formulario de alta/edición de un repostaje de combustible.
// El componente RegisterFuelForm queda solo con el render.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useLogger } from '@/lib/logger';
import { useApiMutation } from '@/lib/apiQuery';
import { queryKeys } from '@/lib/queryKeys';
import { useEscuadrilla } from '@/providers';
import {
    useAircrafts,
    useEventsLookup,
    useFuelPlaces,
    useFuelPayers,
    useFuelPhases,
    useFuelTypes,
} from '@/shared/hooks';
import type { FuelItem, FuelPayload, InsertResult } from '@/types/generated/fuel';
import { FUEL_PLACE_TYPES, type FuelPlaceType } from '../fuel';

interface UseRegisterFuelArgs {
    mode: 'create' | 'edit';
    initial?: FuelItem;
    onClose: () => void;
}

export function useRegisterFuel({ mode, initial, onClose }: UseRegisterFuelArgs) {
    const log = useLogger('RegisterFuelForm');
    const { id: escId } = useEscuadrilla();

    // Estado del formulario.
    const [date, setDate] = useState<string>(initial?.fuel_date ?? '');
    const [helo, setHelo] = useState<number | null>(initial?.fuel_helo_fk ?? null);
    const [place, setPlace] = useState<number | null>(initial?.fuel_place_fk ?? null);
    const [payer, setPayer] = useState<number | null>(initial?.fuel_payer_fk ?? null);
    const [event, setEvent] = useState<number | null>(initial?.fuel_event_fk ?? null);
    const [phase, setPhase] = useState<number | null>(initial?.fuel_phase_fk ?? null);
    const [type, setType] = useState<number | null>(initial?.fuel_type_fk ?? null);
    const [qty, setQty] = useState<string>(initial ? String(initial.fuel_qty) : '');
    const [error, setError] = useState<string | null>(null);

    // Lookups.
    const { data: helos, loading: helosLoading } = useAircrafts();
    const { data: places, loading: placesLoading } = useFuelPlaces();
    const { data: payers, loading: payersLoading } = useFuelPayers();
    const { data: events, loading: eventsLoading } = useEventsLookup();
    const { data: phases, loading: phasesLoading } = useFuelPhases();
    const { data: types, loading: typesLoading } = useFuelTypes();

    // Sub-form "nuevo lugar" embebido (solo el nombre es nuevo; el tipo es fijo).
    const [addingPlace, setAddingPlace] = useState(false);
    const [newPlaceName, setNewPlaceName] = useState('');
    const [newPlaceType, setNewPlaceType] = useState<FuelPlaceType>(FUEL_PLACE_TYPES[0]);
    // Nombre del lugar recién creado, pendiente de auto-seleccionar en cuanto el
    // catálogo refetcheado (invalidateKeys) lo incluya. El POST no devuelve el sk.
    const [pendingPlaceName, setPendingPlaceName] = useState<string | null>(null);

    useEffect(() => {
        if (!pendingPlaceName) return;
        const created = places.find((p) => p.fuel_place_name === pendingPlaceName);
        if (created) {
            setPlace(created.fuel_place_sk);
            setPendingPlaceName(null);
        }
    }, [places, pendingPlaceName]);

    const createMutation = useApiMutation<InsertResult, FuelPayload>(
        'POST', '/fuel',
        { invalidateKeys: [queryKeys.fuel.all(escId ?? 0)] },
    );
    const updateMutation = useApiMutation<void, FuelPayload & { id: number }>(
        'PUT', (v) => `/fuel/${v.id}`,
        {
            invalidateKeys: [queryKeys.fuel.all(escId ?? 0)],
            successMessage: 'Repostaje actualizado.',
            body: ({ id: _id, ...rest }) => rest,
        },
    );
    const addPlace = useApiMutation<void, { fuel_place_name: string; fuel_place_type: string }>(
        'POST', '/lookups/fuel-places',
        { invalidateKeys: [queryKeys.lookups.fuelPlaces(escId ?? 0)] },
    );

    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    const canSubmit =
        !!date && helo != null && place != null && payer != null &&
        event != null && phase != null && type != null && qty.trim() !== '' && !isSubmitting;

    const resetPlaceForm = () => {
        setAddingPlace(false);
        setNewPlaceName('');
        setNewPlaceType(FUEL_PLACE_TYPES[0]);
    };

    const handleCreatePlace = async () => {
        const name = newPlaceName.trim();
        if (!name) {
            setError('El nombre del lugar es obligatorio.');
            return;
        }
        setError(null);
        try {
            await addPlace.mutateAsync({ fuel_place_name: name, fuel_place_type: newPlaceType });
            log.info(`Lugar de repostaje '${name}' añadido`);
            // El POST no devuelve el sk: el efecto de arriba auto-selecciona el
            // lugar en cuanto el catálogo refetcheado (invalidateKeys) lo incluya.
            setPendingPlaceName(name);
            resetPlaceForm();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error añadiendo lugar de repostaje: ${err}`);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        if (!canSubmit) {
            setError('Completa todos los campos.');
            return;
        }
        const qtyNum = parseFloat(qty.replace(',', '.'));
        if (Number.isNaN(qtyNum) || qtyNum <= 0) {
            setError('La cantidad debe ser un número mayor que 0.');
            return;
        }
        const payload: FuelPayload = {
            fuel_date: date,
            fuel_helo_fk: helo!,
            fuel_place_fk: place!,
            fuel_payer_fk: payer!,
            fuel_event_fk: event!,
            fuel_phase_fk: phase!,
            fuel_type_fk: type!,
            fuel_qty: qtyNum,
        };
        try {
            if (mode === 'edit' && initial) {
                await updateMutation.mutateAsync({ id: initial.id, ...payload });
            } else {
                const result = await createMutation.mutateAsync(payload);
                if (!result.success) {
                    toast.error('Error al registrar el repostaje');
                    return;
                }
                toast.success(result.message);
            }
            onClose();
        } catch (err) {
            // El error HTTP ya lo notifica el toast de useApiMutation.
            log.error(`Error al guardar repostaje: ${err}`);
        }
    };

    return {
        // estado
        date, setDate, helo, setHelo, place, setPlace, payer, setPayer,
        event, setEvent, phase, setPhase, type, setType, qty, setQty,
        error, isSubmitting, canSubmit, mode,
        // lookups
        helos, helosLoading, places, placesLoading, payers, payersLoading,
        events, eventsLoading, phases, phasesLoading, types, typesLoading,
        // sub-form "nuevo lugar"
        addingPlace, setAddingPlace, newPlaceName, setNewPlaceName,
        newPlaceType, setNewPlaceType, creatingPlace: addPlace.isPending,
        handleCreatePlace, resetPlaceForm,
        // acciones
        handleSubmit,
    };
}
