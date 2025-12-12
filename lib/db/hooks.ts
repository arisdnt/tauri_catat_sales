/**
 * Dexie Query Hooks
 * 
 * Custom hooks that read from Dexie (instant) with TanStack Query wrapper.
 * Data is kept fresh via Supabase Realtime subscriptions.
 */

import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useEffect, useCallback, useMemo } from 'react'
import { db, type OutboxEntry } from './dexie'
import { onSyncEvent } from './sync'
import { useLiveQuery } from 'dexie-react-hooks'

export { useLiveQuery }

/**
 * Hook for Dexie-first queries with automatic refresh on realtime updates
 */
export function useDexieQuery<T>(
    queryKey: string[],
    dexieQueryFn: () => Promise<T>,
    options?: {
        enabled?: boolean
        staleTime?: number
        refetchOnMount?: boolean
    }
) {
    const queryClient = useQueryClient()
    const tableName = queryKey[0]

    // Listen for realtime updates to invalidate query
    useEffect(() => {
        const unsubscribe = onSyncEvent((event) => {
            if (event.type === 'realtime-update' && event.table === tableName) {
                queryClient.invalidateQueries({ queryKey })
            }
            if (event.type === 'complete') {
                queryClient.invalidateQueries({ queryKey })
            }
        })
        return () => { unsubscribe() }
    }, [queryClient, queryKey, tableName])

    return useQuery({
        queryKey,
        queryFn: dexieQueryFn,
        staleTime: options?.staleTime ?? Infinity, // Don't refetch - rely on realtime
        enabled: options?.enabled ?? true,
        refetchOnMount: options?.refetchOnMount ?? true, // Always load on mount
        refetchOnWindowFocus: false,
    })
}

/**
 * Hook for sales with Dexie
 */
export function useDexieSales(status?: 'active') {
    return useDexieQuery(
        ['sales', 'list', status || 'all'],
        async () => {
            let query = db.sales.orderBy('nama_sales')
            if (status === 'active') {
                query = db.sales.where('status_aktif').equals(1).sortBy('nama_sales') as any
            }
            const data = await query.toArray()
            return { success: true, data }
        }
    )
}

/**
 * Hook for produk with Dexie
 */
export function useDexieProduk(status?: 'active', priority?: 'priority' | 'non-priority') {
    return useDexieQuery(
        ['produk', 'list', status || 'all', priority || 'all'],
        async () => {
            let data = await db.produk.toArray()

            if (status === 'active') {
                data = data.filter(p => p.status_produk)
            }
            if (priority === 'priority') {
                data = data.filter(p => p.is_priority)
            } else if (priority === 'non-priority') {
                data = data.filter(p => !p.is_priority)
            }

            data.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk))
            return { success: true, data }
        }
    )
}

/**
 * Hook for toko with Dexie (supports pagination)
 */
export function useDexieToko(params?: {
    status?: 'active'
    id_sales?: number
    kabupaten?: string
    kecamatan?: string
    search?: string
    page?: number
    limit?: number
}) {
    const page = params?.page || 1
    const limit = params?.limit || 50

    return useDexieQuery(
        ['toko', 'list', JSON.stringify(params)],
        async () => {
            let data = await db.toko.toArray()

            // Apply filters
            if (params?.status === 'active') {
                data = data.filter(t => t.status_toko)
            }
            if (params?.id_sales) {
                data = data.filter(t => t.id_sales === params.id_sales)
            }
            if (params?.kabupaten) {
                data = data.filter(t => t.kabupaten === params.kabupaten)
            }
            if (params?.kecamatan) {
                data = data.filter(t => t.kecamatan === params.kecamatan)
            }
            if (params?.search) {
                const search = params.search.toLowerCase()
                data = data.filter(t =>
                    t.nama_toko.toLowerCase().includes(search) ||
                    t.kabupaten?.toLowerCase().includes(search) ||
                    t.kecamatan?.toLowerCase().includes(search)
                )
            }

            // Sort
            data.sort((a, b) => a.nama_toko.localeCompare(b.nama_toko))

            // Pagination
            const total = data.length
            const totalPages = Math.ceil(total / limit)
            const offset = (page - 1) * limit
            const paginatedData = data.slice(offset, offset + limit)

            return {
                success: true,
                data: {
                    data: paginatedData,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages,
                        hasNextPage: page < totalPages,
                        hasPrevPage: page > 1
                    }
                }
            }
        }
    )
}

