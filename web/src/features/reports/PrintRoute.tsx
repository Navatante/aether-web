// PrintRoute — resuelve /print/:reportId?month=&year=&autoprint= y monta la
// vista del informe correspondiente. Esta ruta cuelga de ProtectedRoute pero
// FUERA de MainLayout: sin sidebar/topbar, para que el PDF salga limpio.

import { useParams, useSearchParams } from "react-router-dom";
import { reportRegistry } from "./reportRegistry";

function parseIntOr(value: string | null, fallback: number): number {
    const n = value ? parseInt(value, 10) : NaN;
    return Number.isFinite(n) ? n : fallback;
}

export default function PrintRoute() {
    const { reportId } = useParams<{ reportId: string }>();
    const [params] = useSearchParams();

    const entry = reportId ? reportRegistry[reportId] : undefined;
    if (!entry) {
        return (
            <div className="flex h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Informe «{reportId}» no encontrado.
            </div>
        );
    }

    const now = new Date();
    const month = parseIntOr(params.get("month"), now.getMonth() + 1);
    const year = parseIntOr(params.get("year"), now.getFullYear());
    const autoprint = params.get("autoprint") === "1";

    const { View } = entry;
    return <View month={month} year={year} autoprint={autoprint} />;
}
