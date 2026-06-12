import { cva, type VariantProps } from "class-variance-authority";

const variants = cva("px-2 py-0.5 rounded-full text-xs font-medium", {
  variants: {
    role: {
      pilot: "bg-role-pilot text-role-pilot-foreground",
      crew: "bg-role-crew text-role-crew-foreground",
      swimmer: "bg-role-swimmer text-role-swimmer-foreground",
      crewAndSwimmer: "bg-gradient-to-r from-role-crew to-role-swimmer text-role-crew-foreground",
      noCrew: "bg-role-no-crew text-role-no-crew-foreground",
      default: "bg-role-default text-role-default-foreground"
    }
  },
  defaultVariants: { role: "default" }
});

type Role = "pilot" | "crew" | "swimmer" | "crewAndSwimmer" | "noCrew" | "default";

interface Props extends VariantProps<typeof variants> {
  role: Role;
  children: React.ReactNode;
}

export function RoleBadge({ role, children }: Props) {
  return <span className={variants({ role })}>{children}</span>;
}
