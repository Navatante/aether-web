import { queryKeys } from "@/lib/queryKeys";
import { InstruccionPage, type InstruccionVariant } from "../InstruccionPage";

const variant: InstruccionVariant = {
    title: "Instrucción de Pilotos",
    roles: "Piloto",
    planes: "Instrucción 1 Piloto,Instrucción 2 Piloto",
    queryKey: queryKeys.training.instruccion.pilotos,
};

export default function InstruccionPilotos() {
    return <InstruccionPage variant={variant} />;
}
