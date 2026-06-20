// shared/components/common/ErrorBoundary.tsx
//
// Boundary de render para el área de contenido. Un error no controlado durante
// el render de una página dejaría la app en blanco; aquí lo capturamos, lo
// registramos vía logger y mostramos un fallback con opción de reintentar.
// React Router (modo SPA, sin data router) no aporta errorElement, así que el
// boundary es manual. Se monta con `key={location.pathname}` para que navegar a
// otra ruta lo reinicie automáticamente.

import React from "react";
import { RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** Contexto para el log (p. ej. "MainLayout"). */
    context?: string;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        logger.error(
            `${error.message}\n${info.componentStack ?? ""}`,
            this.props.context ?? "ErrorBoundary",
        );
    }

    private handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        if (this.state.error) {
            return (
                <div className="flex h-full items-center justify-center p-6">
                    <div className="max-w-md rounded-xl bg-danger-muted p-8 text-center">
                        <h2 className="mb-2 text-xl font-semibold text-danger-muted-foreground">
                            Algo ha fallado al mostrar esta página
                        </h2>
                        <p className="mb-6 text-sm text-muted-foreground">
                            Se ha producido un error inesperado. Puedes reintentar o navegar a
                            otra sección.
                        </p>
                        <button
                            onClick={this.handleReset}
                            className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-danger-foreground transition-colors hover:bg-danger/90"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Reintentar
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
