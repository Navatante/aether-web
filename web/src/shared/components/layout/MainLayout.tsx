// shared/components/layout/MainLayout.tsx
import { Outlet } from "react-router-dom"
import { Topbar } from "./Topbar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"

function MemoizedOutlet() {
    return <Outlet />
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
                        <MemoizedOutlet />
                    </main>
                </div>
            </SidebarProvider>
        </div>
    )
}