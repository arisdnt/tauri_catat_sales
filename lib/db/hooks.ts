/**
 * Dexie Query Hooks
 * 
 * Uses useLiveQuery directly from dexie-react-hooks for instant
 * reactivity. No React Query wrapper overhead.
 */

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type OutboxEntry } from './dexie'

export { useLiveQuery }

/**
 * Hook for filter options (sales, kabupaten, kecamatan)
 */
export function useFilterOptions() {
    const sales = useLiveQuery(
        () => db.sales.where('status_aktif').equals(1).sortBy('nama_sales'),
        []
    )

    const toko = useLiveQuery(
        () => db.toko.where('status_toko').equals(1).toArray(),
        []
    )

    const options = useMemo(() => {
        if (!toko) return { sales: [], kabupaten: [], kecamatan: [], kecamatanByKabupaten: {} }

        const kabupatenSet = new Set<string>()
        const kecamatanSet = new Set<string>()
        const kecamatanByKabupaten: Record<string, string[]> = {}

        for (const t of toko) {
            if (t.kabupaten) kabupatenSet.add(t.kabupaten)
            if (t.kecamatan) kecamatanSet.add(t.kecamatan)
            if (t.kabupaten && t.kecamatan) {
                if (!kecamatanByKabupaten[t.kabupaten]) {
                    kecamatanByKabupaten[t.kabupaten] = []
                }
                if (!kecamatanByKabupaten[t.kabupaten].includes(t.kecamatan)) {
                    kecamatanByKabupaten[t.kabupaten].push(t.kecamatan)
                }
            }
        }

        return {
            sales: (sales || []).map(s => ({ id_sales: s.id_sales, nama_sales: s.nama_sales })),
            kabupaten: Array.from(kabupatenSet).sort().map(k => ({ kabupaten: k })),
            kecamatan: Array.from(kecamatanSet).sort().map(k => ({ kecamatan: k })),
            kecamatanByKabupaten
        }
    }, [sales, toko])

    return {
        isLoading: sales === undefined || toko === undefined,
        data: options
    }
}

/**
 * Hook for penagihan with live updates
 */
