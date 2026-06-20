import { queryKeys } from "@/lib/queryKeys";
import { InstruccionPage, type InstruccionVariant } from "../InstruccionPage";

const variant: InstruccionVariant = {
    title: "Instrucción de Dotaciones",
    roles: "Dotación,Dotación/Nadador",
    planes: "Instrucción 1 Dotación,Instrucción 2 Dotación",
    queryKey: queryKeys.training.instruccion.dotaciones,
};

export default function InstruccionDotaciones() {
    return <InstruccionPage variant={variant} />;
}
