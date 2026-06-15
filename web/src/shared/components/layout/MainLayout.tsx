// shared/components/layout/MainLayout.tsx
import { Suspense } from "react"
import { Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { Topbar } from "./Topbar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"

function MemoizedOutlet() {
    return <Outlet />
}

/** Fallback mientras se descarga el chunk de una página lazy (solo el área de contenido). */
function ContentLoader() {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
}

export function MainLayout() {
    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* Topbar arriba del toddo */}
            <Topbar />

            {/* Sidebar + Contenido debajo, defaultOpen={false} hace que este colapsada por defecto */}
            <SidebarProvider defaultOpen={false} className="h-auto flex-1 min-h-0">
                <div className="flex flex-1 overflow-hidden">
                    <AppSidebar />
                    <main className="flex-1 overflow-hidden">
                        <Suspense fallback={<ContentLoader />}>
                            <MemoizedOutlet />
                        </Suspense>
                    </main>
                </div>
            </SidebarProvider>
        </div>
    )
}