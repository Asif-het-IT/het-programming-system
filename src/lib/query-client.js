import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,        // 2 minutes — data stays fresh
      gcTime: 1000 * 60 * 10,           // 10 minutes — keep in cache longer
      retry: 1,
      refetchOnWindowFocus: false,       // no refetch storms on tab switch
      refetchOnReconnect: 'always',      // but do refetch when network comes back
    },
  },
})
