/**
 * Supabase to Dexie Sync Manager
 * 
 * Handles:
 * 1. Initial background sync (prefetch all data)
 * 2. Realtime subscriptions (keep cache updated)
 * 3. Incremental updates (only fetch changed data)
 */

import { supabase } from '@/lib/supabase'
import { db } from './dexie'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Sync state
let realtimeChannel: RealtimeChannel | null = null
let isSyncing = false
let syncProgress: Record<string, { done: boolean; count: number }> = {}

// Event emitter for sync status
type SyncEventHandler = (event: { type: string; table?: string; progress?: number }) => void
const syncListeners: Set<SyncEventHandler> = new Set()

export function onSyncEvent(handler: SyncEventHandler) {
    syncListeners.add(handler)
    return () => syncListeners.delete(handler)
}

function emitSyncEvent(event: { type: string; table?: string; progress?: number }) {
    syncListeners.forEach(handler => handler(event))
}

/**
 * Base tables to sync with their primary key and batch size
 */
const SYNC_CONFIG = {
    sales: { pk: 'id_sales', batchSize: 1000 },
    produk: { pk: 'id_produk', batchSize: 1000 },
    toko: { pk: 'id_toko', batchSize: 1000 },
    pengiriman: { pk: 'id_pengiriman', batchSize: 2000 },
    detail_pengiriman: { pk: 'id_detail_kirim', batchSize: 5000 },
    penagihan: { pk: 'id_penagihan', batchSize: 2000 },
    detail_penagihan: { pk: 'id_detail_tagih', batchSize: 5000 },
    setoran: { pk: 'id_setoran', batchSize: 1000 },
    pengeluaran_operasional: { pk: 'id_pengeluaran', batchSize: 1000 },
    potongan_penagihan: { pk: 'id_potongan', batchSize: 2000 },
    public_toko: { pk: 'id_toko', batchSize: 5000 },
    system_logs: { pk: 'id', batchSize: 5000 },
    v_setoran_dashboard_backup_data: { pk: 'id_setoran', batchSize: 2000 },
    v_setoran_dashboard_backup_safe: { pk: 'id_setoran', batchSize: 2000 }
} as const

type TableName = keyof typeof SYNC_CONFIG

/**
 * View tables to mirror from Supabase into Dexie.
 * These are read-only projections; we do full fetch sync without Realtime.
 */
const VIEW_SYNC_CONFIG = {
    fetch_attention_needed: { maxRows: 10000 },
    fetch_status_summary: { maxRows: 10000 },
    v_cash_flow_dashboard: { maxRows: 10000 },
    v_cash_flow_events: { maxRows: 10000 },
    v_chart_produk_performance: { maxRows: 10000 },
    v_chart_sales_performance: { maxRows: 10000 },
    v_chart_toko_performance: { maxRows: 10000 },
    v_chart_wilayah_performance: { maxRows: 10000 },
    v_dashboard_all_transactions: { maxRows: 10000 },
    v_dashboard_cards: { maxRows: 10000 },
    v_dashboard_latest_transactions: { maxRows: 10000 },
    v_dashboard_overview: { maxRows: 10000 },
    v_kabupaten_options: { maxRows: 10000 },
    v_kecamatan_options: { maxRows: 10000 },
    v_master_produk: { maxRows: 10000 },
    v_master_sales: { maxRows: 10000 },
    v_master_toko: { maxRows: 10000 },
    v_penagihan_dashboard: { maxRows: 10000 },
    v_pengiriman_dashboard: { maxRows: 10000 },
    v_produk_options: { maxRows: 10000 },
    v_rekonsiliasi_setoran: { maxRows: 10000 },
    v_sales_options: { maxRows: 10000 },
    v_setoran_dashboard: { maxRows: 10000 },
    v_setoran_dashboard_fixed: { maxRows: 10000 },
    v_toko_options: { maxRows: 10000 }
} as const

type ViewTableName = keyof typeof VIEW_SYNC_CONFIG