/**
 * Hook for pengiriman with Dexie
 */
export function useDexiePengiriman(params?: {
    id_toko?: number
    tanggal_kirim?: string
    is_autorestock?: boolean
    page?: number
    limit?: number
}) {
    const page = params?.page || 1
    const limit = params?.limit || 30

    return useDexieQuery(
        ['pengiriman', 'list', JSON.stringify(params)],
        async () => {
            let data = await db.pengiriman.toArray()

            // Apply filters
            if (params?.id_toko) {
                data = data.filter(p => p.id_toko === params.id_toko)
            }
            if (params?.tanggal_kirim) {
                data = data.filter(p => p.tanggal_kirim === params.tanggal_kirim)
            }
            if (params?.is_autorestock !== undefined) {
                data = data.filter(p => p.is_autorestock === params.is_autorestock)
            }

            // Sort by date descending
            data.sort((a, b) => new Date(b.tanggal_kirim).getTime() - new Date(a.tanggal_kirim).getTime())

            // Pagination
            const total = data.length
            const totalPages = Math.ceil(total / limit)
            const offset = (page - 1) * limit
            const paginatedData = data.slice(offset, offset + limit)

            return {
                success: true,
                data: {
                    data: paginatedData,
                    pagination: { page, limit, total, totalPages }
                }
            }
        }
    )
}

/**
 * Hook for penagihan with Dexie - Returns all filtered data for virtualization
 */
