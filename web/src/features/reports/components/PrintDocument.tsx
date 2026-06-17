// PrintDocument — marco de impresión común a todos los informes.
// Gestiona la barra de acciones (.no-print), los estados carga/error y el
// disparo automático de impresión (autoprint) cuando los datos están listos.
// El contenido concreto (las páginas del informe) entra como children.

import { useEffect } from "react";
import { Loader2, Printer, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import "@/app/print.css";

interface PrintDocumentProps {
    /** Título mostrado en la barra de acciones (no se imprime). */
    title: string;
    /** Si true, lanza window.print() en cuanto los datos están listos. */
    autoprint: boolean;
    isLoading: boolean;
    error: string | null;
    children: React.ReactNode;
}

export function PrintDocument({ title, autoprint, isLoading, error, children }: PrintDocumentProps) {
    const ready = !isLoading && !error;

    // Autoprint: imprime al estar listos los datos; cierra la pestaña al terminar.
    useEffect(() => {
        if (!autoprint || !ready) return;
        const onAfterPrint = () => window.close();
        window.addEventListener("afterprint", onAfterPrint, { once: true });
        // Pequeño respiro para que el layout/SVGs terminen de pintar.
        const id = window.setTimeout(() => window.print(), 300);
        return () => {
            window.clearTimeout(id);
            window.removeEventListener("afterprint", onAfterPrint);
        };
    }, [autoprint, ready]);

    return (
        <div>
            {/* Barra de acciones — nunca se imprime */}
            <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background px-6 py-3">
                <span className="text-sm font-medium text-foreground">{title}</span>
                <Button size="sm" onClick={() => window.print()} disabled={!ready}>
                    <Printer className="h-4 w-4" />
                    Generar PDF
                </Button>
            </div>

            {isLoading && (
                <div className="no-print flex h-[60vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {error && (
                <div className="no-print mx-auto mt-12 flex max-w-md items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
                    <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                    <span>Error generando el informe: {error}</span>
                </div>
            )}

            {ready && <div className="print-surface">{children}</div>}
        </div>
    );
}
