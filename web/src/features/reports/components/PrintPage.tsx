// PrintPage — primitiva de UNA página A4 del documento.
// El autor del informe compone tantas <PrintPage> como necesite; cada una
// fuerza un salto de página al imprimir (.print-page → break-after: page).

interface PrintPageProps {
    children: React.ReactNode;
}

export function PrintPage({ children }: PrintPageProps) {
    return <section className="print-page">{children}</section>;
}
