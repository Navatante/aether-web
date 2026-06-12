import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type StaticDashboardDataCardProps = {
    title: string;
    value: number | string;
    details: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    loading?: boolean;
};

function StaticDashboardDataCard({
    title,
    value,
    details,
    icon: Icon,
    loading,
}: StaticDashboardDataCardProps) {
    return (
        <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {Icon && <Icon className="h-4 w-4 text-muted-foreground/50" />}
            </CardHeader>

            <CardContent>
                {loading ? (
                    <>
                        <Skeleton className="mb-3 h-9 w-20" />
                        <Skeleton className="h-24 w-full" />
                    </>
                ) : (
                    <>
                        <div className="text-3xl font-medium tracking-tight text-foreground">
                            {value}
                        </div>
                        {details}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default StaticDashboardDataCard;
