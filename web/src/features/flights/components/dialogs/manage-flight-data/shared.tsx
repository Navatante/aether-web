// Tipos y subcomponentes compartidos por los tabs de ManageFlightDataDialog.

import { Loader2 } from "lucide-react";

export type TabId = 'lugares' | 'aeronaves' | 'eventos';

export interface DeleteTarget {
    type: TabId;
    sk: number;
    label: string;
}

export function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        </div>
    );
}

export function LoadingState() {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-slate-600 dark:text-slate-300">Cargando...</span>
        </div>
    );
}

export function EmptyState({ text }: { text: string }) {
    return (
        <div className="p-8 text-center text-muted-foreground">{text}</div>
    );
}
