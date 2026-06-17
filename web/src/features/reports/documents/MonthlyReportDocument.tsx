// MonthlyReportDocument — informe mensual de prueba (solo-render).
// Compone explícitamente sus páginas con <PrintPage>; recibe `data` por props.
// Datos de varios dominios agregados en useMonthlyReport (de momento dashboard).

import { PrintPage } from "../components/PrintPage";
import type { MonthlyReportData } from "../hooks/useMonthlyReport";

function fmtH(n: number | undefined): string {
    return `${(n ?? 0).toFixed(1)} h`;
}

function ReportHeader({ data }: { data: MonthlyReportData }) {
    return (
        <div className="report-header">
            <img src="/cabeza-sable.svg" alt="" />
            <div>
                <div className="report-title">
                    {data.escuadrillaName ? `${data.escuadrillaName} Escuadrilla` : "Escuadrilla"}
                </div>
                <div className="report-subtitle">
                    Informe mensual de operaciones · <span style={{ textTransform: "capitalize" }}>{data.monthLabel}</span>
                </div>
            </div>
        </div>
    );
}

function ReportFooter({ data }: { data: MonthlyReportData }) {
    const generated = new Date().toLocaleDateString("es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
    });
    return (
        <div className="report-footer">
            <span>Periodo: {data.rangeFrom} — {data.rangeTo}</span>
            <span>Generado el {generated}</span>
        </div>
    );
}

export function MonthlyReportDocument({ data }: { data: MonthlyReportData }) {
    const { resumenGeneral, horasPorPeriodo, horasPorHelicoptero } = data.dynamic;
    const reales = (resumenGeneral?.totalHoras ?? 0) - (resumenGeneral?.horasSimulador ?? 0);

    const periodos: Array<{ label: string; real: number; sim: number }> = [
        { label: "Día", real: horasPorPeriodo.dia_real, sim: horasPorPeriodo.dia_simulado },
        { label: "Noche sin gafas", real: horasPorPeriodo.noche_sin_gafas_real, sim: horasPorPeriodo.noche_sin_gafas_simulado },
        { label: "GVN", real: horasPorPeriodo.gvn_real, sim: horasPorPeriodo.gvn_simulado },
        { label: "ANVIS", real: horasPorPeriodo.anvis_real, sim: horasPorPeriodo.anvis_simulado },
        { label: "IIT", real: horasPorPeriodo.iit_real, sim: horasPorPeriodo.iit_simulado },
    ];

    const personal: Array<{ label: string; total: number }> = [
        { label: "Pilotos", total: data.static.pilotos.total },
        { label: "Tripulación de cabina", total: data.static.tripulacion_cabina.total },
        { label: "Mantenedores", total: data.static.mantenedores.total },
        { label: "Administrativos", total: data.static.administrativos.total },
        { label: "Efectivos totales", total: data.static.personal_total.total },
    ];

    return (
        <>
            {/* ── Página 1: portada ─────────────────────────────────────── */}
            <PrintPage>
                <div className="report-cover">
                    <img src="/cabeza-sable.svg" alt="" />
                    <div className="report-cover-title">Informe mensual de operaciones</div>
                    <div className="report-cover-month">{data.monthLabel}</div>
                    {data.escuadrillaName && (
                        <div className="report-muted">{data.escuadrillaName} Escuadrilla</div>
                    )}
                </div>
            </PrintPage>

            {/* ── Página 2: resumen de operaciones ──────────────────────── */}
            <PrintPage>
                <ReportHeader data={data} />

                <div className="report-section-title">Resumen general</div>
                <div className="report-kpi-grid">
                    <div className="report-kpi">
                        <div className="report-kpi-value">{fmtH(resumenGeneral?.totalHoras)}</div>
                        <div className="report-kpi-label">Total horas</div>
                    </div>
                    <div className="report-kpi">
                        <div className="report-kpi-value">{fmtH(reales)}</div>
                        <div className="report-kpi-label">Reales</div>
                    </div>
                    <div className="report-kpi">
                        <div className="report-kpi-value">{fmtH(resumenGeneral?.horasSimulador)}</div>
                        <div className="report-kpi-label">Simulador</div>
                    </div>
                    <div className="report-kpi">
                        <div className="report-kpi-value">{resumenGeneral?.totalVuelos ?? 0}</div>
                        <div className="report-kpi-label">Vuelos</div>
                    </div>
                </div>

                <div className="report-section-title">Horas por periodo</div>
                <table className="report-table avoid-break">
                    <thead>
                        <tr>
                            <th>Periodo</th>
                            <th className="num">Real</th>
                            <th className="num">Simulador</th>
                        </tr>
                    </thead>
                    <tbody>
                        {periodos.map((p) => (
                            <tr key={p.label}>
                                <td>{p.label}</td>
                                <td className="num">{fmtH(p.real)}</td>
                                <td className="num">{fmtH(p.sim)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="report-section-title">Horas por helicóptero</div>
                <table className="report-table avoid-break">
                    <thead>
                        <tr>
                            <th>Helicóptero</th>
                            <th className="num">Horas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {horasPorHelicoptero.length === 0 ? (
                            <tr><td colSpan={2} className="report-muted">Sin datos en el periodo</td></tr>
                        ) : (
                            horasPorHelicoptero.map((h) => (
                                <tr key={h.helo}>
                                    <td>{h.helo}</td>
                                    <td className="num">{fmtH(h.horas)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <ReportFooter data={data} />
            </PrintPage>

            {/* ── Página 3: personal ────────────────────────────────────── */}
            <PrintPage>
                <ReportHeader data={data} />

                <div className="report-section-title">Personal de la escuadrilla</div>
                <table className="report-table avoid-break">
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th className="num">Efectivos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {personal.map((p) => (
                            <tr key={p.label}>
                                <td>{p.label}</td>
                                <td className="num">{p.total}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <ReportFooter data={data} />
            </PrintPage>
        </>
    );
}