export function useDexiePenagihan(params?: {
    id_toko?: number
    id_sales?: number
    metode_pembayaran?: 'Cash' | 'Transfer' | 'all'
    kabupaten?: string
    kecamatan?: string
    search?: string
    date_range?: 'today' | 'week' | 'month' | 'current_month' | 'last_month' | 'all'
}) {
    return useDexieQuery(
        ['penagihan', 'list', JSON.stringify(params)],
        async () => {
            // Get penagihan with related data and detail aggregates
            const [penagihanData, tokoData, salesData, detailData, produkData] = await Promise.all([
                db.penagihan.toArray(),
                db.toko.toArray(),
                db.sales.toArray(),
                db.detail_penagihan.toArray(),
                db.produk.toArray(),
            ])

            // Create lookup maps
            const tokoMap = new Map(tokoData.map(t => [t.id_toko, t]))
            const salesMap = new Map(salesData.map(s => [s.id_sales, s]))
            const produkMap = new Map(produkData.map(p => [p.id_produk, p]))

            // Group detail by id_penagihan to compute aggregates
            const detailByPenagihan = new Map<number, {
                totalTerjual: number
                totalKembali: number
                jenisProduk: number
                detailTerjual: string
                detailKembali: string
            }>()
            {
                const map = new Map<number, {
                    terjual: number
                    kembali: number
                    produkSet: Set<number>
                    terjualParts: string[]
                    kembaliParts: string[]
                }>()
                for (const d of detailData) {
                    const entry = map.get(d.id_penagihan) || {
                        terjual: 0,
                        kembali: 0,
                        produkSet: new Set<number>(),
                        terjualParts: [],
                        kembaliParts: []
                    }

                    const produk = produkMap.get(d.id_produk)
                    const namaProduk = (produk?.nama_produk || `Produk #${d.id_produk}`).trim()

                    entry.terjual += d.jumlah_terjual || 0
                    entry.kembali += d.jumlah_kembali || 0
                    entry.produkSet.add(d.id_produk)

                    if (d.jumlah_terjual && d.jumlah_terjual > 0) {
                        entry.terjualParts.push(`${namaProduk} [${d.jumlah_terjual}]`)
                    }
                    if (d.jumlah_kembali && d.jumlah_kembali > 0) {
                        entry.kembaliParts.push(`${namaProduk} [${d.jumlah_kembali}]`)
                    }

                    map.set(d.id_penagihan, entry)
                }
                map.forEach((v, k) => {
                    detailByPenagihan.set(k, {
                        totalTerjual: v.terjual,
                        totalKembali: v.kembali,
                        jenisProduk: v.produkSet.size,
                        detailTerjual: v.terjualParts.join(', '),
                        detailKembali: v.kembaliParts.length > 0
                            ? v.kembaliParts.join(', ')
                            : 'Tidak ada produk kembali',
                    })
                })
            }

            // Enrich penagihan dengan data toko, sales, dan agregat detail
            let data = penagihanData.map(p => {
                const toko = tokoMap.get(p.id_toko)
                const sales = toko ? salesMap.get(toko.id_sales) : undefined
                const agg = detailByPenagihan.get(p.id_penagihan)

                // Simpan juga tanggal_penagihan untuk tampilan (fallback ke dibuat_pada)
                const tanggal_penagihan = p.dibuat_pada

                return {
                    ...p,
                    id_sales: toko?.id_sales || 0,
                    nama_toko: toko?.nama_toko || 'Toko tidak ditemukan',
                    nama_sales: sales?.nama_sales || 'Sales tidak ditemukan',
                    kabupaten: (toko?.kabupaten || '').trim(),
                    kecamatan: (toko?.kecamatan || '').trim(),
                    link_gmaps: toko?.link_gmaps || '',
                    tanggal_penagihan,
                    // Aggregated detail fields for UI display
                    total_quantity_terjual: Math.max(0, (agg?.totalTerjual || 0) - (agg?.totalKembali || 0)),
                    total_jenis_produk: agg?.jenisProduk || 0,
                    detail_terjual: agg?.detailTerjual || '',
                    detail_kembali: agg?.detailKembali || 'Tidak ada produk kembali',
                }
            })

            // Apply date range filter (berbasis dibuat_pada)
            if (params?.date_range && params.date_range !== 'all') {
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                let startDate: Date
                let endDate: Date | null = null

                switch (params.date_range) {
                    case 'today':
                        startDate = today
                        endDate = today
                        break
                    case 'week':
                        startDate = new Date(today)
                        startDate.setDate(startDate.getDate() - 6)
                        endDate = today
                        break
                    case 'month':
                        startDate = new Date(today)
                        startDate.setDate(startDate.getDate() - 29)
                        endDate = today
                        break
                    case 'current_month':
                        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                        break
                    case 'last_month':
                        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
                        break
                    default:
                        startDate = new Date(0)
                }

                data = data.filter(p => {
                    const d = new Date(p.dibuat_pada)
                    if (isNaN(d.getTime())) return true

                    // Bandingkan hanya berdasarkan tanggal (bukan jam)
                    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())

                    if (endDate) {
                        return dateOnly >= startDate && dateOnly <= endDate
                    }
                    return dateOnly >= startDate
                })
            }

            // Apply filters
            if (params?.id_toko) {
                data = data.filter(p => p.id_toko === params.id_toko)
            }
            if (params?.id_sales) {
                data = data.filter(p => p.id_sales === params.id_sales)
            }
            if (params?.metode_pembayaran && params.metode_pembayaran !== 'all') {
                data = data.filter(p => p.metode_pembayaran === params.metode_pembayaran)
            }
            if (params?.kabupaten) {
                const kab = params.kabupaten.trim()
                data = data.filter(p => (p.kabupaten || '').trim() === kab)
            }
            if (params?.kecamatan) {
                const kec = params.kecamatan.trim()
                data = data.filter(p => (p.kecamatan || '').trim() === kec)
            }
            if (params?.search) {
                const search = params.search.toLowerCase().trim()
                data = data.filter(p =>
                    p.nama_toko.toLowerCase().includes(search) ||
                    p.nama_sales.toLowerCase().includes(search) ||
                    p.id_penagihan.toString().includes(search) ||
                    p.kabupaten?.toLowerCase().includes(search) ||
                    p.kecamatan?.toLowerCase().includes(search)
                )
            }

            // Sort by date descending
            data.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime())

            // Calculate totals
            const totalRevenue = data.reduce((sum, p) => sum + (p.total_uang_diterima || 0), 0)

            return {
                success: true,
                data: data,
                metadata: {
                    total: data.length,
                    totalRevenue
                }
            }
        }
    )
}

/**
 * Hook for setoran with Dexie
 */
export function useDexieSetoran(params?: {
    penerima?: string
    page?: number
    limit?: number
}) {
    const page = params?.page || 1
    const limit = params?.limit || 30

    return useDexieQuery(
        ['setoran', 'list', JSON.stringify(params)],
        async () => {
            let data = await db.setoran.toArray()

            // Apply filters
            if (params?.penerima) {
                data = data.filter(s => s.penerima_setoran.toLowerCase().includes(params.penerima!.toLowerCase()))
            }

            // Sort by date descending
            data.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime())

            // Pagination
            const total = data.length
            const totalPages = Math.ceil(total / limit)
            const offset = (page - 1) * limit
            const paginatedData = data.slice(offset, offset + limit)

            return {
                success: true,
                data: {
                    data: paginatedData,
                    pagination: { page, limit, total, totalPages }
                }
            }
        }
    )
}