/**
 * Initial full sync - runs in background on app startup
 * OPTIMIZED: Only syncs base tables on startup, views load in background
 */
export async function initialSync() {
    if (isSyncing) {
        console.log('[Sync] Already syncing, skipping...')
        return
    }

    isSyncing = true
    emitSyncEvent({ type: 'start' })
    console.log('[Sync] Starting initial sync (base tables only)...')

    const tables = Object.keys(SYNC_CONFIG) as TableName[]
    const totalItems = tables.length // Only base tables for faster startup
    syncProgress = {}

    // Sync tables in parallel with higher concurrency
    const concurrency = 4
    let processed = 0
    for (let i = 0; i < tables.length; i += concurrency) {
        const batch = tables.slice(i, i + concurrency)
        await Promise.all(batch.map(table => syncTable(table)))

        processed += batch.length
        const progress = Math.round((processed / totalItems) * 100)
        emitSyncEvent({ type: 'progress', progress })
    }

    isSyncing = false
    emitSyncEvent({ type: 'complete' })
    console.log('[Sync] Initial sync complete! (Views loading in background)')

    // Defer view sync to background after UI is responsive
    setTimeout(() => syncViewsInBackground(), 2000)
}

/**
 * Sync views in background - called after initial sync completes
 */
async function syncViewsInBackground() {
    const viewTables = Object.keys(VIEW_SYNC_CONFIG) as ViewTableName[]
    console.log('[Sync] Starting background view sync...')

    const concurrency = 2
    for (let i = 0; i < viewTables.length; i += concurrency) {
        const batch = viewTables.slice(i, i + concurrency)
        await Promise.all(batch.map(table => syncViewTable(table)))
    }

    console.log('[Sync] Background view sync complete!')
}

/**
 * Sync a single table from Supabase to Dexie
 */
async function syncTable(tableName: TableName) {
    const config = SYNC_CONFIG[tableName]
    const dexieTable = db[tableName] as any

    console.log(`[Sync] Syncing ${tableName}...`)
    emitSyncEvent({ type: 'table-start', table: tableName })

    try {
        let offset = 0
        let hasMore = true
        let totalCount = 0

        // Clear existing data for fresh sync
        await dexieTable.clear()

        while (hasMore) {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .range(offset, offset + config.batchSize - 1)
                .order(config.pk)

            if (error) {
                console.error(`[Sync] Error syncing ${tableName}:`, error)
                break
            }

            if (data && data.length > 0) {
                await dexieTable.bulkPut(data)
                totalCount += data.length
                offset += config.batchSize
                hasMore = data.length === config.batchSize
            } else {
                hasMore = false
            }
        }

        // Update sync metadata
        await db.updateSyncMeta(tableName, totalCount)

        syncProgress[tableName] = { done: true, count: totalCount }
        console.log(`[Sync] ${tableName}: ${totalCount} records synced`)
        emitSyncEvent({ type: 'table-complete', table: tableName })

    } catch (error) {
        console.error(`[Sync] Failed to sync ${tableName}:`, error)
        syncProgress[tableName] = { done: false, count: 0 }
    }
}

/**
 * Sync a read-only view from Supabase to Dexie (full refresh)
 */
async function syncViewTable(tableName: ViewTableName) {
    const config = VIEW_SYNC_CONFIG[tableName]
    const dexieTable = (db as any)[tableName]

    console.log(`[Sync] Syncing view ${tableName}...`)
    emitSyncEvent({ type: 'table-start', table: tableName })

    try {
        // Fetch up to maxRows rows from the view
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(config.maxRows)

        if (error) {
            console.error(`[Sync] Error syncing view ${tableName}:`, error)
            syncProgress[tableName] = { done: false, count: 0 }
            return
        }

        await dexieTable.clear()

        const rows = data ?? []
        if (rows.length > 0) {
            await dexieTable.bulkPut(rows)
        }

        await db.updateSyncMeta(tableName, rows.length)

        syncProgress[tableName] = { done: true, count: rows.length }
        console.log(`[Sync] View ${tableName}: ${rows.length} records synced`)
        emitSyncEvent({ type: 'table-complete', table: tableName })

    } catch (error) {
        console.error(`[Sync] Failed to sync view ${tableName}:`, error)
        syncProgress[tableName] = { done: false, count: 0 }
    }
}

