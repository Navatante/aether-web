import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function PageControls({ children, className }: Props) {
  return (
    <div className={cn(
      "bg-glass border-glass-border backdrop-blur-lg rounded-2xl p-6 mb-8 border",
      className
    )}>
      {children}
    </div>
  );
}
