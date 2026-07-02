import { describe, expect, it } from "vitest";
import { transformPersonnelFromDB } from "./transformPersonnelFromDB";

describe("transformPersonnelFromDB", () => {
    it("mapea los campos del shape de BD al modelo Person", () => {
        const [p] = transformPersonnelFromDB([
            {
                id: 7,
                nk: "ABC",
                usuario: "jperez",
                empleo: "TN",
                cuerpo: "CGA",
                especialidad: "Vuelo",
                nombre: "Juan",
                apellido1: "Pérez",
                apellido2: "Gómez",
                telefono: "600000000",
                dni: "12345678Z",
                localidad: "Rota",
                division: "Primera",
                rol: "Piloto",
                antiguedadEmpleo: "2020-01-01",
                fechaEmbarco: "2021-01-01",
                fechaNacimiento: "1990-01-01",
                numeroEscalafon: 12,
                activo: 1,
            },
        ]);
        expect(p.person_sk).toBe(7);
        expect(p.person_nk).toBe("ABC");
        expect(p.person_user).toBe("jperez");
        expect(p.person_rank).toBe("TN");
        expect(p.person_num_escalafon).toBe(12);
        expect(p.person_active).toBe(true);
    });

    it("aplica defaults seguros ante tipos inesperados y nulls", () => {
        const [p] = transformPersonnelFromDB([
            { id: "no-numérico", nk: null, usuario: 42, activo: null, dni: "" },
        ]);
        expect(p.person_sk).toBe(0);
        expect(p.person_nk).toBeNull(); // string vacío/null → null
        expect(p.person_user).toBe("");
        expect(p.person_dni).toBeNull();
        expect(p.person_active).toBe(false);
    });

    it("interpreta el bit activo en sus dos formatos (1/true) y el resto como false", () => {
        const rows = transformPersonnelFromDB([
            { activo: 1 },
            { activo: true },
            { activo: 0 },
            { activo: false },
            { activo: "1" },
        ]);
        expect(rows.map((r) => r.person_active)).toEqual([true, true, false, false, false]);
    });

    it("devuelve [] para una lista vacía", () => {
        expect(transformPersonnelFromDB([])).toEqual([]);
    });
});
