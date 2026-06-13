// Modelo compartido de la feature superusuario (god-mode).
// Tipos consumidos por el panel de superusuario; persons no pasa por tygo,
// así que estos tipos se mantienen a mano (igual que transformPersonnelFromDB).

import { PermissionLevel } from "@/providers";

// Espeja persons.SuperuserPersonItem del backend (GET /superuser/persons).
// Acotado a la escuadrilla del superusuario.
export interface SuperuserPerson {
    id: number;
    nombreCompleto: string;
    usuario: string;
    permissionLevel: string;
    tienePassword: boolean;
}

// Niveles asignables, en orden de menor a mayor alcance.
export const ASSIGNABLE_LEVELS: PermissionLevel[] = [
    PermissionLevel.COMUN,
    PermissionLevel.OPERACIONAL,
    PermissionLevel.ADMINISTRATIVO,
    PermissionLevel.SEGURIDAD,
    PermissionLevel.SUPERUSUARIO,
];
