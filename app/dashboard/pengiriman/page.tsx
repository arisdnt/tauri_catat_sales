'use client'

import React, { useMemo, useCallback, useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Eye,
  Edit,
  Trash2,
  MapPin,
  PackageOpen,
  Search,
  RefreshCw,
  Loader2,
  Save,
  X
} from 'lucide-react'

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

import { useDashboardPengirimanQuery } from '@/lib/queries'
import { usePengirimanDetailQuery } from '@/lib/queries/pengiriman'
import { useDeletePengirimanMutation } from '@/lib/queries/pengiriman'
import { exportShipmentData } from '@/lib/excel-export'
import { useFilterOptions } from '@/lib/db/hooks'
import { INDONESIA_TIMEZONE, formatCurrency } from '@/lib/utils'
import { ModalBox } from '@/components/ui/modal-box'
import { PengirimanEditForm } from './[id]/edit/pengiriman-edit-form'

// Helper functions
function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
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
interface PengirimanFilters {
  search: string
  is_autorestock: string
  sales_id: string
  kabupaten: string
  kecamatan: string
  date_range: 'today' | 'week' | 'month' | 'current_month' | 'last_month' | 'all'
}

// Column widths as percentages (total = 100%)
const COLUMN_WIDTHS = {
  noPengiriman: '9%',
  namaToko: '17%',
  salesPengirim: '13%',
  kabupaten: '11%',
  kecamatan: '11%',
  tanggal: '12%',
  detail: '20%',
  aksi: '7%'
}

const ROW_HEIGHT = 56
const HEADER_HEIGHT = 36

