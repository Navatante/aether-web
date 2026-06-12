export function GradientTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="bg-gradient-to-r from-gradient-from to-gradient-to bg-clip-text text-transparent text-4xl font-bold">
      {children}
    </h1>
  );
}
