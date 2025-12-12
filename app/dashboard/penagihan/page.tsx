'use client'

import React, { useMemo, useCallback, useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Eye,
  Edit,
  Trash2,
  MapPin,
  Package,
  Search,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { INDONESIA_TIMEZONE } from '@/lib/utils'

import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useNavigation } from '@/lib/hooks/use-navigation'

import { useFilterOptions } from '@/lib/db/hooks'
import { useDashboardPenagihanQuery } from '@/lib/queries'
import { useDeletePenagihanMutation } from '@/lib/queries/penagihan'
import { exportBillingData } from '@/lib/excel-export'

// Helper functions
function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    timeZone: INDONESIA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function formatDateWithDay(dateStr: string): { date: string; day: string } {
  const d = new Date(dateStr)
  return {
    date: d.toLocaleDateString('id-ID', { timeZone: INDONESIA_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' }),
    day: d.toLocaleDateString('id-ID', { timeZone: INDONESIA_TIMEZONE, weekday: 'short' })
  }
}

// Filter types
interface PenagihanFilters {
  search: string
  sales_id: string
  kabupaten: string
  kecamatan: string
  date_range: 'today' | 'week' | 'month' | 'current_month' | 'last_month' | 'all'
}

// Column widths as percentages (total = 100%)
const COLUMN_WIDTHS = {
  noPenagihan: '9%',    // No. Penagihan
  namaToko: '14%',      // Nama Toko  
  salesPenagih: '11%',  // Sales Penagih
  kabupaten: '10%',     // Kabupaten
  kecamatan: '10%',     // Kecamatan
  tanggal: '10%',       // Tanggal Penagihan
  total: '11%',         // Total Pembayaran
  metode: '7%',         // Metode Bayar
  detail: '11%',        // Detail Produk
  aksi: '7%'            // Aksi
}

const ROW_HEIGHT = 56
const HEADER_HEIGHT = 36

export default function PenagihanPage() {
  const { navigate } = useNavigation()
  const { toast } = useToast()
  const deletePenagihanMutation = useDeletePenagihanMutation()
  const parentRef = useRef<HTMLDivElement>(null)

  // Filters - default to 'current_month' (Bulan Ini)
  const [filters, setFilters] = useState<PenagihanFilters>({
    search: '',
    sales_id: 'all',
    kabupaten: 'all',
    kecamatan: 'all',
    date_range: 'current_month'
  })

  // Get filter options from Dexie
  const { data: filterOptions } = useFilterOptions()

  // Get penagihan data from Supabase view v_penagihan_dashboard
  const { data: dashboardResult, isLoading, refetch } = useDashboardPenagihanQuery({
    page: 1,
    limit: 500,
    search: filters.search || undefined,
    sales_id: filters.sales_id,
    kabupaten: filters.kabupaten,
    kecamatan: filters.kecamatan,
    date_range: filters.date_range
  })

  const data = dashboardResult?.data?.data || []

  const metadata = useMemo(() => {
    const total = dashboardResult?.data?.pagination?.total ?? data.length
    const totalRevenue = data.reduce((sum: number, p: any) => sum + (p.total_uang_diterima || 0), 0)
    return { total, totalRevenue }
  }, [dashboardResult, data])

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  // Handlers
  const handleFiltersChange = useCallback((newFilters: Partial<PenagihanFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      sales_id: 'all',
      kabupaten: 'all',
      kecamatan: 'all',
      date_range: 'current_month'
    })
  }, [])

  const handleDelete = useCallback((penagihan: any) => {
    if (window.confirm(`Hapus penagihan #${penagihan.id_penagihan}?`)) {
      deletePenagihanMutation.mutate(penagihan.id_penagihan, {
        onSuccess: () => {
          toast({ title: "Berhasil", description: `Penagihan #${penagihan.id_penagihan} dihapus` })
          refetch()
        },
        onError: (error: any) => {
          toast({ title: "Error", description: error.message, variant: "destructive" })
        }
      })
    }
  }, [deletePenagihanMutation, toast, refetch])

  const handleView = useCallback((penagihan: any) => {
    navigate(`/dashboard/penagihan/${penagihan.id_penagihan}`)
  }, [navigate])

  const handleEdit = useCallback((penagihan: any) => {
    navigate(`/dashboard/penagihan/${penagihan.id_penagihan}/edit`)
  }, [navigate])

  const handleExport = useCallback(() => {
    if (!data) return
    const result = exportBillingData(data)
    if (result.success) {
      toast({ title: "Export Berhasil", description: `Data diexport ke ${result.filename}` })
    } else {
      toast({ title: "Export Gagal", description: result.error, variant: "destructive" })
    }
  }, [data, toast])

  const handleAdd = useCallback(() => {
    navigate('/dashboard/penagihan/create')
  }, [navigate])

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.sales_id !== 'all' ||
    filters.kabupaten !== 'all' ||
    filters.kecamatan !== 'all' ||
    filters.date_range !== 'all'
  )

  // Kecamatan options based on selected kabupaten
  const kecamatanOptions = useMemo(() => {
    // Prefer mapped kecamatan-by-kabupaten if available
    const map = filterOptions?.kecamatanByKabupaten as Record<string, string[]> | undefined
    if (map && filters.kabupaten !== 'all') {
      const list = map[filters.kabupaten] || []
      return list.map((k) => ({ kecamatan: k }))
    }
    // Fallback to flat kecamatan list
    return filterOptions?.kecamatan || []
  }, [filterOptions, filters.kabupaten])

  // Get detail produk info from dashboard view strings
  const getDetailProduk = (item: any) => {
    const parseDetailList = (value: string | null | undefined) => {
      const text = (value || '').trim()
      if (!text || /tidak ada/i.test(text)) {
        return []
      }
      return text
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const qtyMatch = part.match(/\[(\d+)\]/)
          const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 0
          const name = part.replace(/\[\d+\]/, '').trim()
          return { name, qty }
        })
    }

    const terjualList = parseDetailList(item.detail_terjual || item.detail_produk)
    const kembaliList = parseDetailList(item.detail_kembali)

    const totalPcsTerjual = terjualList.reduce((sum, p) => sum + (p.qty || 0), 0)
    const totalPcsKembali = kembaliList.reduce((sum, p) => sum + (p.qty || 0), 0)

    return {
      totalPcsTerjual,
      jenisProdukTerjual: terjualList.length,
      totalPcsKembali,
      jenisProdukKembali: kembaliList.length,
      itemsTerjual: terjualList,
      itemsKembali: kembaliList,
    }
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden bg-white">
        {/* Filter Bar - Fixed */}
        <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[280px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Cari toko, sales, ID..."
                value={filters.search}
                onChange={(e) => handleFiltersChange({ search: e.target.value })}
                className="pl-7 h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none"
              />
            </div>

            {/* Periode */}
            <Select value={filters.date_range} onValueChange={(v) => handleFiltersChange({ date_range: v as any })}>
              <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">7 Hari</SelectItem>
                <SelectItem value="month">30 Hari</SelectItem>
                <SelectItem value="current_month">Bulan Ini</SelectItem>
                <SelectItem value="last_month">Bulan Lalu</SelectItem>
                <SelectItem value="all">Semua</SelectItem>
              </SelectContent>
            </Select>

            {/* Sales */}
            <Select value={filters.sales_id} onValueChange={(v) => handleFiltersChange({ sales_id: v })}>
              <SelectTrigger className="w-[120px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sales</SelectItem>
                {filterOptions?.sales?.map((s: any) => (
                  <SelectItem key={s.id_sales} value={s.id_sales.toString()}>{s.nama_sales}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kabupaten */}
            <Select value={filters.kabupaten} onValueChange={(v) => handleFiltersChange({ kabupaten: v, kecamatan: 'all' })}>
              <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Kabupaten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kab.</SelectItem>
                {filterOptions?.kabupaten?.map((k: any) => (
                  <SelectItem key={k.kabupaten} value={k.kabupaten}>{k.kabupaten}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kecamatan */}
            <Select value={filters.kecamatan} onValueChange={(v) => handleFiltersChange({ kecamatan: v })} disabled={filters.kabupaten === 'all'}>
              <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Kecamatan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kec.</SelectItem>
                {kecamatanOptions?.map((k: any) => (
                  <SelectItem key={k.kecamatan} value={k.kecamatan}>{k.kecamatan}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 px-2 text-xs">
                <Trash2 className="w-3 h-3" />
              </Button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Stats */}
            <span className="text-xs text-gray-500">
              {formatNumber(metadata?.total || 0)} data • {formatCurrency(metadata?.totalRevenue || 0)}
            </span>

            {/* Actions */}
            <Button onClick={handleExport} variant="outline" size="sm" className="h-7 text-xs">Export</Button>
            <Button onClick={handleAdd} size="sm" className="h-7 text-xs">+ Penagihan</Button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table Header - Fixed */}
          <div className="flex-shrink-0 border-b bg-gray-100" style={{ height: HEADER_HEIGHT }}>
            <div className="flex h-full text-sm font-semibold text-gray-700 w-full">
              <div style={{ width: COLUMN_WIDTHS.noPenagihan }} className="px-2 flex items-center border-r">No. Penagihan</div>
              <div style={{ width: COLUMN_WIDTHS.namaToko }} className="px-2 flex items-center border-r">Nama Toko</div>
              <div style={{ width: COLUMN_WIDTHS.salesPenagih }} className="px-2 flex items-center border-r">Sales Penagih</div>
              <div style={{ width: COLUMN_WIDTHS.kabupaten }} className="px-2 flex items-center border-r">Kabupaten</div>
              <div style={{ width: COLUMN_WIDTHS.kecamatan }} className="px-2 flex items-center border-r">Kecamatan</div>
              <div style={{ width: COLUMN_WIDTHS.tanggal }} className="px-2 flex items-center border-r">Tanggal Penagihan</div>
              <div style={{ width: COLUMN_WIDTHS.total }} className="px-2 flex items-center border-r">Total Pembayaran</div>
              <div style={{ width: COLUMN_WIDTHS.metode }} className="px-2 flex items-center border-r">Metode Bayar</div>
              <div style={{ width: COLUMN_WIDTHS.detail }} className="px-2 flex items-center border-r">Detail Produk</div>
              <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center">Aksi</div>
            </div>
          </div>

          {/* Virtual Scroll Container */}
          <div ref={parentRef} className="flex-1 overflow-auto scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Tidak ada data penagihan
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = data[virtualRow.index]
                  const tanggalDisplay = item.tanggal_penagihan || item.dibuat_pada
                  const dateInfo = formatDateWithDay(tanggalDisplay)
                  const detailInfo = getDetailProduk(item)

                  return (
                    <div
                      key={item.id_penagihan}
                      className="absolute w-full flex border-b hover:bg-blue-50/50 transition-colors"
                      style={{
                        height: ROW_HEIGHT,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      {/* No. Penagihan */}
                      <div style={{ width: COLUMN_WIDTHS.noPenagihan }} className="px-2 flex flex-col justify-center">
                        <span className="text-sm font-mono font-medium text-gray-900">#{item.id_penagihan}</span>
                        <span className="text-xs text-gray-500">{formatDate(tanggalDisplay)}</span>
                      </div>

                      {/* Nama Toko */}
                      <div style={{ width: COLUMN_WIDTHS.namaToko }} className="px-2 flex flex-col justify-center overflow-hidden">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.nama_toko}</span>
                        {item.link_gmaps && (
                          <a href={item.link_gmaps} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" /> Lihat Lokasi
                          </a>
                        )}
                      </div>

                      {/* Sales Penagih */}
                      <div style={{ width: COLUMN_WIDTHS.salesPenagih }} className="px-2 flex flex-col justify-center overflow-hidden">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.nama_sales}</span>
                        <span className="text-xs text-gray-500">ID Sales: {item.id_sales}</span>
                      </div>

                      {/* Kabupaten */}
                      <div style={{ width: COLUMN_WIDTHS.kabupaten }} className="px-2 flex items-center">
                        <span className="text-sm text-gray-900">{item.kabupaten || '-'}</span>
                      </div>

                      {/* Kecamatan */}
                      <div style={{ width: COLUMN_WIDTHS.kecamatan }} className="px-2 flex items-center">
                        <span className="text-sm text-gray-900">{item.kecamatan || '-'}</span>
                      </div>

                      {/* Tanggal Penagihan */}
                      <div style={{ width: COLUMN_WIDTHS.tanggal }} className="px-2 flex flex-col justify-center">
                        <span className="text-sm font-medium text-gray-900">{dateInfo.date}</span>
                        <span className="text-xs text-gray-500">({dateInfo.day})</span>
                      </div>

                      {/* Total Pembayaran */}
                      <div style={{ width: COLUMN_WIDTHS.total }} className="px-2 flex flex-col justify-center">
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(item.total_uang_diterima)}</span>
                        {item.ada_potongan && (
                          <span className="text-xs text-amber-600">Potongan: {formatCurrency((item as any).total_potongan || 0)}</span>
                        )}
                      </div>

                      {/* Metode Bayar */}
                      <div style={{ width: COLUMN_WIDTHS.metode }} className="px-2 flex items-center">
                        <span className={`text-xs px-1.5 py-0.5 ${item.metode_pembayaran === 'Cash'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                          }`}>
                          {item.metode_pembayaran === 'Cash' ? 'Tunai' : 'Transfer'}
                        </span>
                      </div>

                      {/* Detail Produk */}
                      <div style={{ width: COLUMN_WIDTHS.detail }} className="px-2 flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 cursor-help">
                              <Package className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-green-600">
                                  {formatNumber((item as any).total_quantity_terjual ?? detailInfo.totalPcsTerjual)} pcs
                                </span>
                                <span className="text-xs text-gray-500">
                                  {((item as any).total_jenis_produk ?? detailInfo.jenisProdukTerjual) || 0} jenis produk
                                </span>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-[11px] space-y-2">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Detail Penagihan #{item.id_penagihan}
                                </p>
                                <p className="text-gray-700">
                                  Tanggal: {dateInfo.date}
                                </p>
                                <p className="text-gray-700">
                                  Toko: {item.nama_toko}
                                </p>
                              </div>
                              <div className="pt-1 border-t border-gray-200">
                                <p className="font-semibold text-gray-900">
                                  Informasi Penagihan
                                </p>
                                <p className="text-gray-700">
                                  Tanggal: {dateInfo.date}
                                </p>
                                <p className="text-gray-700">
                                  Toko: {item.nama_toko}
                                </p>
                                <p className="text-gray-700">
                                  Metode: {item.metode_pembayaran}
                                </p>
                              </div>
                              <div className="pt-1 border-t border-gray-200">
                                <p className="font-semibold text-gray-900">
                                  Detail Produk Terjual
                                </p>
                                {detailInfo.itemsTerjual.length > 0 ? (
                                  detailInfo.itemsTerjual.map((p: any, idx: number) => (
                                    <p key={idx} className="text-gray-700">
                                      {p.name} {p.qty} pcs
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-gray-500">
                                    Tidak ada detail terjual
                                  </p>
                                )}
                                <p className="mt-1 font-medium text-gray-900">
                                  Total Terjual: {formatNumber(detailInfo.totalPcsTerjual)} pcs
                                </p>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Aksi */}
                      <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleView(item)} className="p-1 hover:bg-blue-100 text-blue-600">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Lihat Detail</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleEdit(item)} className="p-1 hover:bg-green-100 text-green-600">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleDelete(item)} className="p-1 hover:bg-red-100 text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Hapus</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
