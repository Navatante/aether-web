import {
    BookOpen,
    CalendarPlus,
    FileBarChart,
    FileText, Fuel, Helicopter,
    HeartPulse,
    Luggage,
    Presentation,
    UserMinus,
    Waves,
    Wind,
} from "lucide-react"
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarTrigger,
} from "@/components/ui/menubar"

import {useState} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queryKeys"

import { RegisterFlightDialog } from "@/features/flights"
import { RegisterGroundSchoolDialog } from "@/features/groundschool"
import { RegisterExtraHoursDialog } from "@/features/extrahours"
// Import directo del archivo (no del barrel @/features/combustible): el barrel
// re-exporta la página Combustible (lazy en App.tsx), y traerla por el barrel la
// arrastraría al bundle principal anulando el code-split.
import RegisterFuelDialog from "@/features/combustible/components/dialogs/RegisterFuelDialog"
// Import directo del archivo (no del barrel @/features/flightsafety).
import RegisterExamDialog from "@/features/flightsafety/components/dialogs/RegisterExamDialog"
import { PermissionLevel, useUser } from "@/providers"
import { RegisterComisionDialog, RegisterPersonToComisionDialog } from "@/features/comisiones"
import { RegisterAbsenceDialog } from "@/features/availability"
import { MonthPickerDialog } from "@/features/reports"

