import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (was cacheTime)
      retry: (failureCount, error: unknown) => {
        // Don't retry on 401/403 errors (auth issues)
        if ((error as any)?.status === 401 || (error as any)?.status === 403) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

/**
 * Query invalidation utilities for optimistic updates
 * Call these after CRUD operations to immediately refresh list pages
 */

export function invalidateSalesQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'master', 'sales'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'filters', 'sales'] })
  queryClient.invalidateQueries({ queryKey: ['sales'] })
}

export function invalidateProdukQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'master', 'produk'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'filters', 'produk'] })
  queryClient.invalidateQueries({ queryKey: ['produk'] })
}

export function invalidateTokoQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'master', 'toko'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'filters', 'toko'] })
  queryClient.invalidateQueries({ queryKey: ['toko'] })
}

export function invalidateSetoranQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'setoran'] })
  queryClient.invalidateQueries({ queryKey: ['setoran'] })
}

export function invalidatePengirimanQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'pengiriman'] })
  queryClient.invalidateQueries({ queryKey: ['pengiriman'] })
}

export function invalidatePenagihanQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'penagihan'] })
  queryClient.invalidateQueries({ queryKey: ['penagihan'] })
}

export function invalidatePengeluaranQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'pengeluaran'] })
  queryClient.invalidateQueries({ queryKey: ['pengeluaran'] })
}

export function invalidateAllDashboardQueries() {
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
