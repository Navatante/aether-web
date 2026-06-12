import { cva, type VariantProps } from "class-variance-authority";

const variants = cva("px-2 py-0.5 rounded text-xs font-medium", {
  variants: {
    type: {
      b1: "bg-caracteristica-b1 text-caracteristica-b1-foreground",
      b2: "bg-caracteristica-b2 text-caracteristica-b2-foreground",
      lv: "bg-caracteristica-lv text-caracteristica-lv-foreground"
    }
  }
});

type CaracteristicaType = "b1" | "b2" | "lv";

interface Props extends VariantProps<typeof variants> {
  type: CaracteristicaType;
  children: React.ReactNode;
}

export function CaracteristicaBadge({ type, children }: Props) {
  return <span className={variants({ type })}>{children}</span>;
}
