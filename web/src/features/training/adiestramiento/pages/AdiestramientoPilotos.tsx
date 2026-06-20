import { queryKeys } from "@/lib/queryKeys";
import { AdiestramientoPage, type AdiestramientoVariant } from "../AdiestramientoPage";

const variant: AdiestramientoVariant = {
    title: "Adiestramiento de Pilotos",
    roles: "Piloto",
    bloques: "Práctico Piloto,Teórico Piloto,Simulador,Vuelo",
    queryKey: queryKeys.training.adiestramiento.pilotos,
    crpValue: (p) => p.papeleta_pilot_crp_value,
};

export default function AdiestramientoPilotos() {
    return <AdiestramientoPage variant={variant} />;
}
