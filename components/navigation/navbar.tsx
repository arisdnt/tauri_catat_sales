'use client'

/**
 * Desktop Navbar Component
 * 
 * Top navigation bar with menu items and Tauri window controls.
 * Native desktop style for Tauri application.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
    Home,
    CreditCard,
    Truck,
    Receipt,
    Banknote,
    ShoppingCart,
    Store,
    Users,
    LogOut,
    ChevronDown,
    Minus,
    Square,
    X,
    Copy,
    RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useOutboxEntries } from '@/lib/db/hooks'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Menu structure
const menuItems = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: Home,
    },
    {
        title: 'Transaksi',
        icon: CreditCard,
        submenu: [
            { title: 'Pembayaran', href: '/dashboard/penagihan', icon: CreditCard },
            { title: 'Pengiriman', href: '/dashboard/pengiriman', icon: Truck },
            { title: 'Pengeluaran', href: '/dashboard/pengeluaran', icon: Receipt },
            { title: 'Setoran', href: '/dashboard/setoran', icon: Banknote },
        ]
    },
    {
        title: 'Master Data',
        icon: Store,
        submenu: [
            { title: 'Produk', href: '/dashboard/master-data/produk', icon: ShoppingCart },
            { title: 'Toko', href: '/dashboard/master-data/toko', icon: Store },
            { title: 'Sales', href: '/dashboard/master-data/sales', icon: Users },
        ]
    },
    {
        title: 'Outbox',
        href: '/dashboard/debug/outbox',
        icon: RefreshCw,
    },
]

// Check if running in Tauri environment
const isTauriEnv = () => {
    if (typeof window === 'undefined') return false
    return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

export function Navbar() {
    const pathname = usePathname()
    const { signOut } = useAuth()
    const { toast } = useToast()
    const [isMaximized, setIsMaximized] = useState(false)
    const [isTauri, setIsTauri] = useState(false)
    const { entries } = useOutboxEntries()

    // Check if running in Tauri on mount
    useEffect(() => {
        const checkTauri = isTauriEnv()
        setIsTauri(checkTauri)
        console.log('[Navbar] Tauri detected:', checkTauri)
    }, [])

    // Start window drag
    const handleStartDrag = useCallback(async (e: React.MouseEvent) => {
        // Don't drag if clicking on interactive elements
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
            return
        }

        if (isTauri) {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window')
                await getCurrentWindow().startDragging()
            } catch (err) {
                console.error('Failed to start dragging:', err)
            }
        }
    }, [isTauri])

    // Window control functions
    const handleMinimize = useCallback(async () => {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window')
            await getCurrentWindow().minimize()
        } catch (err) {
            console.error('Failed to minimize:', err)
        }
    }, [])

    const handleMaximize = useCallback(async () => {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window')
            const win = getCurrentWindow()
            const maximized = await win.isMaximized()
            if (maximized) {
                await win.unmaximize()
                setIsMaximized(false)
            } else {
                await win.maximize()
                setIsMaximized(true)
            }
        } catch (err) {
            console.error('Failed to maximize:', err)
        }
    }, [])

    const handleClose = useCallback(async () => {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window')
            await getCurrentWindow().close()
        } catch (err) {
            console.error('Failed to close:', err)
        }
    }, [])

    // Listen for maximize state changes
    useEffect(() => {
        if (!isTauri) return

        const checkMaximized = async () => {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window')
                const maximized = await getCurrentWindow().isMaximized()
                setIsMaximized(maximized)
            } catch (err) {
                console.error('Failed to check maximized state:', err)
            }
        }

        checkMaximized()

        // Check periodically for maximize state changes
        const interval = setInterval(checkMaximized, 500)
        return () => clearInterval(interval)
    }, [isTauri])

    const handleLogout = async () => {
        try {
            await signOut()
            toast({
                title: 'Berhasil',
                description: 'Logout berhasil',
            })
        } catch (_) {
            toast({
                title: 'Error',
                description: 'Gagal logout',
                variant: 'destructive',
            })
        }
    }

    const isActive = (href: string) => pathname === href
    const isGroupActive = (submenu: { href: string }[]) =>
        submenu.some(item => pathname === item.href)

    return (
        <header
            className="fixed top-0 left-0 right-0 h-12 z-50 flex items-center select-none"
            style={{ backgroundColor: '#007E6E' }}
            onMouseDown={handleStartDrag}
        >
            {/* Logo */}
            <div className="flex items-center space-x-2 px-3 h-full cursor-default">
                <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center pointer-events-none">
                    <ShoppingCart className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white text-base pointer-events-none">Tera Cendani</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex items-center space-x-0.5 px-2">
                {menuItems.map((item) => {
                    const Icon = item.icon

                    if (item.href) {
                        const isOutboxItem = item.href === '/dashboard/debug/outbox'
                        const hasOutboxProcessing = isOutboxItem
                            ? entries.some(entry => entry.status === 'in_progress')
                            : false

                        // Regular menu item
                        return (
                            <Link
                                key={item.title}
                                href={item.href}
                                className={cn(
                                    "flex items-center px-2.5 py-1 text-base font-medium rounded transition-colors",
                                    isActive(item.href)
                                        ? "bg-white/20 text-white"
                                        : "text-white/80 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "w-3.5 h-3.5 mr-1",
                                        hasOutboxProcessing && "animate-spin"
                                    )}
                                />
                                {item.title}
                            </Link>
                        )
                    }

                    // Dropdown menu
                    return (
                        <DropdownMenu key={item.title}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "flex items-center px-2.5 py-1 text-base font-medium rounded transition-colors h-auto",
                                        isGroupActive(item.submenu!)
                                            ? "bg-white/20 text-white"
                                            : "text-white/80 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5 mr-1" />
                                    {item.title}
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44 text-base">
                                {item.submenu!.map((subItem) => {
                                    const SubIcon = subItem.icon
                                    return (
                                        <DropdownMenuItem key={subItem.href} asChild className="text-base">
                                            <Link
                                                href={subItem.href}
                                                className={cn(
                                                    "flex items-center w-full cursor-pointer",
                                                    isActive(subItem.href) && "bg-blue-50 text-blue-700"
                                                )}
                                            >
                                                <SubIcon className="w-3.5 h-3.5 mr-2" />
                                                {subItem.title}
                                            </Link>
                                        </DropdownMenuItem>
                                    )
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )
                })}
            </nav>

            {/* Logout Button */}
            <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-base text-white/80 hover:text-white hover:bg-white/10 mr-1"
            >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Keluar
            </Button>

            {/* Window Controls - Always show for native look */}
            <div className="flex items-center h-full border-l border-white/20">
                {/* Minimize */}
                <button
                    onClick={handleMinimize}
                    className="h-full w-11 flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    title="Minimize"
                    type="button"
                >
                    <Minus className="w-4 h-4" strokeWidth={1.5} />
                </button>

                {/* Maximize/Restore */}
                <button
                    onClick={handleMaximize}
                    className="h-full w-11 flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    title={isMaximized ? "Restore" : "Maximize"}
                    type="button"
                >
                    {isMaximized ? (
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                    ) : (
                        <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )}
                </button>

                {/* Close */}
                <button
                    onClick={handleClose}
                    className="h-full w-11 flex items-center justify-center text-white/80 hover:bg-red-500 hover:text-white transition-colors"
                    title="Close"
                    type="button"
                >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
            </div>
        </header>
    )
}
