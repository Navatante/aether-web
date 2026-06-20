// src/providers/UserProvider.tsx — Aether-Web (post-Tauri)
//
// Auth basada en cookie aether_session emitida por el backend Go:
//   - login(user, pass) → POST /auth/login, guarda usuario en state.
//   - logout() → POST /auth/logout, limpia state.
//   - refreshUser() → GET /auth/me, restaura sesión existente (al montar).

import {
    createContext,
    useContext,
    useState,
    useEffect,
    type ReactNode,
} from "react";
import { http, HttpError } from "@/lib/http";

// ==================== Types ====================

export enum PermissionLevel {
    COMUN = "Común",
    OPERACIONAL = "Operacional",
    ADMINISTRATIVO = "Administrativo",
    SEGURIDAD = "Seguridad",
    // Excepción god-mode: ve y puede todo (espejo del bypass del backend en
    // RequirePermission). hasPermission/canAccess devuelven true para este nivel.
    SUPERUSUARIO = "Superusuario",
}

export interface UserSessionInfo {
    id: number;
    username: string;
    name: string;
    lastName1: string;
    lastName2: string;
    nk: string | null;
    escuadrillaId: number;
    escuadrillaCode: string;
    escuadrillaName: string;
    permissionLevel: string;
    mustChangePassword: boolean;
}

export interface UserState {
    id: number | null;
    userName: string | null;
    fullName: string | null;
    nk: string | null;
    permissionLevel: PermissionLevel | null;
    escuadrillaId: number | null;
    escuadrillaCode: string | null;
    escuadrillaName: string | null;
    mustChangePassword: boolean;
    loading: boolean;
    error: Error | null;
}

export interface UserActions {
    login: (user: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    clearError: () => void;
    hasPermission: (requiredLevel: PermissionLevel) => boolean;
    canAccess: (levels: PermissionLevel[]) => boolean;
}

export type UserContextType = UserState & UserActions & {
    isAuthenticated: boolean;
};

// ==================== Initial state ====================

const initialState: UserState = {
    id: null,
    userName: null,
    fullName: null,
    nk: null,
    permissionLevel: null,
    escuadrillaId: null,
    escuadrillaCode: null,
    escuadrillaName: null,
    mustChangePassword: false,
    loading: true,
    error: null,
};

const initialContext: UserContextType = {
    ...initialState,
    isAuthenticated: false,
    login: async () => {
        throw new Error("UserProvider no inicializado");
    },
    logout: async () => {},
    refreshUser: async () => {},
    clearError: () => {},
    hasPermission: () => false,
    canAccess: () => false,
};

const UserContext = createContext<UserContextType>(initialContext);

// ==================== Provider ====================

export interface UserProviderProps {
    children: ReactNode;
    onUserLoaded?: (user: UserSessionInfo) => void;
    onError?: (error: Error) => void;
}

function fullNameOf(u: UserSessionInfo): string {
    return [u.name, u.lastName1, u.lastName2].filter(Boolean).join(" ");
}

function applyUser(u: UserSessionInfo): Partial<UserState> {
    const pl = u.permissionLevel as PermissionLevel;
    return {
        id: u.id,
        userName: u.username,
        fullName: fullNameOf(u),
        nk: u.nk ?? null,
        permissionLevel: Object.values(PermissionLevel).includes(pl) ? pl : null,
        escuadrillaId: u.escuadrillaId,
        escuadrillaCode: u.escuadrillaCode,
        escuadrillaName: u.escuadrillaName,
        mustChangePassword: u.mustChangePassword,
        loading: false,
        error: null,
    };
}

export function UserProvider({ children, onUserLoaded, onError }: UserProviderProps) {
    const [state, setState] = useState<UserState>(initialState);

    const refreshUser = async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const user = await http<UserSessionInfo>("GET", "/auth/me");
            setState((prev) => ({ ...prev, ...applyUser(user) }));
            onUserLoaded?.(user);
        } catch (err) {
            if (err instanceof HttpError && err.status === 401) {
                // No sesión: estado inicial, sin error.
                setState({ ...initialState, loading: false });
                return;
            }
            const e = err instanceof Error ? err : new Error("Error al cargar sesión");
            setState((prev) => ({ ...prev, loading: false, error: e }));
            onError?.(e);
        }
    };

    const login = async (user: string, password: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const u = await http<UserSessionInfo>("POST", "/auth/login", {
                body: { user, password },
            });
            setState((prev) => ({ ...prev, ...applyUser(u) }));
            onUserLoaded?.(u);
        } catch (err) {
            const e = err instanceof Error ? err : new Error("Error de autenticación");
            setState((prev) => ({ ...prev, loading: false, error: e }));
            throw e;
        }
    };

    const logout = async () => {
        try {
            await http<void>("POST", "/auth/logout");
        } catch {
            // best-effort
        }
        setState({ ...initialState, loading: false });
    };

    const clearError = () => {
        setState((prev) => ({ ...prev, error: null }));
    };

    const hasPermission = (level: PermissionLevel) =>
        state.permissionLevel === PermissionLevel.SUPERUSUARIO ||
        state.permissionLevel === level;

    const canAccess = (levels: PermissionLevel[]) =>
        state.permissionLevel === PermissionLevel.SUPERUSUARIO ||
        (state.permissionLevel !== null && levels.includes(state.permissionLevel));

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    const value: UserContextType = {
        ...state,
        isAuthenticated: state.id !== null,
        login,
        logout,
        refreshUser,
        clearError,
        hasPermission,
        canAccess,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// ==================== Hooks ====================

export function useUser(): UserContextType {
    return useContext(UserContext);
}

export function useUserData(): UserState {
    const ctx = useUser();
    return {
        id: ctx.id,
        userName: ctx.userName,
        fullName: ctx.fullName,
        nk: ctx.nk,
        permissionLevel: ctx.permissionLevel,
        escuadrillaId: ctx.escuadrillaId,
        escuadrillaCode: ctx.escuadrillaCode,
        escuadrillaName: ctx.escuadrillaName,
        mustChangePassword: ctx.mustChangePassword,
        loading: ctx.loading,
        error: ctx.error,
    };
}

export function useIsAuthenticated(): boolean {
    return useUser().isAuthenticated;
}

export function useHasPermission(level: PermissionLevel): boolean {
    return useUser().hasPermission(level);
}

export function useEscuadrilla(): { id: number | null; code: string | null; name: string | null } {
    const u = useUser();
    return { id: u.escuadrillaId, code: u.escuadrillaCode, name: u.escuadrillaName };
}
