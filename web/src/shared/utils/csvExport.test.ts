import { describe, expect, it } from "vitest";
import { buildCSV } from "./csvExport";

describe("buildCSV", () => {
    it("separa con ';' y entrecomilla todos los valores", () => {
        expect(buildCSV(["A", "B"], [["x", 1]])).toBe('"A";"B"\n"x";"1"');
    });

    it("escapa comillas dobles duplicándolas", () => {
        expect(buildCSV(["Nombre"], [['dice "hola"']])).toBe('"Nombre"\n"dice ""hola"""');
    });

    it("null/undefined quedan como celda vacía", () => {
        expect(buildCSV(["A", "B"], [[null, undefined]])).toBe('"A";"B"\n"";""');
    });
});
