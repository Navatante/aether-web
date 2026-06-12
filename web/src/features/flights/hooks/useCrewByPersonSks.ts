import { useEffect, useState } from 'react';
import { Crew } from "../components/forms/schema";
import { http } from "@/lib/http";
import { logger } from '@/lib/logger';

/**
 * Fetches crew members by their person_sk values via GET /persons/by-sks?sks=1,2,3.
 * Uses JSON.stringify as the effect dependency to stabilize the array reference.
 */
export function useCrewByPersonSks(selectedSks: number[]) {
    const [crewArray, setCrewArray] = useState<Crew[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stabilize dependency: only re-run when actual values change
    const sksKey = JSON.stringify(selectedSks);

    useEffect(() => {
        const sks: number[] = JSON.parse(sksKey);

        if (sks.length === 0) {
            setCrewArray([]);
            setLoading(false);
            return;
        }

        let cancelled = false;

        setLoading(true);
        setError(null);

        (async () => {
            try {
                const result = await http<Crew[]>('GET', '/persons/by-sks', {
                    query: { sks: sks.join(',') }
                });

                if (!cancelled) {
                    setCrewArray(result);
                }
            } catch (err) {
                if (cancelled) return;
                if (err instanceof Error && err.name === 'AbortError') return;
                logger.error(`Error fetching crew members: ${err}`, 'useCrewByPersonSks');
                setError(err instanceof Error ? err.message : 'Error desconocido');
                setCrewArray([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [sksKey]);

    return { crewArray, loading, error };
}
