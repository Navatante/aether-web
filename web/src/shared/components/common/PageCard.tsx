import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function PageCard({ children, className }: Props) {
  return (
    <div className={cn(
      "bg-card/60 border-glass-border rounded-2xl p-5 backdrop-blur-sm border shadow-sm",
      className
    )}>
      {children}
    </div>
  );
}

export function PageCardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground mb-1">
      {children}
    </p>
  );
}
