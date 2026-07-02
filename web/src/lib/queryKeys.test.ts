import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";

// Guarda el invariante documentado en queryKeys.ts: TODA clave tiene la forma
// [dominio, escuadrillaId, ...subruta] con el escuadrillaId en la posición 1,
// de modo que `<dominio>.all(escId)` sea prefijo real de cualquier clave del
// dominio y la invalidación por prefijo funcione.
const ESC = 424242;

type KeyFactory = (...args: never[]) => readonly unknown[];

// Recorre el árbol de factories y devuelve [ruta, clave-generada].
function collectKeys(node: unknown, path: string[]): Array<[string, readonly unknown[]]> {
    if (typeof node === "function") {
        // Todas las factories aceptan escuadrillaId como primer argumento; los
        // argumentos extra (params, ids…) quedan undefined y no afectan al prefijo.
        const key = (node as KeyFactory)(ESC as never);
        return [[path.join("."), key]];
    }
    if (node !== null && typeof node === "object") {
        return Object.entries(node).flatMap(([k, v]) => collectKeys(v, [...path, k]));
    }
    return [];
}

describe("queryKeys", () => {
    const all = collectKeys(queryKeys, []);

    it("genera claves con forma [dominio, escuadrillaId, ...]", () => {
        expect(all.length).toBeGreaterThan(0);
        for (const [path, key] of all) {
            expect(Array.isArray(key), `${path} debe devolver array`).toBe(true);
            expect(typeof key[0], `${path}: posición 0 debe ser el dominio`).toBe("string");
            expect(key[1], `${path}: posición 1 debe ser el escuadrillaId`).toBe(ESC);
        }
    });

    it("<dominio>.all(escId) es prefijo de todas las claves del dominio", () => {
        for (const [domain, factories] of Object.entries(queryKeys)) {
            const allFn = (factories as Record<string, unknown>).all;
            if (typeof allFn !== "function") continue;
            const prefix = (allFn as KeyFactory)(ESC as never);
            for (const [path, key] of collectKeys(factories, [domain])) {
                for (let i = 0; i < prefix.length; i++) {
                    expect(key[i], `${path} debe empezar por ${JSON.stringify(prefix)}`).toBe(prefix[i]);
                }
            }
        }
    });
});
