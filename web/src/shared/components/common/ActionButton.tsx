import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "refresh" | "export" | "add" | "edit" | "delete" | "default";
    size?: "sm" | "md" | "lg";
    icon: LucideIcon;
    iconSize?: number;
    label: string;
    loading?: boolean;
    loadingText?: string;
}

const baseClasses = [
    "flex items-center gap-2.5 rounded-xl font-medium transition-all duration-200 backdrop-blur-md border",
    "bg-white border-gray-200 text-gray-700",
    "dark:bg-white/5 dark:border-white/10 dark:text-gray-300",
    "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
};

const variantClasses = {
    refresh:
        "hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-white/10 dark:hover:border-white/20",
    add:
        "hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:border-emerald-500/30 dark:hover:text-emerald-400",
    export: "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:border-blue-500/30 dark:hover:text-blue-400",
    edit:
        "hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/30 dark:hover:text-amber-400",
    delete:
        "hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:border-red-500/30 dark:hover:text-red-400",
    default:
        "hover:bg-gray-50 hover:border-gray-300 dark:hover:bg-white/10 dark:hover:border-white/20",
};

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
    (
        {
            variant = "default",
            size = "md",
            icon: Icon,
            iconSize,
            label,
            loading,
            loadingText,
            className,
            ...props
        },
        ref
    ) => {
        const getIconSize = () => {
            if (iconSize !== undefined) return iconSize;
            switch (size) {
                case "sm": return 16;
                case "md": return 20;
                case "lg": return 24;
                default: return 20;
            }
        };

        return (
            <button
                ref={ref}
                className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
                aria-label={props["aria-label"] || label}
                {...props}
            >
                <Icon
                    className={cn(
                        loading && "animate-spin",
                        "transition-transform group-hover:scale-110"
                    )}
                    style={{
                        width: getIconSize(),
                        height: getIconSize(),
                    }}
                />
                {loading ? loadingText || "Procesando..." : label}
            </button>
        );
    }
);

ActionButton.displayName = "ActionButton";
