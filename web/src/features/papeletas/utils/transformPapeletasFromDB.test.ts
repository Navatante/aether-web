import { describe, expect, it } from "vitest";
import { transformPapeletasFromDB } from "./transformPapeletasFromDB";
import type { Papeleta as PapeletaDTO } from "@/types/generated/papeletas";

const asItems = (rows: unknown[]) => rows as PapeletaDTO[];

describe("transformPapeletasFromDB", () => {
    it("mapea la papeleta y respeta papeleta_order = null", () => {
        const [p] = transformPapeletasFromDB(asItems([
            {
                papeleta_sk: 3,
                papeleta_name: "NAV-01",
                papeleta_description: "Navegación",
                papeleta_block: "Básico",
                papeleta_plan: "Plan A",
                papeleta_tv: 2,
                papeleta_pilot_crp_value: 1,
                papeleta_dv_crp_value: 0,
                papeleta_expiration: 180,
                papeleta_order: null,
            },
        ]));
        expect(p.papeleta_sk).toBe(3);
        expect(p.papeleta_name).toBe("NAV-01");
        expect(p.papeleta_expiration).toBe(180);
        // order es nullable de verdad: no debe degradar a 0.
        expect(p.papeleta_order).toBeNull();
    });

    it("aplica defaults seguros ante tipos inesperados", () => {
        const [p] = transformPapeletasFromDB(asItems([
            { papeleta_sk: "3", papeleta_name: 42, papeleta_order: "1" },
        ]));
        expect(p.papeleta_sk).toBe(0);
        expect(p.papeleta_name).toBe("");
        expect(p.papeleta_order).toBeNull();
    });
});
