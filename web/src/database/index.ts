// database/index.ts
//
// Re-exports database-related modules.
// Note: Lookup queries are now in @/shared/hooks (useLookups.ts)

export { DATABASE_CONFIG } from './config';
export { DatabaseProvider, useDatabase } from '@/providers';
export type { ConnectionStatus, DatabaseContextType } from '@/providers';
