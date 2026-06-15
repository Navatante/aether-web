import { Crew } from "../components/forms/schema";
import { useApiQuery } from "@/lib/apiQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useEscuadrilla } from "@/providers";

/**
 * Trae las tripulaciones por su person_sk vía GET /persons/by-sks?sks=1,2,3.
 *
 * Lectura por TanStack Query (regla 5): la query se deshabilita cuando no hay
 * sks seleccionados (`enabled`), se cachea por combinación de sks + escuadrilla
 * y la cancelación al desmontar la gestiona react-query (signal), sin
 * useState/useEffect ni flags manuales.
 */
export function useCrewByPersonSks(selectedSks: number[]) {
    const { id: escId } = useEscuadrilla();
    const sksParam = selectedSks.join(',');

    const { data, isLoading, error } = useApiQuery<Crew[]>(
        'GET',
        '/persons/by-sks',
        {
            query: { sks: sksParam },
            enabled: selectedSks.length > 0,
        },
        queryKeys.flights.crewBySks(escId ?? 0, sksParam),
    );

    return {
        crewArray: data ?? [],
        loading: isLoading,
        error: error?.message ?? null,
    };
}
