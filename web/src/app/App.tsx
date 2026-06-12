// src/app/App.tsx — Aether-Web
//
// El backend Go mantiene el pool pgx. DatabaseProvider hace polling ligero
// de /api/v1/health para alimentar el indicador del sidebar.

import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useLocation,
    Outlet,
} from "react-router-dom";
import { ThemeProvider, UserProvider, DatabaseProvider, useUser } from "@/providers";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/shared/components/layout";
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { Toaster, toast } from "sonner";
import Login from "@/features/auth/Login";
import "./App.css";

// All features imported from barrel
import {
    Dashboard,
    Effort,
    Flights,
    Personnel,
    Papeletas,
    Comisiones,
    DiasDeComision,
    Disponibilidad,
    HorasVueloPilotos,
    AdiestramientoPilotos,
    AdiestramientoDotaciones,
    InstruccionPilotos,
    InstruccionDotaciones,
    ModelRatings,
    OperationalRatings,
    GeneralTacticalRatings,
    LeadershipRatings,
    MaintenanceRatings,
} from "@/features";

function FullPageLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
}

/** Bloquea acceso si no hay sesión; redirige a /login conservando la URL destino. */
function ProtectedRoute() {
    const { isAuthenticated, loading } = useUser();
    const location = useLocation();
    if (loading) return <FullPageLoader />;
    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return <Outlet />;
}

/** Si el user YA está autenticado y aterriza en /login, lo redirigimos al destino. */
function LoginGate() {
    const { isAuthenticated, loading } = useUser();
    if (loading) return <FullPageLoader />;
    if (isAuthenticated) return <Navigate to="/" replace />;
    return <Login />;
}

function AppContent() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginGate />} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<MainLayout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="pilotos/horas-vuelo" element={<HorasVueloPilotos />} />
                        <Route path="pilotos/adiestramiento" element={<AdiestramientoPilotos />} />
                        <Route path="pilotos/instruccion" element={<InstruccionPilotos />} />
                        <Route path="dotaciones/adiestramiento" element={<AdiestramientoDotaciones />} />
                        <Route path="dotaciones/instruccion" element={<InstruccionDotaciones />} />
                        <Route path="flights" element={<Flights />} />
                        <Route path="personnel" element={<Personnel />} />
                        <Route path="papeletas" element={<Papeletas />} />
                        <Route path="calificaciones/modelRatings" element={<ModelRatings />} />
                        <Route path="calificaciones/operationalRatings" element={<OperationalRatings />} />
                        <Route path="calificaciones/generalTacticalRatings" element={<GeneralTacticalRatings />} />
                        <Route path="calificaciones/leadershipRatings" element={<LeadershipRatings />} />
                        <Route path="calificaciones/maintenanceRatings" element={<MaintenanceRatings />} />
                        <Route path="comisiones" element={<Comisiones />} />
                        <Route path="diasDeComision" element={<DiasDeComision />} />
                        <Route path="disponibilidad" element={<Disponibilidad />} />
                        <Route path="esfuerzo" element={<Effort />} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default function App() {
    const handleUserLoaded = (user: { name: string; permissionLevel: string }) => {
        logger.info(`Usuario cargado: ${user.name}`, "App");
        toast.success(`Bienvenido, ${user.name}`, {
            description: `Dispones de acceso ${user.permissionLevel}.`,
        });
    };

    const handleUserError = (error: Error) => {
        logger.error(`Error cargando usuario: ${error}`, "App");
    };

    return (
        <ThemeProvider defaultTheme="dark" storageKey="aether-web-theme">
            <QueryClientProvider client={queryClient}>
                <UserProvider onUserLoaded={handleUserLoaded} onError={handleUserError}>
                    <DatabaseProvider>
                        <TooltipProvider>
                            <AppContent />
                            <Toaster
                                position="top-center"
                                expand={true}
                                richColors
                                duration={5000}
                                toastOptions={{
                                    style: {
                                        background: "var(--muted)",
                                        color: "var(--muted-foreground)",
                                        border: "1px solid var(--ring)",
                                    },
                                }}
                            />
                        </TooltipProvider>
                    </DatabaseProvider>
                </UserProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}
