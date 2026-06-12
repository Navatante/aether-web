import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const handleComaToPoint = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: string) => void
) => {
  const value = e.target.value.replace(',', '.');
  onChange(value);
};

export const formatearFecha = (fechaUS: string | null | undefined) => {
    if (!fechaUS) return '';
    const fecha = new Date(fechaUS);
    return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};
