'use client'

/**
 * Desktop Toolbar Component
 * 
 * Bottom toolbar with native desktop style for Tauri application.
 * Shows: Time, Connection status, Realtime status, Data sync status
 */

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import {
    Wifi,
    WifiOff,
    RefreshCw,
    Database,
    Clock,
    Activity,
    CheckCircle2,
    Copy,
    Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncStatus } from '@/lib/db'
import { Button } from '@/components/ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

export function Toolbar() {
    const pathname = usePathname()
    const [currentTime, setCurrentTime] = useState(new Date())
    const [isOnline, setIsOnline] = useState(true)
    const [copied, setCopied] = useState(false)
    const { isSyncing, progress, isRealtimeConnected, cacheStats, refreshSync } = useSyncStatus()

    // Copy path to clipboard
    const handleCopyPath = useCallback(async () => {
        try {
            const fullUrl = typeof window !== 'undefined' ? window.location.href : pathname
            await navigator.clipboard.writeText(fullUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }, [pathname])

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        setIsOnline(navigator.onLine)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // Format time
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    // Format date
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    // Calculate total records
    const totalRecords = cacheStats
        ? Object.values(cacheStats).reduce((a, b) => a + b, 0)
        : 0

    return (
        <TooltipProvider>
            <footer className="fixed bottom-0 left-0 right-0 h-6 bg-gray-100 border-t border-gray-300 z-50 flex items-center px-2 text-[11px] select-none">
                {/* Left side - Status */}
                <div className="flex items-center space-x-3">
                    {/* Connection Status */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={cn(
                                "flex items-center space-x-1.5 px-2 py-0.5 rounded",
                                isOnline ? "text-green-700" : "text-red-600"
                            )}>
                                {isOnline ? (
                                    <Wifi className="w-3 h-3" />
                                ) : (
                                    <WifiOff className="w-3 h-3" />
                                )}
                                <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Status koneksi internet</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Separator */}
                    <div className="w-px h-3 bg-gray-300" />

                    {/* Realtime Status */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={cn(
                                "flex items-center space-x-1.5 px-2 py-0.5 rounded",
                                isRealtimeConnected ? "text-green-700" : "text-amber-600"
                            )}>
                                <Activity className={cn(
                                    "w-3 h-3",
                                    isRealtimeConnected && "animate-pulse"
                                )} />
                                <span>{isRealtimeConnected ? 'Realtime' : 'Disconnected'}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Supabase Realtime: {isRealtimeConnected ? 'Terhubung' : 'Terputus'}</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Separator */}
                    <div className="w-px h-4 bg-gray-300" />

                    {/* Sync Status */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded">
                                {isSyncing ? (
                                    <>
                                        <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                                        <span className="text-blue-600">Syncing {progress}%</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                                        <span className="text-gray-600">Synced</span>
                                    </>
                                )}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Status sinkronisasi data lokal</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Separator */}
                    <div className="w-px h-4 bg-gray-300" />

                    {/* Cache Stats */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded text-gray-600">
                                <Database className="w-3 h-3" />
                                <span>{totalRecords.toLocaleString('id-ID')} records</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="w-48">
                            <div className="space-y-1">
                                <p className="font-medium">Data Cache:</p>
                                {cacheStats && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                                        <span>Sales:</span>
                                        <span className="text-right">{cacheStats.sales}</span>
                                        <span>Produk:</span>
                                        <span className="text-right">{cacheStats.produk}</span>
                                        <span>Toko:</span>
                                        <span className="text-right">{cacheStats.toko}</span>
                                        <span>Pengiriman:</span>
                                        <span className="text-right">{cacheStats.pengiriman}</span>
                                        <span>Penagihan:</span>
                                        <span className="text-right">{cacheStats.penagihan}</span>
                                    </div>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>

                    {/* Refresh Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={refreshSync}
                        disabled={isSyncing}
                        className="h-5 px-1.5 text-[10px] text-gray-500 hover:text-gray-700"
                    >
                        <RefreshCw className={cn(
                            "w-3 h-3 mr-1",
                            isSyncing && "animate-spin"
                        )} />
                        Refresh
                    </Button>

                    {/* Separator */}
                    <div className="w-px h-3 bg-gray-300" />

                    {/* Current Path */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-gray-200/50 text-gray-600 max-w-[200px]">
                                <span className="truncate font-mono text-[10px]">{pathname}</span>
                                <button
                                    onClick={handleCopyPath}
                                    className="flex-shrink-0 p-0.5 hover:bg-gray-300/50 rounded transition-colors"
                                    type="button"
                                >
                                    {copied ? (
                                        <Check className="w-2.5 h-2.5 text-green-600" />
                                    ) : (
                                        <Copy className="w-2.5 h-2.5" />
                                    )}
                                </button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Klik untuk copy URL</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Right side - Date and Time */}
                <div className="flex items-center space-x-4">
                    {/* Date */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center space-x-1.5 text-gray-600">
                                <span>{formatDate(currentTime)}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Tanggal hari ini</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Separator */}
                    <div className="w-px h-4 bg-gray-300" />

                    {/* Time */}
                    <div className="flex items-center space-x-1.5 text-gray-700 font-medium min-w-[70px]">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(currentTime)}</span>
                    </div>
                </div>
            </footer>
        </TooltipProvider>
    )
}
