import { FormData } from "../components/forms/schema";

// --- Pure helper functions ---

export const safeParseFloat = (val: string | undefined): number => {
    if (!val || val === '' || val === undefined) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

export const sumPersonHours = (personHour: { hDay?: string; hNight?: string; hGvn?: string } | undefined): number => {
    return safeParseFloat(personHour?.hDay) +
        safeParseFloat(personHour?.hNight) +
        safeParseFloat(personHour?.hGvn);
};

export const findDuplicates = <T extends Record<string, unknown>>(items: T[], key: string): number[] => {
    const seen = new Set<number>();
    const duplicates = new Set<number>();

    items.forEach(item => {
        const value = item[key] as number | undefined;
        if (value !== undefined && value !== null) {
            if (seen.has(value)) {
                duplicates.add(value);
            }
            seen.add(value);
        }
    });

    return Array.from(duplicates);
};

// --- Types ---

export interface HoursValidationError {
    type: 'hac' | 'otherPilots' | 'dvs';
    message: string;
    expected: number;
    actual: number;
}

export interface DuplicateValidationError {
    type: 'pilots' | 'dvs' | 'cupos' | 'capbas';
    message: string;
    duplicates: number[];
}

// --- Pure validators (derivación, sin estado) ---

function computeDuplicateErrors(
    pilots: FormData['pilots'],
    dvs: FormData['dvs'],
    cupos: FormData['cupos'],
    capbas: FormData['capbas'],
): DuplicateValidationError[] {
    const errors: DuplicateValidationError[] = [];

    if (pilots && pilots.length > 0) {
        const duplicatePilotNames = findDuplicates(pilots, 'name');
        if (duplicatePilotNames.length > 0) {
            errors.push({
                type: 'pilots',
                message: 'Hay pilotos duplicados en el formulario',
                duplicates: duplicatePilotNames
            });
        }
    }

    if (dvs && dvs.length > 0) {
        const duplicateDvNames = findDuplicates(dvs, 'name');
        if (duplicateDvNames.length > 0) {
            errors.push({
                type: 'dvs',
                message: 'Hay dotaciones duplicadas en el formulario',
                duplicates: duplicateDvNames
            });
        }
    }

    if (cupos && cupos.length > 0) {
        const duplicateCupoAutoridades = findDuplicates(cupos, 'autoridad');
        if (duplicateCupoAutoridades.length > 0) {
            errors.push({
                type: 'cupos',
                message: 'Hay autoridades duplicadas en los cupos',
                duplicates: duplicateCupoAutoridades
            });
        }
    }

    if (capbas && capbas.length > 0) {
        const duplicateCapbas = findDuplicates(capbas, 'capba');
        if (duplicateCapbas.length > 0) {
            errors.push({
                type: 'capbas',
                message: 'Hay capacidades básicas duplicadas',
                duplicates: duplicateCapbas
            });
        }
    }

    return errors;
}

function computeHoursValidationErrors(
    totalHours: string,
    pilots: FormData['pilots'],
    dvs: FormData['dvs'],
    cupos: FormData['cupos'],
): HoursValidationError[] {
    const validationErrors: HoursValidationError[] = [];
    const totalHoursNum = safeParseFloat(totalHours);

    if (totalHoursNum > 0) {
        // HAC pilot (first pilot) validation
        if (pilots && pilots.length > 0) {
            const hacHours = sumPersonHours(pilots[0].person_hour);

            if (Math.abs(hacHours - totalHoursNum) > 0.01) {
                validationErrors.push({
                    type: 'hac',
                    message: `Las horas del piloto HAC no coinciden con las horas totales`,
                    expected: totalHoursNum,
                    actual: hacHours
                });
            }
        }

        // Other pilots validation
        if (pilots && pilots.length > 1) {
            const otherPilotsHours = pilots
                .slice(1)
                .reduce((sum, pilot) => sum + sumPersonHours(pilot.person_hour), 0);

            if (Math.abs(otherPilotsHours - totalHoursNum) > 0.01) {
                validationErrors.push({
                    type: 'otherPilots',
                    message: `La suma de horas de los copilotos no coincide con las horas totales`,
                    expected: totalHoursNum,
                    actual: otherPilotsHours
                });
            }
        }

        // Individual pilot validations
        if (pilots && pilots.length > 0) {
            pilots.forEach((pilot, index) => {
                const pilotName = `Piloto ${index + 1}`;

                const iftHours = safeParseFloat(pilot.ift_hour);
                if (iftHours > totalHoursNum) {
                    validationErrors.push({
                        type: 'otherPilots',
                        message: `Las horas de Instrumentos del ${pilotName} exceden las horas totales`,
                        expected: totalHoursNum,
                        actual: iftHours
                    });
                }

                const iitHours = safeParseFloat(pilot.gvnType_hour?.hIit);
                const anvisHours = safeParseFloat(pilot.gvnType_hour?.hAnvis);
                const gvnHours = safeParseFloat(pilot.person_hour?.hGvn);
                const sumGvnType = iitHours + anvisHours;

                if (gvnHours > 0 && Math.abs(sumGvnType - gvnHours) > 0.01) {
                    validationErrors.push({
                        type: 'otherPilots',
                        message: `La suma de horas IIT + ANVIS de ${pilotName} no coincide con sus horas GVN`,
                        expected: gvnHours,
                        actual: sumGvnType
                    });
                }

                const instructorHours = safeParseFloat(pilot.instructor_hour);
                if (instructorHours > totalHoursNum) {
                    validationErrors.push({
                        type: 'otherPilots',
                        message: `Las horas de Instructor del ${pilotName} exceden las horas totales`,
                        expected: totalHoursNum,
                        actual: instructorHours
                    });
                }

                const formationDayHours = safeParseFloat(pilot.formation_hour?.hfDay);
                const formationGvnHours = safeParseFloat(pilot.formation_hour?.hfGvn);
                const sumFormation = formationDayHours + formationGvnHours;

                if (sumFormation > totalHoursNum) {
                    validationErrors.push({
                        type: 'otherPilots',
                        message: `La suma de horas de Formación de ${pilotName} excede las horas totales`,
                        expected: totalHoursNum,
                        actual: sumFormation
                    });
                }
            });
        }

        // DV validations
        if (dvs && dvs.length > 0) {
            dvs.forEach((dv, index) => {
                const dvName = `Dotación ${index + 1}`;
                const dvPersonHours = sumPersonHours(dv.person_hour);
                const wtHours = safeParseFloat(dv.wt_hour);

                if (dvPersonHours > totalHoursNum + 0.01) {
                    validationErrors.push({
                        type: 'dvs',
                        message: `La suma de horas de Día, Noche y GVN de ${dvName} no pueden exceder las horas totales`,
                        expected: totalHoursNum,
                        actual: dvPersonHours
                    });
                }

                if (wtHours > totalHoursNum) {
                    validationErrors.push({
                        type: 'dvs',
                        message: `Las horas de Winch Trim de ${dvName} exceden las horas totales`,
                        expected: totalHoursNum,
                        actual: wtHours
                    });
                }

                if (dvPersonHours === 0) {
                    validationErrors.push({
                        type: 'dvs',
                        message: `${dvName} debe tener al menos alguna hora de vuelo (día, noche o GVN)`,
                        expected: 0.05,
                        actual: 0
                    });
                }
            });
        }

        // Cupos validation
        if (cupos && cupos.length > 0) {
            const totalCuposHours = cupos
                .reduce((sum, cupo) => sum + safeParseFloat(cupo.horas), 0);

            if (Math.abs(totalCuposHours - totalHoursNum) > 0.01) {
                validationErrors.push({
                    type: 'otherPilots',
                    message: `La suma de horas de cupos no coincide con las horas totales`,
                    expected: totalHoursNum,
                    actual: totalCuposHours
                });
            }
        }
    }

    return validationErrors;
}

// --- Hook ---
//
// Validación derivada de forma pura del estado del formulario (sin useState/
// useEffect): el cálculo es síncrono y sin efectos secundarios, así que se
// deriva en el cuerpo del render. React Compiler memoiza el cálculo; recomputa
// solo cuando cambian sus entradas. Evita el render extra y la ventana stale
// del antipatrón useState+useEffect.
export function useFlightValidation(
    totalHours: string,
    pilots: FormData['pilots'],
    dvs: FormData['dvs'],
    cupos: FormData['cupos'],
    capbas: FormData['capbas'],
) {
    const duplicateErrors = computeDuplicateErrors(pilots, dvs, cupos, capbas);
    const hoursValidationErrors = computeHoursValidationErrors(totalHours, pilots, dvs, cupos);

    return { hoursValidationErrors, duplicateErrors };
}