export function TopbarMenus() {
    // === ESTADOS DE DIALOGS ===
    const [registerFlightOpen, setRegisterFlightOpen] = useState(false)
    const [registerGroundSchoolOpen, setRegisterGroundSchoolOpen] = useState(false)
    const [registerExtraHoursOpen, setRegisterExtraHoursOpen] = useState(false)
    const [registerFuelOpen, setRegisterFuelOpen] = useState(false)
    const [registerComisionOpen, setRegisterComisionOpen] = useState(false)
    const [registerPersonToComisionOpen, setRegisterPersonToComisionOpen] = useState(false)
    const [registerAusenciaOpen, setRegisterAusenciaOpen] = useState(false)
    const [generateReportOpen, setGenerateReportOpen] = useState(false)
    const [registerMedicalOpen, setRegisterMedicalOpen] = useState(false)
    const [registerDunkerOpen, setRegisterDunkerOpen] = useState(false)
    const [registerHyperbaricOpen, setRegisterHyperbaricOpen] = useState(false)

    // === CONTEXTO DE USUARIO ===
    const { hasPermission, escuadrillaId } = useUser();
    const queryClient = useQueryClient();

    // Permisos derivados para mejor legibilidad
    const canAccessOperacional = hasPermission(PermissionLevel.OPERACIONAL);
    const canAccessAdministrativo = hasPermission(PermissionLevel.ADMINISTRATIVO);
    const canAccessOperacionalAndAdministrativo = canAccessOperacional || canAccessAdministrativo;
    const canAccessSeguridad = hasPermission(PermissionLevel.SEGURIDAD);
    const canRegister = canAccessOperacionalAndAdministrativo || canAccessSeguridad;

    // === HANDLERS ===
    // Tras registrar una ausencia desde la topbar (diálogo global), invalida la
    // caché de disponibilidad de la escuadrilla: si la página Disponibilidad está
    // montada, TanStack Query la refetchea sola; si no, se refrescará al montar.
    const handleAbsenceSuccess = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.availability.all(escuadrillaId ?? 0) });
    };

    // Tras registrar un reconocimiento desde la topbar, refresca las páginas de
    // Seguridad de vuelo si están montadas.
    const handleFlightSafetySuccess = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.flightSafety.all(escuadrillaId ?? 0) });
    };

    return (
        <>
            <Menubar className="hidden lg:flex border-none bg-transparent [&>*]:hover:bg-accent [&>*]:hover:text-accent-foreground">

                {/* ========== MENÚ REGISTRAR ========== */}
                {canRegister && (
                    <MenubarMenu>
                        <MenubarTrigger>Registrar</MenubarTrigger>
                        <MenubarContent>

                            {/* --- Sección Vuelos (Solo OPERACIONAL) --- */}
                            {canAccessOperacional && (
                                <>
                                    <MenubarItem onClick={() => setRegisterFlightOpen(true)}>
                                        <Helicopter className="mr-2 h-4 w-4" />
                                        Vuelo
                                    </MenubarItem>
                                    <MenubarItem onClick={() => setRegisterGroundSchoolOpen(true)}>
                                        <Presentation className="mr-2 h-4 w-4" />
                                        Ground School
                                    </MenubarItem>
                                    <MenubarItem onClick={() => setRegisterExtraHoursOpen(true)}>
                                        <BookOpen className="mr-2 h-4 w-4" />
                                        Horas extra
                                    </MenubarItem>
                                    <MenubarItem onClick={() => setRegisterFuelOpen(true)}>
                                        <Fuel className="mr-2 h-4 w-4" />
                                        Combustible
                                    </MenubarItem>
                                    <MenubarSeparator />
                                </>
                            )}

                            {/* --- Sección Comisiones (Solo ADMINISTRATIVO) --- */}
                            {canAccessAdministrativo && (
                                <>
                                    <MenubarItem onClick={() => setRegisterComisionOpen(true)}>
                                        <CalendarPlus className="mr-2 h-4 w-4" />
                                        Comisión
                                    </MenubarItem>
                                    <MenubarItem onClick={() => setRegisterPersonToComisionOpen(true)}>
                                        <Luggage className="mr-2 h-4 w-4" />
                                        Personal en Comisión
                                    </MenubarItem>
                                    <MenubarSeparator />
                                </>
                            )}

                            {/* --- Ausencias (OPERACIONAL y ADMINISTRATIVO) --- */}
                            {canAccessOperacionalAndAdministrativo && (
                                <MenubarItem onClick={() => setRegisterAusenciaOpen(true)}>
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    Ausencia
                                </MenubarItem>
                            )}

                            {/* --- Seguridad de vuelo (Solo SEGURIDAD) --- */}
                            {canAccessSeguridad && (
                                <>
                                    {canAccessOperacionalAndAdministrativo && <MenubarSeparator />}
                                    <MenubarItem onClick={() => setRegisterMedicalOpen(true)}>
                                        <HeartPulse className="mr-2 h-4 w-4" />
                                        Rec. médico
                                    </MenubarItem>
                                    <MenubarItem onClick={() => setRegisterDunkerOpen(true)}>
                                        <Waves className="mr-2 h-4 w-4" />
                                        Dunker
                                    </MenubarItem>
                                    <MenubarItem onClick={() => setRegisterHyperbaricOpen(true)}>
                                        <Wind className="mr-2 h-4 w-4" />
                                        Hipobárica
                                    </MenubarItem>
                                </>
                            )}

                        </MenubarContent>
                    </MenubarMenu>
                )}

                {/* ========== MENÚ DOCUMENTOS ========== */}
                <MenubarMenu>
                    <MenubarTrigger>Documentos</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem onClick={() => setGenerateReportOpen(true)}>
                            <FileBarChart className="mr-2 h-4 w-4" />
                            Generar Reporte PDF
                        </MenubarItem>
                        <MenubarItem>
                            <FileText className="mr-2 h-4 w-4" />
                            Generar Factura
                        </MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem>Exportar a Excel</MenubarItem>
                        <MenubarItem>Exportar a CSV</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem>Plantillas</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>

                {/* ========== MENÚ HERRAMIENTAS ========== */}
                <MenubarMenu>
                    <MenubarTrigger>Herramientas</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem>Copia de seguridad</MenubarItem>
                        <MenubarItem>Restaurar datos</MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem>
                            Preferencias
                            <MenubarShortcut>Ctrl+,</MenubarShortcut>
                        </MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>

            {/* ========== DIALOGS ========== */}

            {/* Dialog Vuelo (OPERACIONAL) */}
            {canAccessOperacional && (
                <RegisterFlightDialog
                    open={registerFlightOpen}
                    onOpenChange={setRegisterFlightOpen}
                />
            )}

            {/* Dialog Ground School (OPERACIONAL) */}
            {canAccessOperacional && (
                <RegisterGroundSchoolDialog
                    open={registerGroundSchoolOpen}
                    onOpenChange={setRegisterGroundSchoolOpen}
                />
            )}

            {/* Dialog Horas extra (OPERACIONAL) */}
            {canAccessOperacional && (
                <RegisterExtraHoursDialog
                    open={registerExtraHoursOpen}
                    onOpenChange={setRegisterExtraHoursOpen}
                    mode="create"
                />
            )}

            {/* Dialog Combustible (OPERACIONAL) */}
            {canAccessOperacional && (
                <RegisterFuelDialog
                    open={registerFuelOpen}
                    onOpenChange={setRegisterFuelOpen}
                    mode="create"
                />
            )}

            {/* Dialogs Comisiones (ADMINISTRATIVO) */}
            {canAccessAdministrativo && (
                <>
                    <RegisterComisionDialog
                        open={registerComisionOpen}
                        onOpenChange={setRegisterComisionOpen}
                    />
                    <RegisterPersonToComisionDialog
                        open={registerPersonToComisionOpen}
                        onOpenChange={setRegisterPersonToComisionOpen}
                    />
                </>
            )}

            {/* Dialog Ausencias (OPERACIONAL y ADMINISTRATIVO) */}
            {canAccessOperacionalAndAdministrativo && (
                <RegisterAbsenceDialog
                    open={registerAusenciaOpen}
                    onOpenChange={setRegisterAusenciaOpen}
                    mode="create"
                    onSuccess={handleAbsenceSuccess}
                />
            )}

            {/* Dialogs Seguridad de vuelo (SEGURIDAD) */}
            {canAccessSeguridad && (
                <>
                    <RegisterExamDialog
                        type="medical"
                        open={registerMedicalOpen}
                        onOpenChange={setRegisterMedicalOpen}
                        mode="create"
                        onSuccess={handleFlightSafetySuccess}
                    />
                    <RegisterExamDialog
                        type="dunker"
                        open={registerDunkerOpen}
                        onOpenChange={setRegisterDunkerOpen}
                        mode="create"
                        onSuccess={handleFlightSafetySuccess}
                    />
                    <RegisterExamDialog
                        type="hyperbaric"
                        open={registerHyperbaricOpen}
                        onOpenChange={setRegisterHyperbaricOpen}
                        mode="create"
                        onSuccess={handleFlightSafetySuccess}
                    />
                </>
            )}

            {/* Dialog Generar Reporte PDF (Documentos) */}
            <MonthPickerDialog
                reportId="monthly"
                open={generateReportOpen}
                onOpenChange={setGenerateReportOpen}
            />
        </>
    )
}