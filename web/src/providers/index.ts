// Providers barrel export.
export {
    UserProvider,
    useUser,
    useUserData,
    useIsAuthenticated,
    useHasPermission,
    useEscuadrilla,
    PermissionLevel,
} from "./UserProvider";
export type {
    UserState,
    UserActions,
    UserContextType,
    UserSessionInfo,
    UserProviderProps,
} from "./UserProvider";

// DatabaseProvider: poll de /api/v1/health para mostrar estado a UI.
export { DatabaseProvider, useDatabase } from "./DatabaseProvider";
export type { ConnectionStatus, DatabaseContextType } from "./DatabaseProvider";

export { ThemeProvider } from "@/components/theme/theme-provider";