/**
 * Setup Supabase Realtime subscriptions
 */
export function setupRealtimeSync() {
    if (realtimeChannel) {
        console.log('[Realtime] Already subscribed')
        return
    }

    console.log('[Realtime] Setting up subscriptions...')

    realtimeChannel = supabase.channel('db-sync')

    // Subscribe to all tables
    const tables = Object.keys(SYNC_CONFIG) as TableName[]

    tables.forEach(tableName => {
        realtimeChannel!.on(
            'postgres_changes' as any,
            { event: '*', schema: 'public', table: tableName },
            (payload: RealtimePostgresChangesPayload<any>) => handleRealtimeChange(tableName, payload)
        )
    })

    realtimeChannel.subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
    })
}

/**
 * View dependencies - which views depend on which base tables
 */
const VIEW_DEPENDENCIES: Partial<Record<TableName, ViewTableName[]>> = {
    sales: ['v_master_sales', 'v_sales_options'],
    produk: ['v_master_produk', 'v_produk_options', 'v_chart_produk_performance'],
    toko: ['v_master_toko', 'v_toko_options', 'v_chart_toko_performance', 'v_kabupaten_options', 'v_kecamatan_options'],
    penagihan: ['v_penagihan_dashboard', 'v_dashboard_cards', 'v_dashboard_overview', 'v_dashboard_latest_transactions', 'v_dashboard_all_transactions', 'v_cash_flow_dashboard', 'v_cash_flow_events'],
    detail_penagihan: ['v_penagihan_dashboard', 'v_chart_produk_performance'],
    potongan_penagihan: ['v_penagihan_dashboard'],
    pengiriman: ['v_pengiriman_dashboard', 'v_dashboard_cards'],
    detail_pengiriman: ['v_pengiriman_dashboard', 'v_chart_produk_performance'],
    setoran: ['v_setoran_dashboard', 'v_setoran_dashboard_fixed', 'v_rekonsiliasi_setoran', 'v_cash_flow_dashboard', 'v_cash_flow_events'],
    pengeluaran_operasional: ['v_cash_flow_dashboard', 'v_cash_flow_events']
}

// Debounce state for view refresh
let viewRefreshTimer: ReturnType<typeof setTimeout> | null = null
let pendingViews: Set<ViewTableName> = new Set()

/**
 * Debounced view refresh - batches multiple view refresh requests
 */
function scheduleViewRefresh(views: ViewTableName[]) {
    views.forEach(v => pendingViews.add(v))

    if (viewRefreshTimer) {
        clearTimeout(viewRefreshTimer)
    }

    viewRefreshTimer = setTimeout(async () => {
        const viewsToRefresh = Array.from(pendingViews)
        pendingViews.clear()
        viewRefreshTimer = null

        if (viewsToRefresh.length === 0) return

        console.log('[Realtime] Refreshing dependent views:', viewsToRefresh)

        // Refresh views in parallel with limited concurrency
        const concurrency = 2
        for (let i = 0; i < viewsToRefresh.length; i += concurrency) {
            const batch = viewsToRefresh.slice(i, i + concurrency)
            await Promise.all(batch.map(v => syncViewTable(v)))
        }

        console.log('[Realtime] View refresh complete')
    }, 1000) // 1 second debounce
}

/**
 * Handle realtime changes from Supabase
 * Enhanced to support optimistic update reconciliation
 */
