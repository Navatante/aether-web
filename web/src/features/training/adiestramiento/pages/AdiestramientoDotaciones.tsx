import { queryKeys } from "@/lib/queryKeys";
import { AdiestramientoPage, type AdiestramientoVariant } from "../AdiestramientoPage";

const variant: AdiestramientoVariant = {
    title: "Adiestramiento de Dotaciones",
    roles: "Dotación,Dotación/Nadador",
    bloques: "Vuelo",
    queryKey: queryKeys.training.adiestramiento.dotaciones,
    crpValue: (p) => p.papeleta_dv_crp_value,
};

export default function AdiestramientoDotaciones() {
    return <AdiestramientoPage variant={variant} />;
}
