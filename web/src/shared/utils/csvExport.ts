// Exportación CSV con el formato de la app: separador ';' (Excel es-ES),
// BOM UTF-8 y descarga con la fecha en el nombre del fichero.
// Antes estaba duplicado en usePersonnel y Papeletas.

export type CSVValue = string | number | boolean | null | undefined;

const escapeCSV = (value: CSVValue): string => {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
};

// buildCSV compone el contenido (separado de la descarga para poder testearlo).
export function buildCSV(headers: string[], rows: CSVValue[][]): string {
    return [
        headers.map(escapeCSV).join(";"),
        ...rows.map((row) => row.map(escapeCSV).join(";")),
    ].join("\n");
}

// downloadCSV genera y descarga `<baseName>_<dd-mm-yyyy>.csv`.
export function downloadCSV(baseName: string, headers: string[], rows: CSVValue[][]): void {
    const blob = new Blob(["\ufeff" + buildCSV(headers, rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fecha = new Date().toLocaleDateString("es-ES").split("/").join("-");
    link.download = `${baseName}_${fecha}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
