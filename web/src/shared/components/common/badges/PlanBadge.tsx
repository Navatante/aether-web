import { cva, type VariantProps } from "class-variance-authority";

const variants = cva("px-2 py-0.5 rounded text-xs font-medium", {
  variants: {
    plan: {
      "instruction1-pilot": "bg-plan-instruction1-pilot text-plan-instruction1-pilot-foreground",
      "instruction2-pilot": "bg-plan-instruction2-pilot text-plan-instruction2-pilot-foreground",
      "instruction1-dv": "bg-plan-instruction1-dv text-plan-instruction1-dv-foreground",
      "instruction2-dv": "bg-plan-instruction2-dv text-plan-instruction2-dv-foreground"
    }
  }
});

type PlanType = "instruction1-pilot" | "instruction2-pilot" | "instruction1-dv" | "instruction2-dv";

interface Props extends VariantProps<typeof variants> {
  plan: PlanType;
  children: React.ReactNode;
}

export function PlanBadge({ plan, children }: Props) {
  return <span className={variants({ plan })}>{children}</span>;
}
