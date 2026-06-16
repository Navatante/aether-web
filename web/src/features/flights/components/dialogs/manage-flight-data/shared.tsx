// Tipos y subcomponentes compartidos por los tabs de ManageFlightDataDialog.

import { Loader2 } from "lucide-react";

export type TabId = 'lugares' | 'aeronaves' | 'eventos' | 'capba';

export interface DeleteTarget {
    type: TabId;
    sk: number;
    label: string;
}

export function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="bg-danger-muted border border-danger/30 rounded-lg p-3">
            <p className="text-sm text-danger-muted-foreground">{message}</p>
        </div>
    );
}

export function LoadingState() {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-info" />
            <span className="ml-2 text-muted-foreground">Cargando...</span>
        </div>
    );
}

export function EmptyState({ text }: { text: string }) {
    return (
        <div className="p-8 text-center text-muted-foreground">{text}</div>
    );
}
