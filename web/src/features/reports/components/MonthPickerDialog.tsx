// MonthPickerDialog — diálogo controlado para elegir el mes de un informe.
// Al confirmar, abre la ruta de impresión en una pestaña nueva con autoprint.
// Lo dispara cualquier entrada de UI (p. ej. el menú "Documentos" del topbar).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface MonthPickerDialogProps {
    /** Clave en reportRegistry. */
    reportId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MonthPickerDialog({ reportId, open, onOpenChange }: MonthPickerDialogProps) {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
    const [year, setYear] = useState(now.getFullYear());

    const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

    const handleGenerate = () => {
        const url = `/print/${reportId}?month=${month}&year=${year}&autoprint=1`;
        window.open(url, "_blank", "noopener");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Generar informe mensual</DialogTitle>
                    <DialogDescription>
                        Elige el mes del que quieres obtener la documentación. El informe cubrirá el mes completo.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-3 py-2">
                    <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS_ES.map((name, idx) => (
                                <SelectItem key={idx} value={String(idx + 1)}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter>
                    <Button onClick={handleGenerate}>Generar PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
