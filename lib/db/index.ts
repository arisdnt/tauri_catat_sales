/**
 * Dexie Database Module
 * 
 * Export all database-related utilities from this module.
 */

// Database instance
export { db, CatatSalesDB } from './dexie'
export type {
    Sales,
    Produk,
    Toko,
    Pengiriman,
    DetailPengiriman,
    Penagihan,
    DetailPenagihan,
    Setoran,
    PengeluaranOperasional,
    SyncMeta
} from './dexie'

// Sync utilities
export {
    initialSync,
    setupRealtimeSync,
    stopRealtimeSync,
    refreshTable,
    getSyncStatus,
    isCacheValid,
    onSyncEvent
} from './sync'

// Query hooks
export {
    useDexieQuery,
    useDexieSales,
    useDexieProduk,
    useDexieToko,
    useDexiePengiriman,
    useDexiePenagihan,
    useDexieSetoran,
    useDexiePengeluaran,
    useDexieFilterOptions,
    getCacheStats,
    useLiveQuery
} from './hooks'

// Provider
export { SyncProvider, useSyncStatus, SyncStatusIndicator } from './provider'