export function usePenagihan(params?: {
    id_toko?: number
    id_sales?: number
    metode_pembayaran?: 'Cash' | 'Transfer' | 'all'
    kabupaten?: string
    kecamatan?: string
    search?: string
    date_range?: 'today' | 'week' | 'month' | 'current_month' | 'last_month' | 'all'
}) {
    const dateRange = useMemo(() => {
        if (!params?.date_range || params.date_range === 'all') return null

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        let startDate: Date
        let endDate: Date = today

        switch (params.date_range) {
            case 'today':
                startDate = today
                break
            case 'week':
                startDate = new Date(today)
                startDate.setDate(startDate.getDate() - 6)
                break
            case 'month':
                startDate = new Date(today)
                startDate.setDate(startDate.getDate() - 29)
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
                return null
        }

        return { startDate, endDate }
    }, [params?.date_range])

    const penagihan = useLiveQuery(async () => {
        let query = db.penagihan.orderBy('dibuat_pada').reverse()

        if (params?.metode_pembayaran && params.metode_pembayaran !== 'all') {
            query = db.penagihan
                .where('metode_pembayaran')
                .equals(params.metode_pembayaran)
                .reverse()
        }

        return query.toArray()
    }, [params?.metode_pembayaran])

    const tokoMap = useLiveQuery(async () => {
        const toko = await db.toko.toArray()
        return new Map(toko.map(t => [t.id_toko, t]))
    }, [])

    const salesMap = useLiveQuery(async () => {
        const sales = await db.sales.toArray()
        return new Map(sales.map(s => [s.id_sales, s]))
    }, [])

    const detailByPenagihan = useLiveQuery(async () => {
        const details = await db.detail_penagihan.toArray()
        const produk = await db.produk.toArray()
        const produkLookup = new Map(produk.map(p => [p.id_produk, p]))

        const map = new Map<number, {
            totalTerjual: number
            totalKembali: number
            jenisProduk: number
            detailTerjual: string
            detailKembali: string
        }>()

        const tempMap = new Map<number, {
            terjual: number
            kembali: number
            produkSet: Set<number>
            terjualParts: string[]
            kembaliParts: string[]
        }>()

        for (const d of details) {
            const entry = tempMap.get(d.id_penagihan) || {
                terjual: 0,
                kembali: 0,
                produkSet: new Set<number>(),
                terjualParts: [],
                kembaliParts: []
            }

            const produkItem = produkLookup.get(d.id_produk)
            const namaProduk = (produkItem?.nama_produk || `Produk #${d.id_produk}`).trim()

            entry.terjual += d.jumlah_terjual || 0
            entry.kembali += d.jumlah_kembali || 0
            entry.produkSet.add(d.id_produk)

            if (d.jumlah_terjual && d.jumlah_terjual > 0) {
                entry.terjualParts.push(`${namaProduk} [${d.jumlah_terjual}]`)
            }
            if (d.jumlah_kembali && d.jumlah_kembali > 0) {
                entry.kembaliParts.push(`${namaProduk} [${d.jumlah_kembali}]`)
            }

            tempMap.set(d.id_penagihan, entry)
        }

        tempMap.forEach((v, k) => {
            map.set(k, {
                totalTerjual: v.terjual,
                totalKembali: v.kembali,
                jenisProduk: v.produkSet.size,
                detailTerjual: v.terjualParts.join(', '),
                detailKembali: v.kembaliParts.length > 0
                    ? v.kembaliParts.join(', ')
                    : 'Tidak ada produk kembali',
            })
        })

        return map
    }, [])

    const result = useMemo(() => {
        if (!penagihan || !tokoMap || !salesMap || !detailByPenagihan) {
            return { data: [], metadata: { total: 0, totalRevenue: 0 }, isLoading: true }
        }

        let data = penagihan.map(p => {
            const toko = tokoMap.get(p.id_toko)
            const sales = toko ? salesMap.get(toko.id_sales) : undefined
            const agg = detailByPenagihan.get(p.id_penagihan)

            return {
                ...p,
                id_sales: toko?.id_sales || 0,
                nama_toko: toko?.nama_toko || 'Toko tidak ditemukan',
                nama_sales: sales?.nama_sales || 'Sales tidak ditemukan',
                kabupaten: (toko?.kabupaten || '').trim(),
                kecamatan: (toko?.kecamatan || '').trim(),
                link_gmaps: toko?.link_gmaps || '',
                tanggal_penagihan: p.dibuat_pada,
                total_quantity_terjual: Math.max(0, (agg?.totalTerjual || 0) - (agg?.totalKembali || 0)),
                total_jenis_produk: agg?.jenisProduk || 0,
                detail_terjual: agg?.detailTerjual || '',
                detail_kembali: agg?.detailKembali || 'Tidak ada produk kembali',
            }
        })

        if (dateRange) {
            data = data.filter(p => {
                const d = new Date(p.dibuat_pada)
                if (isNaN(d.getTime())) return true
                const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
                return dateOnly >= dateRange.startDate && dateOnly <= dateRange.endDate
            })
        }

        if (params?.id_toko) {
            data = data.filter(p => p.id_toko === params.id_toko)
        }
        if (params?.id_sales) {
            data = data.filter(p => p.id_sales === params.id_sales)
        }
        if (params?.kabupaten) {
            const kab = params.kabupaten.trim()
            data = data.filter(p => p.kabupaten === kab)
        }
        if (params?.kecamatan) {
            const kec = params.kecamatan.trim()
            data = data.filter(p => p.kecamatan === kec)
        }
        if (params?.search) {
            const search = params.search.toLowerCase().trim()
            data = data.filter(p =>
                p.nama_toko.toLowerCase().includes(search) ||
                p.nama_sales.toLowerCase().includes(search) ||
                p.id_penagihan.toString().includes(search)
            )
        }

        const totalRevenue = data.reduce((sum, p) => sum + (p.total_uang_diterima || 0), 0)

        return {
            data,
            metadata: { total: data.length, totalRevenue },
            isLoading: false
        }
    }, [penagihan, tokoMap, salesMap, detailByPenagihan, dateRange, params])

    return result
}

/**
 * Hook for toko with live updates
 */
export function useToko(params?: {
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

    const data = useLiveQuery(async () => {
        let toko = await db.toko.toArray()

        if (params?.status === 'active') {
            toko = toko.filter(t => t.status_toko)
        }
        if (params?.id_sales) {
            toko = toko.filter(t => t.id_sales === params.id_sales)
        }
        if (params?.kabupaten) {
            toko = toko.filter(t => t.kabupaten === params.kabupaten)
        }
        if (params?.kecamatan) {
            toko = toko.filter(t => t.kecamatan === params.kecamatan)
        }
        if (params?.search) {
            const search = params.search.toLowerCase()
            toko = toko.filter(t =>
                t.nama_toko.toLowerCase().includes(search) ||
                t.kabupaten?.toLowerCase().includes(search) ||
                t.kecamatan?.toLowerCase().includes(search)
            )
        }

        toko.sort((a, b) => a.nama_toko.localeCompare(b.nama_toko))
        return toko
    }, [params?.status, params?.id_sales, params?.kabupaten, params?.kecamatan, params?.search])

    const result = useMemo(() => {
        if (!data) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 }, isLoading: true }

        const total = data.length
        const totalPages = Math.ceil(total / limit)
        const offset = (page - 1) * limit
        const paginatedData = data.slice(offset, offset + limit)

        return {
            data: paginatedData,
            pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
            isLoading: false
        }
    }, [data, page, limit])

    return result
}

