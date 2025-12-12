'use client'

/**
 * Dexie Sync Provider
 * 
 * Initializes background sync and realtime subscriptions on app startup.
 * Wrap your app with this provider to enable data prefetching.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { initialSync, setupRealtimeSync, stopRealtimeSync, getSyncStatus, onSyncEvent } from './sync'
import { getCacheStats } from './hooks'
import { startOutboxWorker, stopOutboxWorker, processOutboxBatch } from './outbox'

interface SyncState {
    isInitializing: boolean
    isSyncing: boolean
    isRealtimeConnected: boolean
    progress: number
    error: string | null
    cacheStats: {
        sales: number
        produk: number
        toko: number
        pengiriman: number
        penagihan: number
    } | null
}

interface SyncContextValue extends SyncState {
    refreshSync: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function useSyncStatus() {
    const context = useContext(SyncContext)
    if (!context) {
        throw new Error('useSyncStatus must be used within SyncProvider')
    }
    return context
}

interface SyncProviderProps {
    children: React.ReactNode
}

export function SyncProvider({ children }: SyncProviderProps) {
    const [state, setState] = useState<SyncState>({
        isInitializing: true,
        isSyncing: false,
        isRealtimeConnected: false,
        progress: 0,
        error: null,
        cacheStats: null
    })

    // Initialize sync on mount
    useEffect(() => {
        let mounted = true

        const init = async () => {
            try {
                // Listen for sync events
                const unsubscribe = onSyncEvent((event) => {
                    if (!mounted) return

                    switch (event.type) {
                        case 'start':
                            setState(s => ({ ...s, isSyncing: true, progress: 0 }))
                            break
                        case 'progress':
                            setState(s => ({ ...s, progress: event.progress || 0 }))
                            break
                        case 'complete':
                            setState(s => ({ ...s, isSyncing: false, progress: 100 }))
                            // Update cache stats
                            getCacheStats().then(stats => {
                                if (mounted) {
                                    setState(s => ({ ...s, cacheStats: stats }))
                                }
                            })
                            break
                        case 'realtime-update':
                            // Silently update cache stats
                            getCacheStats().then(stats => {
                                if (mounted) {
                                    setState(s => ({ ...s, cacheStats: stats }))
                                }
                            })
                            break
                    }
                })

                // Start initial sync in background
                console.log('[SyncProvider] Starting initial sync...')
                initialSync().catch(err => {
                    console.error('[SyncProvider] Initial sync error:', err)
                    if (mounted) {
                        setState(s => ({ ...s, error: err.message }))
                    }
                })

                // Setup realtime subscriptions
                setupRealtimeSync()

                // Start outbox worker (process queued CRUD)
                startOutboxWorker()

                if (mounted) {
                    setState(s => ({
                        ...s,
                        isInitializing: false,
                        isRealtimeConnected: true
                    }))
                }

                // Get initial cache stats
                const stats = await getCacheStats()
                if (mounted) {
                    setState(s => ({ ...s, cacheStats: stats }))
                }

                return () => {
                    mounted = false
                    unsubscribe()
                }

            } catch (error: any) {
                console.error('[SyncProvider] Init error:', error)
                if (mounted) {
                    setState(s => ({
                        ...s,
                        isInitializing: false,
                        error: error.message
                    }))
                }
            }
        }

        init()

        // Cleanup on unmount
        return () => {
            mounted = false
            stopRealtimeSync()
            stopOutboxWorker()
        }
    }, [])

    // Manual refresh function
    const refreshSync = useCallback(async () => {
        setState(s => ({ ...s, isSyncing: true, progress: 0 }))
        // Refresh data dan coba kirim outbox sekaligus
        await Promise.all([
            initialSync(),
            processOutboxBatch()
        ])
        const stats = await getCacheStats()
        setState(s => ({
            ...s,
            isSyncing: false,
            progress: 100,
            cacheStats: stats
        }))
    }, [])

    const value: SyncContextValue = {
        ...state,
        refreshSync
    }

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    )
}

/**
 * Sync Status Indicator Component
 */
export function SyncStatusIndicator() {
    const { isSyncing, progress, isRealtimeConnected, cacheStats } = useSyncStatus()

    if (isSyncing) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span>Syncing... {progress}%</span>
            </div>
        )
    }

    if (isRealtimeConnected && cacheStats) {
        const totalRecords = Object.values(cacheStats).reduce((a, b) => a + b, 0)
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Synced ({totalRecords.toLocaleString('id-ID')} records)</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span>Offline</span>
        </div>
    )
}
