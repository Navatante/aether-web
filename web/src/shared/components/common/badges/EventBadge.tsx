import { cva, type VariantProps } from "class-variance-authority";

const variants = cva("px-2 py-0.5 rounded text-xs font-medium", {
  variants: {
    type: {
      mision: "bg-event-mision text-event-mision-foreground",
      "maniobra-nacional": "bg-event-maniobra-nacional text-event-maniobra-nacional-foreground",
      "maniobra-internacional": "bg-event-maniobra-internacional text-event-maniobra-internacional-foreground",
      pruebas: "bg-event-pruebas text-event-pruebas-foreground",
      adaptacion: "bg-event-adaptacion text-event-adaptacion-foreground",
      adiestramiento: "bg-event-adiestramiento text-event-adiestramiento-foreground",
      default: "bg-event-default text-event-default-foreground"
    }
  },
  defaultVariants: { type: "default" }
});

export type EventType = "mision" | "maniobra-nacional" | "maniobra-internacional" | "pruebas" | "adaptacion" | "adiestramiento" | "default";

interface Props extends VariantProps<typeof variants> {
  type: EventType;
  children: React.ReactNode;
}

export function EventBadge({ type, children }: Props) {
  return <span className={variants({ type })}>{children}</span>;
}