/**
 * Hook for sales with live updates
 */
export function useSales(status?: 'active') {
    const data = useLiveQuery(async () => {
        if (status === 'active') {
            return db.sales.where('status_aktif').equals(1).sortBy('nama_sales')
        }
        return db.sales.orderBy('nama_sales').toArray()
    }, [status])

    return {
        data: data || [],
        isLoading: data === undefined
    }
}

/**
 * Hook for produk with live updates
 */
export function useProduk(status?: 'active', priority?: 'priority' | 'non-priority') {
    const data = useLiveQuery(async () => {
        let produk = await db.produk.toArray()

        if (status === 'active') {
            produk = produk.filter(p => p.status_produk)
        }
        if (priority === 'priority') {
            produk = produk.filter(p => p.is_priority)
        } else if (priority === 'non-priority') {
            produk = produk.filter(p => !p.is_priority)
        }

        produk.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk))
        return produk
    }, [status, priority])

    return {
        data: data || [],
        isLoading: data === undefined
    }
}

/**
 * Hook for pengiriman with live updates
 */
export function usePengiriman(params?: {
    id_toko?: number
    tanggal_kirim?: string
    is_autorestock?: boolean
    page?: number
    limit?: number
}) {
    const page = params?.page || 1
    const limit = params?.limit || 30

    const data = useLiveQuery(async () => {
        let pengiriman = await db.pengiriman.toArray()

        if (params?.id_toko) {
            pengiriman = pengiriman.filter(p => p.id_toko === params.id_toko)
        }
        if (params?.tanggal_kirim) {
            pengiriman = pengiriman.filter(p => p.tanggal_kirim === params.tanggal_kirim)
        }
        if (params?.is_autorestock !== undefined) {
            pengiriman = pengiriman.filter(p => p.is_autorestock === params.is_autorestock)
        }

        pengiriman.sort((a, b) => new Date(b.tanggal_kirim).getTime() - new Date(a.tanggal_kirim).getTime())
        return pengiriman
    }, [params?.id_toko, params?.tanggal_kirim, params?.is_autorestock])

    const result = useMemo(() => {
        if (!data) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 }, isLoading: true }

        const total = data.length
        const totalPages = Math.ceil(total / limit)
        const offset = (page - 1) * limit
        const paginatedData = data.slice(offset, offset + limit)

        return {
            data: paginatedData,
            pagination: { page, limit, total, totalPages },
            isLoading: false
        }
    }, [data, page, limit])

    return result
}

/**
 * Hook for setoran with live updates
 */
export function useSetoran(params?: {
    penerima?: string
    page?: number
    limit?: number
}) {
    const page = params?.page || 1
    const limit = params?.limit || 30

    const data = useLiveQuery(async () => {
        let setoran = await db.setoran.toArray()

        if (params?.penerima) {
            setoran = setoran.filter(s =>
                s.penerima_setoran.toLowerCase().includes(params.penerima!.toLowerCase())
            )
        }

        setoran.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime())
        return setoran
    }, [params?.penerima])

    const result = useMemo(() => {
        if (!data) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 }, isLoading: true }

        const total = data.length
        const totalPages = Math.ceil(total / limit)
        const offset = (page - 1) * limit
        const paginatedData = data.slice(offset, offset + limit)

        return {
            data: paginatedData,
            pagination: { page, limit, total, totalPages },
            isLoading: false
        }
    }, [data, page, limit])

    return result
}

/**
 * Hook for pengeluaran with live updates
 */
export function usePengeluaran(params?: {
    search?: string
    page?: number
    limit?: number
}) {
    const page = params?.page || 1
    const limit = params?.limit || 30

    const data = useLiveQuery(async () => {
        let pengeluaran = await db.pengeluaran_operasional.toArray()

        if (params?.search) {
            const search = params.search.toLowerCase()
            pengeluaran = pengeluaran.filter(p => p.keterangan.toLowerCase().includes(search))
        }

        pengeluaran.sort((a, b) => new Date(b.tanggal_pengeluaran).getTime() - new Date(a.tanggal_pengeluaran).getTime())
        return pengeluaran
    }, [params?.search])

    const result = useMemo(() => {
        if (!data) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 }, isLoading: true }

        const total = data.length
        const totalPages = Math.ceil(total / limit)
        const offset = (page - 1) * limit
        const paginatedData = data.slice(offset, offset + limit)

        return {
            data: paginatedData,
            pagination: { page, limit, total, totalPages },
            isLoading: false
        }
    }, [data, page, limit])

    return result
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
 * Hook for outbox entries
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
