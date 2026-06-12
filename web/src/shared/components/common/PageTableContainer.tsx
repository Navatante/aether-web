import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function PageTableContainer({ children, className }: Props) {
  return (
    <div
      className={cn(
        "bg-glass border-glass-border backdrop-blur-lg rounded-2xl border mb-8",
        className
      )}
      style={{ clipPath: "inset(0 round 1rem)" }}
    >
      {children}
    </div>
  );
}
