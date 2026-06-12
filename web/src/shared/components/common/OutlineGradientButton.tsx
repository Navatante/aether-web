import React from 'react';

// Define los tipos de tamaño permitidos
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Define las props del componente
interface OutlineGradientButtonProps {
    icon?: React.ReactNode;
    text?: string;
    size?: ButtonSize;
    onClick?: () => void;
    gradient?: string;
    textColor?: string;
    textHoverColor?: string;
    className?: string;
    children?: React.ReactNode;
}

export default function OutlineGradientButton({
                                                  icon,
                                                  text,
                                                  size = 'md',
                                                  onClick,
                                                  gradient = 'from-purple-400 to-pink-400',
                                                  textColor = 'text-foreground',
                                                  textHoverColor = 'group-hover:text-primary',
                                                  className = '',
                                                  children
                                              }: OutlineGradientButtonProps) {
    // Define las clases con tipado explícito
    const sizeClasses: Record<ButtonSize, string> = {
        xs: 'w-10 h-10 text-xs',
        sm: 'w-12 h-12 text-xs',
        md: 'w-16 h-16 text-sm',
        lg: 'w-20 h-20 text-base',
        xl: 'w-24 h-24 text-lg'
    };

    const iconSizes: Record<ButtonSize, string> = {
        xs: 'w-3 h-3',
        sm: 'w-5 h-5',
        md: 'w-7 h-7',
        lg: 'w-8 h-8',
        xl: 'w-10 h-10'
    };

    const borderWidth: Record<ButtonSize, string> = {
        xs: 'p-[2px]',
        sm: 'p-[2px]',
        md: 'p-[2px]',
        lg: 'p-[3px]',
        xl: 'p-[3px]'
    };

    // Define el tamaño del glow basado en el tamaño del botón
    // Usa el color ring del tema actual
    const glowSize: Record<ButtonSize, string> = {
        xs: 'hover:shadow-[0_0_10px_var(--color-ring)]',
        sm: 'hover:shadow-[0_0_20px_var(--color-ring)]',
        md: 'hover:shadow-[0_0_25px_var(--color-ring)]',
        lg: 'hover:shadow-[0_0_30px_var(--color-ring)]',
        xl: 'hover:shadow-[0_0_35px_var(--color-ring)]'
    };

    return (
        <button
            onClick={onClick}
            className={`
                relative ${sizeClasses[size]} rounded-full bg-transparent 
                transition-all duration-300
                active:scale-95 group ${glowSize[size]} ${className}
            `}
            style={{
                // Respaldo para navegadores que no soporten bien las variables CSS en shadow
                '--tw-shadow-color': 'var(--tag-blue-color)',
            } as React.CSSProperties}
        >
            <span className={`absolute inset-0 rounded-full bg-gradient-to-r ${gradient} ${borderWidth[size]}`}>
                <span className={`
                    flex h-full w-full items-center justify-center rounded-full 
                    bg-background
                    transition-all duration-300
                `}>
                    {text ? (
                        <span className={`font-semibold tracking-wide ${textColor} ${textHoverColor} transition-colors duration-300`}>
                            {text}
                        </span>
                    ) : icon ? (
                        <div className={`${iconSizes[size]} ${textColor} ${textHoverColor} transition-colors duration-300`}>
                            {icon}
                        </div>
                    ) : children ? (
                        <span className={`font-semibold ${textColor} ${textHoverColor} transition-colors duration-300`}>
                            {children}
                        </span>
                    ) : (
                        <svg
                            className={`${iconSizes[size]} ${textColor} ${textHoverColor} transition-colors duration-300`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                            />
                        </svg>
                    )}
                </span>
            </span>
        </button>
    );
}