async function handleRealtimeChange(
    tableName: TableName,
    payload: RealtimePostgresChangesPayload<any>
) {
    const dexieTable = db[tableName] as any
    const config = SYNC_CONFIG[tableName]

    console.log(`[Realtime] ${tableName} ${payload.eventType}:`, payload)

    try {
        switch (payload.eventType) {
            case 'INSERT': {
                // Check for pending optimistic records to reconcile
                const pendingRecords = await dexieTable
                    .filter((r: any) => r._pending === true && r._tempId !== undefined)
                    .toArray()

                // Find and remove matching pending record
                for (const pending of pendingRecords) {
                    if (shouldReconcile(tableName, pending, payload.new)) {
                        console.log(`[Realtime] Reconciling temp record ${pending[config.pk]} with real ${payload.new[config.pk]}`)
                        await dexieTable.delete(pending[config.pk])
                        break
                    }
                }

                // Put the real record from Supabase
                await dexieTable.put(payload.new)
                break
            }

            case 'UPDATE': {
                // Simply put the real record, overwriting any pending state
                // The real record from Supabase is the source of truth
                await dexieTable.put(payload.new)
                break
            }

            case 'DELETE': {
                const id = payload.old[config.pk]
                if (id) {
                    await dexieTable.delete(id)
                }
                break
            }
        }

        // Trigger view refresh for dependent views
        const dependentViews = VIEW_DEPENDENCIES[tableName]
        if (dependentViews && dependentViews.length > 0) {
            scheduleViewRefresh(dependentViews)
        }

        emitSyncEvent({ type: 'realtime-update', table: tableName })

    } catch (error) {
        console.error(`[Realtime] Error handling ${tableName} change:`, error)
    }
}

/**
 * Determine if a pending optimistic record should be reconciled with a real record
 */
function shouldReconcile(tableName: TableName, pending: any, real: any): boolean {
    switch (tableName) {
        case 'sales':
            return pending.nama_sales === real.nama_sales
        case 'produk':
            return pending.nama_produk === real.nama_produk && pending.harga_satuan === real.harga_satuan
        case 'toko':
            return pending.nama_toko === real.nama_toko && pending.id_sales === real.id_sales
        case 'setoran':
            return pending.total_setoran === real.total_setoran &&
                pending.penerima_setoran === real.penerima_setoran
        case 'pengeluaran_operasional':
            return pending.keterangan === real.keterangan && pending.jumlah === real.jumlah
        case 'pengiriman':
            return pending.id_toko === real.id_toko && pending.tanggal_kirim === real.tanggal_kirim
        case 'penagihan':
            return pending.id_toko === real.id_toko &&
                pending.total_uang_diterima === real.total_uang_diterima &&
                pending.metode_pembayaran === real.metode_pembayaran
        case 'detail_pengiriman':
            return pending.id_pengiriman === real.id_pengiriman &&
                pending.id_produk === real.id_produk
        case 'detail_penagihan':
            return pending.id_penagihan === real.id_penagihan &&
                pending.id_produk === real.id_produk
        case 'potongan_penagihan':
            return pending.id_penagihan === real.id_penagihan
        default:
            return false
    }
}

/**
 * Stop realtime subscriptions
 */
export function stopRealtimeSync() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
        realtimeChannel = null
        console.log('[Realtime] Unsubscribed')
    }

    // Clear any pending view refresh
    if (viewRefreshTimer) {
        clearTimeout(viewRefreshTimer)
        viewRefreshTimer = null
        pendingViews.clear()
    }
}

/**
 * Force refresh a specific table
 */
export async function refreshTable(tableName: TableName) {
    await syncTable(tableName)
}

/**
 * Force refresh specific views
 */
export async function refreshViews(views: ViewTableName[]) {
    for (const view of views) {
        await syncViewTable(view)
    }
}

/**
 * Get sync status
 */
export function getSyncStatus() {
    return {
        isSyncing,
        progress: syncProgress,
        isRealtimeConnected: realtimeChannel !== null
    }
}

/**
 * Check if cache is valid (has data)
 */
export async function isCacheValid(): Promise<boolean> {
    const salesCount = await db.sales.count()
    const produkCount = await db.produk.count()
    return salesCount > 0 && produkCount > 0
}
