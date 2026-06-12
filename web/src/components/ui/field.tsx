"use client"

import * as React from "react"
import { Field as FieldPrimitive } from "@base-ui/react/field"

import { cn } from "@/lib/utils"

type FieldOrientation = "vertical" | "horizontal"

interface FieldProps extends FieldPrimitive.Root.Props {
    orientation?: FieldOrientation
}

function Field({
                   className,
                   orientation = "vertical",
                   ...props
               }: FieldProps) {
    return (
        <FieldPrimitive.Root
            data-slot="field"
            data-orientation={orientation}
            className={cn(
                "group/field flex w-full",
                orientation === "vertical" && "flex-col gap-2",
                orientation === "horizontal" && "flex-row items-center gap-4",
                className
            )}
            {...props}
        />
    )
}

function FieldContent({
                          className,
                          ...props
                      }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-content"
            className={cn("flex flex-1 flex-col gap-1", className)}
            {...props}
        />
    )
}

function FieldLabel({
                        className,
                        ...props
                    }: FieldPrimitive.Label.Props) {
    return (
        <FieldPrimitive.Label
            data-slot="field-label"
            className={cn(
                "text-sm font-medium leading-none text-foreground",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                className
            )}
            {...props}
        />
    )
}

function FieldDescription({
                              className,
                              ...props
                          }: FieldPrimitive.Description.Props) {
    return (
        <FieldPrimitive.Description
            data-slot="field-description"
            className={cn("text-xs text-muted-foreground", className)}
            {...props}
        />
    )
}

function FieldError({
                        className,
                        ...props
                    }: FieldPrimitive.Error.Props) {
    return (
        <FieldPrimitive.Error
            data-slot="field-error"
            className={cn("text-xs text-destructive", className)}
            {...props}
        />
    )
}

export { Field, FieldContent, FieldLabel, FieldDescription, FieldError }
