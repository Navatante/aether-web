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
    "bg-background border-border text-foreground",
    "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ");

const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
};

const variantClasses = {
    refresh:
        "hover:bg-accent hover:border-ring/50",
    add:
        "hover:bg-success-muted hover:border-success/40 hover:text-success",
    export: "hover:bg-info-muted hover:border-info/40 hover:text-info",
    edit:
        "hover:bg-warning-muted hover:border-warning/40 hover:text-warning",
    delete:
        "hover:bg-danger-muted hover:border-danger/40 hover:text-danger",
    default:
        "hover:bg-accent hover:border-ring/50",
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
