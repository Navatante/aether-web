export function EscalaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-escala text-escala-foreground">
      {children}
    </span>
  );
}
