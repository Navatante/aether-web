import {
    BookOpen,
    CalendarPlus,
    FileBarChart,
    FileText,
    Luggage,
    Plane,
    Presentation,
    UserMinus,
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

import { RegisterFlightDialog } from "@/features/flights"
import { RegisterGroundSchoolDialog } from "@/features/groundschool"
import { PermissionLevel, useUser } from "@/providers"
import { RegisterComisionDialog, RegisterPersonToComisionDialog } from "@/features/comisiones"
import { RegisterAbsenceDialog } from "@/features/availability"

export function TopbarMenus() {
    // === ESTADOS DE DIALOGS ===
    const [registerFlightOpen, setRegisterFlightOpen] = useState(false)
    const [registerGroundSchoolOpen, setRegisterGroundSchoolOpen] = useState(false)
    const [registerComisionOpen, setRegisterComisionOpen] = useState(false)
    const [registerPersonToComisionOpen, setRegisterPersonToComisionOpen] = useState(false)
    const [registerAusenciaOpen, setRegisterAusenciaOpen] = useState(false)

    // === CONTEXTO DE USUARIO ===
    const { hasPermission } = useUser();

    // Permisos derivados para mejor legibilidad
    const canAccessOperacional = hasPermission(PermissionLevel.OPERACIONAL);
    const canAccessAdministrativo = hasPermission(PermissionLevel.ADMINISTRATIVO);
    const canAccessOperacionalAndAdministrativo = canAccessOperacional || canAccessAdministrativo;

    // === HANDLERS ===
    const handleAbsenceSuccess = () => {
        window.dispatchEvent(new CustomEvent('refresh-availability'));
    };

    return (
        <>
            <Menubar className="hidden lg:flex border-none bg-transparent [&>*]:hover:bg-accent [&>*]:hover:text-accent-foreground">

                {/* ========== MENÚ REGISTRAR ========== */}
                {canAccessOperacionalAndAdministrativo && (
                    <MenubarMenu>
                        <MenubarTrigger>Registrar</MenubarTrigger>
                        <MenubarContent>

                            {/* --- Sección Vuelos (Solo OPERACIONAL) --- */}
                            {canAccessOperacional && (
                                <>
                                    <MenubarItem onSelect={() => setRegisterFlightOpen(true)}>
                                        <Plane className="mr-2 h-4 w-4" />
                                        Vuelo
                                    </MenubarItem>
                                    <MenubarItem onSelect={() => setRegisterGroundSchoolOpen(true)}>
                                        <Presentation className="mr-2 h-4 w-4" />
                                        Ground School
                                    </MenubarItem>
                                    <MenubarItem>
                                        <BookOpen className="mr-2 h-4 w-4" />
                                        Horas Previas
                                    </MenubarItem>
                                    <MenubarSeparator />
                                </>
                            )}

                            {/* --- Sección Comisiones (Solo ADMINISTRATIVO) --- */}
                            {canAccessAdministrativo && (
                                <>
                                    <MenubarItem onSelect={() => setRegisterComisionOpen(true)}>
                                        <CalendarPlus className="mr-2 h-4 w-4" />
                                        Comisión
                                    </MenubarItem>
                                    <MenubarItem onSelect={() => setRegisterPersonToComisionOpen(true)}>
                                        <Luggage className="mr-2 h-4 w-4" />
                                        Personal en Comisión
                                    </MenubarItem>
                                    <MenubarSeparator />
                                </>
                            )}

                            {/* --- Ausencias (OPERACIONAL y ADMINISTRATIVO) --- */}
                            <MenubarItem onSelect={() => setRegisterAusenciaOpen(true)}>
                                <UserMinus className="mr-2 h-4 w-4" />
                                Ausencia
                            </MenubarItem>

                        </MenubarContent>
                    </MenubarMenu>
                )}

                {/* ========== MENÚ DOCUMENTOS ========== */}
                <MenubarMenu>
                    <MenubarTrigger>Documentos</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem>
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
        </>
    )
}