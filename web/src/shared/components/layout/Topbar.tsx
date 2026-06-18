import { useState } from "react"
import { TopbarMenus } from "./TopbarMenus"
import { ModeToggle } from "@/components/theme/mode-toggle"
import OutlineGradientButton from "@/shared/components/common/OutlineGradientButton"
import { SuperuserButton } from "@/features/superuser"
import { ChangePasswordDialog } from "@/features/auth"
import { useUser, useUserData, PermissionLevel } from "@/providers"
import { KeyRound, LogOut } from "lucide-react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

export function Topbar() {
  const { nk, escuadrillaId, permissionLevel } = useUserData();
  const { logout } = useUser();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [crewPanelOpen, setCrewPanelOpen] = useState(false);

  return (
    <>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4">
          <div className="flex flex-1 items-center gap-4 px-4">

            <div className="flex items-center gap-2 select-none pointer-events-none">
              <img className="h-8 w-auto" src="/aether-logo.svg" alt="Aether logo"/>
            </div>

            <div>
              <TopbarMenus/>
            </div>

            <div className="ml-auto flex items-center gap-10">

                <div className="select-none cursor-default text-danger">
                    {/*TODO esta linea es debug para comprobar que se carga bien la escuadrilla al principio*/}
                    {escuadrillaId ? "🛠️ App en desarrollo" : "Escuadrilla no cargada"}
                </div>

              {nk !== null && (
                  <Sheet open={crewPanelOpen} onOpenChange={setCrewPanelOpen}>
                    <SheetTrigger asChild>
                      <div>
                        <OutlineGradientButton
                            text={nk}
                            size="xs"
                            textColor="text-foreground/80 hover:text-foreground"
                            gradient="from-gradient-from to-gradient-to hover:from-brand-from hover:via-brand-via hover:to-brand-to"
                        />
                      </div>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-1/3">
                      <SheetHeader>
                        <SheetTitle>Panel de Tripulante</SheetTitle>
                        <SheetDescription>
                          Información de vuelo personalizada.
                        </SheetDescription>
                      </SheetHeader>

                      <div className="mt-6 space-y-6 m-12">
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Usuario Actual</h3>
                            <p className="text-sm text-muted-foreground">Currate los galones en illustrator y pon galones, empleo y apellidos {nk}</p>
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold mb-2">Configuración</h3>
                            <div className="space-y-2">
                              <button className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors">
                                <div className="font-medium">Perfil</div>
                                <div className="text-sm text-muted-foreground">Edita tu información personal</div>
                              </button>
                              <button className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors">
                                <div className="font-medium">Preferencias</div>
                                <div className="text-sm text-muted-foreground">Personaliza tu experiencia</div>
                              </button>
                              <button
                                  className="flex w-full items-start gap-3 text-left p-3 rounded-lg hover:bg-accent transition-colors"
                                  onClick={() => {
                                    setCrewPanelOpen(false)
                                    setChangePasswordOpen(true)
                                  }}
                              >
                                <KeyRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">Cambiar contraseña</div>
                                  <div className="text-sm text-muted-foreground">Actualiza tu contraseña de acceso</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <SheetFooter className="mt-8 gap-2">
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => void logout()}
                        >
                          <LogOut className="h-4 w-4" />
                          Cerrar sesión
                        </Button>
                        <SheetClose asChild>
                          <Button variant="outline" className="w-full">
                            Cerrar
                          </Button>
                        </SheetClose>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
              )}
              {permissionLevel === PermissionLevel.SUPERUSUARIO && <SuperuserButton/>}
              <ModeToggle/>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