/**
 * Hook for pengeluaran with Dexie
 */
export function useDexiePengeluaran(params?: {
    search?: string
    page?: number
    limit?: number
}) {
    const page = params?.page || 1
    const limit = params?.limit || 30

    return useDexieQuery(
        ['pengeluaran', 'list', JSON.stringify(params)],
        async () => {
            let data = await db.pengeluaran_operasional.toArray()

            // Apply filters
            if (params?.search) {
                const search = params.search.toLowerCase()
                data = data.filter(p => p.keterangan.toLowerCase().includes(search))
            }

            // Sort by date descending
            data.sort((a, b) => new Date(b.tanggal_pengeluaran).getTime() - new Date(a.tanggal_pengeluaran).getTime())

            // Pagination
            const total = data.length
            const totalPages = Math.ceil(total / limit)
            const offset = (page - 1) * limit
            const paginatedData = data.slice(offset, offset + limit)

            return {
                success: true,
                data: {
                    data: paginatedData,
                    pagination: { page, limit, total, totalPages }
                }
            }
        }
    )
}

/**
 * Hook for filter options (kabupaten, kecamatan, sales)
 */
export function useDexieFilterOptions() {
    return useDexieQuery(
        ['filter-options'],
        async () => {
            // Get all sales and toko, then filter by status in memory
            // (status fields may be boolean or number depending on source)
            const [allSales, allToko] = await Promise.all([
                db.sales.toArray(),
                db.toko.toArray()
            ])

            // Filter active items (handle both boolean true and number 1)
            const sales = allSales.filter(s => s.status_aktif === true || (s.status_aktif as any) === 1)
            const toko = allToko.filter(t => t.status_toko === true || (t.status_toko as any) === 1)

            const kabupaten = [...new Set(toko.map(t => t.kabupaten).filter(Boolean))]
            const kecamatan = [...new Set(toko.map(t => t.kecamatan).filter(Boolean))]

            // Build kecamatan by kabupaten mapping to enable dependent dropdowns
            const kecamatanByKabupaten: Record<string, string[]> = {}
            for (const t of toko) {
                const kab = t.kabupaten || ''
                const kec = t.kecamatan || ''
                if (!kab || !kec) continue
                if (!kecamatanByKabupaten[kab]) kecamatanByKabupaten[kab] = []
                if (!kecamatanByKabupaten[kab].includes(kec)) kecamatanByKabupaten[kab].push(kec)
            }
            // Ensure each list is sorted for stable UI
            Object.keys(kecamatanByKabupaten).forEach(k => kecamatanByKabupaten[k].sort((a, b) => a.localeCompare(b)))

            return {
                success: true,
                data: {
                    sales: sales.map(s => ({ id_sales: s.id_sales, nama_sales: s.nama_sales })),
                    kabupaten: kabupaten.map(k => ({ kabupaten: k })),
                    kecamatan: kecamatan.map(k => ({ kecamatan: k })),
                    kecamatanByKabupaten,
                }
            }
        }
    )
}

/**
 * Get record count from cache
 */
export async function getCacheStats() {
    const [sales, produk, toko, pengiriman, penagihan] = await Promise.all([
        db.sales.count(),
        db.produk.count(),
        db.toko.count(),
        db.pengiriman.count(),
        db.penagihan.count()
    ])

    return { sales, produk, toko, pengiriman, penagihan }
}

/**
 * Live hook for Dexie outbox entries.
 * Menampilkan seluruh antrean outbox dan ringkasan status.
 */
export function useOutboxEntries() {
    const entries = useLiveQuery<OutboxEntry[]>(() => {
        return db.outbox.orderBy('created_at').reverse().toArray()
    }, [])

    const stats = useMemo(() => {
        const list: OutboxEntry[] = entries ?? []
        const summary = {
            total: list.length,
            pending: 0,
            in_progress: 0,
            completed: 0,
            failed: 0
        }

        for (const entry of list) {
            if (entry.status === 'pending') summary.pending += 1
            if (entry.status === 'in_progress') summary.in_progress += 1
            if (entry.status === 'completed') summary.completed += 1
            if (entry.status === 'failed') summary.failed += 1
        }

        return summary
    }, [entries])

    return {
        entries: entries || [],
        stats
    }
}
