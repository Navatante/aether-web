import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,      // 5 min - desktop app, data changes infrequently
            gcTime: 30 * 60 * 1000,         // 30 min garbage collection
            retry: 1,
            refetchOnWindowFocus: false,     // Desktop app, not needed
            refetchOnReconnect: true,
        },
        mutations: {
            retry: 0,
        },
    },
});