export default function ShippingPage() {
  const { navigate } = useNavigation()
  const { toast } = useToast()
  const deleteShipment = useDeletePengirimanMutation()
  const parentRef = useRef<HTMLDivElement>(null)

  // Filters - default to 'current_month' (Bulan Ini)
  const [filters, setFilters] = useState<PengirimanFilters>({
    search: '',
    is_autorestock: 'all',
    sales_id: 'all',
    kabupaten: 'all',
    kecamatan: 'all',
    date_range: 'current_month'
  })

  // Get filter options from Dexie
  const { data: filterOptions } = useFilterOptions()

  // Get pengiriman data from Dexie-backed dashboard view
  const { data: dashboardResult, isLoading, refetch } = useDashboardPengirimanQuery({
    page: 1,
    limit: 500,
    search: filters.search || undefined,
    is_autorestock: filters.is_autorestock,
    sales_id: filters.sales_id,
    kabupaten: filters.kabupaten,
    kecamatan: filters.kecamatan,
    date_range: filters.date_range
  })

  const data = dashboardResult?.data?.data || []

  const metadata = useMemo(() => {
    const total = dashboardResult?.data?.pagination?.total ?? data.length
    const totalQuantity = data.reduce((sum: number, p: any) => {
      const qty = (p as any).total_quantity ?? (p as any).total_quantity_kirim ?? 0
      return sum + qty
    }, 0)
    const totalValue = data.reduce((sum: number, p: any) => {
      const value = (p as any).total_nilai_kirim ?? 0
      return sum + value
    }, 0)
    return { total, totalQuantity, totalValue }
  }, [dashboardResult, data])

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  // Handlers
  const handleFiltersChange = useCallback((newFilters: Partial<PengirimanFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      is_autorestock: 'all',
      sales_id: 'all',
      kabupaten: 'all',
      kecamatan: 'all',
      date_range: 'current_month'
    })
  }, [])

  const handleDelete = useCallback((pengiriman: any) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus pengiriman #${pengiriman.id_pengiriman}?`)) {
      deleteShipment.mutate(pengiriman.id_pengiriman, {
        onSuccess: () => {
          toast({
            title: "Berhasil",
            description: `Pengiriman #${pengiriman.id_pengiriman} berhasil dihapus`,
          })
          refetch()
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Gagal menghapus pengiriman",
            variant: "destructive",
          })
        }
      })
    }
  }, [deleteShipment, toast, refetch])

  const computeDetailSummary = useCallback((item: any) => {
    const detailString = (item.detail_pengiriman ?? item.detail_produk ?? '').trim()
    if (!detailString || /tidak ada detail/i.test(detailString)) {
      return {
        totalQty: (item.total_quantity ?? item.total_quantity_kirim ?? 0) as number,
        jenisProduk: (item.jumlah_jenis_produk ?? 0) as number,
        items: [] as Array<{ nama_produk: string; jumlah_kirim: number }>,
        sales: item.nama_sales,
      }
    }

    const parts = detailString
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)

    const items = parts.map(part => {
      const match = part.match(/^(.+?)\s*\[(\d+)\]$/)
      if (!match) {
        return { nama_produk: part, jumlah_kirim: 0 }
      }
      return {
        nama_produk: match[1].trim(),
        jumlah_kirim: parseInt(match[2], 10) || 0
      }
    }).filter(p => p.nama_produk && !/tidak ada detail/i.test(p.nama_produk))

    const totalFromItems = items.reduce((sum, p) => sum + (p.jumlah_kirim || 0), 0)
    const totalQty = (item.total_quantity ?? item.total_quantity_kirim ?? totalFromItems) as number
    const jenisProduk = (item.jumlah_jenis_produk ?? items.length) as number

    return {
      totalQty,
      jenisProduk,
      items,
      sales: item.nama_sales,
    }
  }, [])

  const [selectedPengiriman, setSelectedPengiriman] = useState<any | null>(null)
  const [selectedDetailInfo, setSelectedDetailInfo] = useState<ReturnType<typeof computeDetailSummary> | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const detailPengirimanQuery = usePengirimanDetailQuery(selectedPengiriman?.id_pengiriman ?? 0)
  const detailPengirimanData = (detailPengirimanQuery.data as { data: any })?.data
  const modalEditFormId = selectedPengiriman
    ? `pengiriman-edit-form-${selectedPengiriman.id_pengiriman}`
    : undefined

  const handleView = useCallback((pengiriman: any) => {
    setSelectedPengiriman(pengiriman)
    setSelectedDetailInfo(computeDetailSummary(pengiriman))
    setDetailModalOpen(true)
  }, [])

  const handleEdit = useCallback((pengiriman: any) => {
    setSelectedPengiriman(pengiriman)
    setSelectedDetailInfo(computeDetailSummary(pengiriman))
    setEditModalOpen(true)
  }, [])

  const handleExport = useCallback(() => {
    if (!data) return
    const result = exportShipmentData(data)
    if (result.success) {
      toast({
        title: "Export Berhasil",
        description: `Data berhasil diexport ke ${result.filename}`,
      })
    } else {
      toast({
        title: "Export Gagal",
        description: result.error || "Terjadi kesalahan saat export",
        variant: "destructive",
      })
    }
  }, [data, toast])

  const handleAdd = useCallback(() => {
    navigate('/dashboard/pengiriman/add')
  }, [navigate])

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.is_autorestock !== 'all' ||
    filters.sales_id !== 'all' ||
    filters.kabupaten !== 'all' ||
    filters.kecamatan !== 'all' ||
    filters.date_range !== 'all'
  )

  // Kecamatan options based on selected kabupaten
  const kecamatanOptions = useMemo(() => {
    const map = (filterOptions as any)?.data?.kecamatanByKabupaten as Record<string, string[]> | undefined
    if (map && filters.kabupaten !== 'all') {
      const list = map[filters.kabupaten] || []
      return list.map((k) => ({ kecamatan: k }))
    }
    return (filterOptions as any)?.data?.kecamatan || []
  }, [filterOptions, filters.kabupaten])

  // Get detail pengiriman info from dashboard view strings

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
              <SelectTrigger className="w-[140px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sales</SelectItem>
                {filterOptions?.data?.sales?.map((s: any) => (
                  <SelectItem key={s.id_sales} value={s.id_sales.toString()}>{s.nama_sales}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kabupaten */}
            <Select value={filters.kabupaten} onValueChange={(v) => handleFiltersChange({ kabupaten: v, kecamatan: 'all' })}>
              <SelectTrigger className="w-[140px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Kabupaten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kab.</SelectItem>
                {filterOptions?.data?.kabupaten?.map((k: any) => (
                  <SelectItem key={k.kabupaten} value={k.kabupaten}>{k.kabupaten}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kecamatan */}
            <Select
              value={filters.kecamatan}
              onValueChange={(v) => handleFiltersChange({ kecamatan: v })}
              disabled={filters.kabupaten === 'all'}
            >
              <SelectTrigger className="w-[140px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Kecamatan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kec.</SelectItem>
                {kecamatanOptions?.map((k: any) => (
                  <SelectItem key={k.kecamatan} value={k.kecamatan}>{k.kecamatan}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Auto-restock */}
            <Select
              value={filters.is_autorestock}
              onValueChange={(v) => handleFiltersChange({ is_autorestock: v })}
            >
              <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Jenis Kirim" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="true">Auto-restock</SelectItem>
                <SelectItem value="false">Manual</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-xs"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Stats */}
            <span className="text-xs text-gray-500">
              {formatNumber(metadata?.total || 0)} pengiriman • {formatNumber(metadata?.totalQuantity || 0)} pcs • {formatCurrency(metadata?.totalValue || 0)}
            </span>

            {/* Actions */}
            <Button
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm" className="h-7 text-xs">
              Export
            </Button>
            <Button onClick={handleAdd} size="sm" className="h-7 text-xs">
              + Pengiriman
            </Button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table Header - Fixed */}
          <div className="flex-shrink-0 border-b bg-gray-100" style={{ height: HEADER_HEIGHT }}>
            <div className="flex h-full text-sm font-semibold text-gray-700 w-full">
              <div style={{ width: COLUMN_WIDTHS.noPengiriman }} className="px-2 flex items-center border-r">No. Pengiriman</div>
              <div style={{ width: COLUMN_WIDTHS.namaToko }} className="px-2 flex items-center border-r">Nama Toko</div>
              <div style={{ width: COLUMN_WIDTHS.salesPengirim }} className="px-2 flex items-center border-r">Sales Pengirim</div>
              <div style={{ width: COLUMN_WIDTHS.kabupaten }} className="px-2 flex items-center border-r">Kabupaten</div>
              <div style={{ width: COLUMN_WIDTHS.kecamatan }} className="px-2 flex items-center border-r">Kecamatan</div>
              <div style={{ width: COLUMN_WIDTHS.tanggal }} className="px-2 flex items-center border-r">Tanggal Kirim</div>
              <div style={{ width: COLUMN_WIDTHS.detail }} className="px-2 flex items-center border-r">Detail Pengiriman</div>
              <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center">Aksi</div>
            </div>
          </div>

          {/* Virtual Scroll Container */}
          <div ref={parentRef} className="flex-1 overflow-auto scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : data.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Tidak ada data pengiriman
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = data[virtualRow.index]
                  const tanggalDisplay = item.tanggal_kirim || item.tanggal_input
                  const dateInfo = tanggalDisplay ? formatDateWithDay(tanggalDisplay) : { date: '-', day: '' }
                  const detailInfo = computeDetailSummary(item)

                  return (
                    <div
                      key={item.id_pengiriman}
                      className="absolute w-full flex border-b hover:bg-blue-50/50 transition-colors"
                      style={{
                        height: ROW_HEIGHT,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      {/* No. Pengiriman */}
                      <div style={{ width: COLUMN_WIDTHS.noPengiriman }} className="px-2 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-mono font-medium text-gray-900">#{item.id_pengiriman}</span>
                          {item.is_autorestock && (
                            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800">
                              Auto-restock
                            </Badge>
                          )}
                        </div>
                        {tanggalDisplay && (
                          <span className="text-xs text-gray-500">{formatDate(tanggalDisplay)}</span>
                        )}
                      </div>

                      {/* Nama Toko */}
                      <div style={{ width: COLUMN_WIDTHS.namaToko }} className="px-2 flex flex-col justify-center overflow-hidden">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.nama_toko}</span>
                        {item.link_gmaps && (
                          <a
                            href={item.link_gmaps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                          >
                            <MapPin className="w-2.5 h-2.5" /> Lihat Lokasi
                          </a>
                        )}
                      </div>

                      {/* Sales Pengirim */}
                      <div style={{ width: COLUMN_WIDTHS.salesPengirim }} className="px-2 flex flex-col justify-center overflow-hidden">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.nama_sales || 'Sales tidak tersedia'}</span>
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

                      {/* Tanggal Kirim */}
                      <div style={{ width: COLUMN_WIDTHS.tanggal }} className="px-2 flex flex-col justify-center">
                        <span className="text-sm font-medium text-gray-900">{dateInfo.date}</span>
                        {dateInfo.day && (
                          <span className="text-xs text-gray-500">({dateInfo.day})</span>
                        )}
                      </div>

                      {/* Detail Pengiriman */}
                      <div style={{ width: COLUMN_WIDTHS.detail }} className="px-2 flex items-center">
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 cursor-help">
                              <PackageOpen className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-blue-600">
                                  {formatNumber(detailInfo.totalQty)} pcs
                                </span>
                                <span className="text-xs text-gray-500">
                                  {detailInfo.jenisProduk} jenis produk
                                </span>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-[11px] space-y-2">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Detail Pengiriman #{item.id_pengiriman}
                                </p>
                                {tanggalDisplay && (
                                  <p className="text-gray-700">
                                    Tanggal: {dateInfo.date}
                                  </p>
                                )}
                                <p className="text-gray-700">
                                  Toko: {item.nama_toko}
                                </p>
                              </div>
                              <div className="pt-1 border-t border-gray-200">
                                <p className="font-semibold text-gray-900">
                                  Detail Produk Dikirim
                                </p>
                                {detailInfo.items.length > 0 ? (
                                  detailInfo.items.map((p: any, idx: number) => (
                                    <p key={idx} className="text-gray-700">
                                      {p.nama_produk} {formatNumber(p.jumlah_kirim)} pcs
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-gray-500">
                                    Tidak ada detail pengiriman
                                  </p>
                                )}
                                <p className="mt-1 font-medium text-gray-900">
                                  Total Dikirim: {formatNumber(detailInfo.totalQty)} pcs
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

      {/* Detail Modal */}
      <ModalBox
        open={detailModalOpen && !!selectedPengiriman}
        onOpenChange={(open) => {
      setDetailModalOpen(open)
      if (!open) {
        setSelectedPengiriman(null)
        setSelectedDetailInfo(null)
      }
    }}
        mode="detail"
        title={
          selectedPengiriman
            ? `Detail Pengiriman #${selectedPengiriman.id_pengiriman}`
            : 'Detail Pengiriman'
        }
        description={
          selectedPengiriman
            ? `${selectedPengiriman.nama_toko} • ${selectedPengiriman.kecamatan}, ${selectedPengiriman.kabupaten}`
            : undefined
        }
      >
        {selectedPengiriman && (() => {
          const detail = detailPengirimanQuery.isSuccess
            ? detailPengirimanData
            : undefined
          const summary = detail || selectedPengiriman
          const fallbackItems =
            selectedDetailInfo?.items?.map((item, index) => ({
              id_detail_kirim: `fallback-${index}`,
              jumlah_kirim: item.jumlah_kirim,
              produk: {
                nama_produk: item.nama_produk,
                harga_satuan: undefined,
              },
              _fallback: true,
            })) || []
          const detailItems = detail?.detail_pengiriman || fallbackItems
          const totalQty = detailItems.length
            ? detailItems.reduce(
                (sum: number, item: any) => sum + (item.jumlah_kirim || 0),
                0,
              )
            : summary?.total_quantity_kirim ||
              summary?.total_quantity ||
              0
          const totalValue = detailItems.length
            ? detailItems.reduce(
                (sum: number, item: any) =>
                  sum +
                  (item.jumlah_kirim || 0) *
                    (item.produk?.harga_satuan || 0),
                0,
              )
            : summary?.total_nilai_kirim || 0

          return (
            <div className="space-y-4 text-sm">
              {detailPengirimanQuery.error && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  Detail lengkap belum tersedia. Menampilkan data ringkas.
                </div>
              )}
              <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Shipment
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          #{summary?.id_pengiriman}
                        </p>
                        {summary?.tanggal_kirim && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(summary.tanggal_kirim)}
                          </p>
                        )}
                      </div>
                      <div className="border border-gray-200 bg-white p-3 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Sales Pengirim
                        </p>
        <p className="text-sm font-semibold text-gray-900">
          {summary?.toko?.sales?.nama_sales ||
            summary?.nama_sales ||
            selectedDetailInfo?.sales ||
            '-'}
                        </p>
                        {summary?.toko?.sales?.nomor_telepon && (
                          <p className="text-xs text-gray-500">
                            {summary.toko.sales.nomor_telepon}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-100 bg-gradient-to-tr from-white to-blue-50 p-4">
                      <div>
                        <p className="text-xs text-gray-500">Toko</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {summary?.nama_toko || summary?.toko?.nama_toko}
                        </p>
                        <p className="text-xs text-gray-500">
                          {summary?.kecamatan || summary?.toko?.kecamatan}, {summary?.kabupaten || summary?.toko?.kabupaten}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Nilai</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(
                            totalValue ||
                              summary?.total_nilai_kirim ||
                              0
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(
                            totalQty ||
                              summary?.total_quantity_kirim ||
                              summary?.total_quantity ||
                              0
                          )}{" "}
                          pcs
                        </p>
                      </div>
                    </div>

                    <div className="border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Detail Produk
                          </p>
                          <p className="text-sm text-gray-600">
                            {formatNumber(totalQty)} pcs dikirim
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {detailItems.length} item
                        </Badge>
                      </div>
                      {detailPengirimanQuery.isLoading && !detail?.detail_pengiriman ? (
                        <div className="flex items-center justify-center py-6 text-gray-500">
                          Memuat detail pengiriman...
                        </div>
                      ) : detailItems.length > 0 ? (
                        <div className="max-h-64 overflow-auto border border-gray-100">
                          <table className="min-w-full divide-y divide-gray-100 text-xs">
                            <thead className="bg-gray-50 text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">
                                  Produk
                                </th>
                                <th className="px-3 py-2 text-center font-medium">
                                  Harga
                                </th>
                                <th className="px-3 py-2 text-center font-medium">
                                  Jumlah
                                </th>
                                <th className="px-3 py-2 text-right font-medium">
                                  Nilai
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {detailItems.map((detail: any, idx: number) => (
                                <tr key={detail.id_detail_kirim ?? idx}>
                                  <td className="px-3 py-2">
                                    <p className="font-semibold text-gray-900">
                                      {detail.produk?.nama_produk || 'Produk'}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2 text-center text-gray-700">
                                    {detail.produk?.harga_satuan
                                      ? formatCurrency(detail.produk.harga_satuan)
                                      : "-"}
                                  </td>
                                  <td className="px-3 py-2 text-center font-semibold text-blue-600">
                                    {formatNumber(detail.jumlah_kirim || 0)} pcs
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                    {detail.produk?.harga_satuan
                                      ? formatCurrency(
                                          (detail.jumlah_kirim || 0) *
                                            (detail.produk?.harga_satuan || 0),
                                        )
                                      : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Detail produk belum tersedia untuk data ini.
                        </p>
                      )}
                    </div>
              </div>
            </div>
          )
        })()}
      </ModalBox>

      {/* Edit Modal */}
      <ModalBox
        open={editModalOpen && !!selectedPengiriman}
        onOpenChange={(open) => {
          setEditModalOpen(open)
          if (!open) {
            setSelectedPengiriman(null)
            setEditSubmitting(false)
            setSelectedDetailInfo(null)
          }
        }}
        mode="edit"
        title={
          selectedPengiriman
            ? `Edit Pengiriman #${selectedPengiriman.id_pengiriman}`
            : 'Edit Pengiriman'
        }
        description={
          selectedPengiriman
            ? `${selectedPengiriman.nama_toko} • ${selectedPengiriman.kecamatan}, ${selectedPengiriman.kabupaten}`
            : undefined
        }
        footer={
          selectedPengiriman ? (
            <div className="flex w-full items-center justify-end gap-3">
              <Button
                form={modalEditFormId}
                type="submit"
                disabled={editSubmitting}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                {editSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Perubahan
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  setEditModalOpen(false)
                  setSelectedPengiriman(null)
                  setEditSubmitting(false)
                }}
              >
                <X className="h-4 w-4" />
                Tutup
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedPengiriman && (
          <PengirimanEditForm
            id={selectedPengiriman.id_pengiriman}
            variant="modal"
            formId={modalEditFormId}
            onSubmittingChange={setEditSubmitting}
            onSuccess={() => {
              setEditModalOpen(false)
              setSelectedPengiriman(null)
              setEditSubmitting(false)
              refetch()
            }}
            onCancel={() => {
              setEditModalOpen(false)
              setSelectedPengiriman(null)
              setEditSubmitting(false)
            }}
          />
        )}
      </ModalBox>
    </TooltipProvider>
  )
}
