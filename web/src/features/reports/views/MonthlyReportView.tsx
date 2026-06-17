// MonthlyReportView — une el hook de datos, el documento y el marco de impresión
// para el informe mensual. Es el componente que monta la ruta /print/:reportId.

import { PrintDocument } from "../components/PrintDocument";
import { MonthlyReportDocument } from "../documents/MonthlyReportDocument";
import { useMonthlyReport } from "../hooks/useMonthlyReport";
import type { ReportViewProps } from "../reportRegistry";

export function MonthlyReportView({ month, year, autoprint }: ReportViewProps) {
    const { isLoading, error, data } = useMonthlyReport(month, year);
    return (
        <PrintDocument
            title="Informe mensual de operaciones"
            autoprint={autoprint}
            isLoading={isLoading}
            error={error}
        >
            {data && <MonthlyReportDocument data={data} />}
        </PrintDocument>
    );
}
