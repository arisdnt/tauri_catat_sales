"use client"

import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react"
import { useSearchParams } from "next/navigation"
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Eye,
  Edit,
  Trash2,
  MapPin,
  Package,
  Search,
  ExternalLink,
  Loader2,
  Save,
  X,
} from "lucide-react"
import { INDONESIA_TIMEZONE } from "@/lib/utils"

import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useNavigation } from "@/lib/hooks/use-navigation"

import { useFilterOptions } from "@/lib/db/hooks"
import { useDashboardPenagihanQuery } from "@/lib/queries"
import { usePenagihanDetailQuery } from "@/lib/queries/penagihan"
import { useDeletePenagihanMutation } from "@/lib/queries/penagihan"
import { exportBillingData } from "@/lib/excel-export"
import { ModalBox } from "@/components/ui/modal-box"
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal"
import { PenagihanEditForm } from "./[id]/edit/penagihan-edit-form"

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

type PenagihanRow = any

export default function PenagihanPage() {
  const { navigate } = useNavigation()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const deletePenagihanMutation = useDeletePenagihanMutation()
  const parentRef = useRef<HTMLDivElement>(null)

  // Detail & edit modals
  const [selectedPenagihan, setSelectedPenagihan] = useState<PenagihanRow | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const detailPenagihanQuery = usePenagihanDetailQuery(selectedPenagihan?.id_penagihan ?? 0)
  const detailPenagihanData = (detailPenagihanQuery.data as { data: any })?.data
  const modalEditFormId = selectedPenagihan
    ? `penagihan-edit-form-${selectedPenagihan.id_penagihan}`
    : undefined

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PenagihanRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [hasHandledQueryParams, setHasHandledQueryParams] = useState(false)

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

  const handleOpenDetailModal = useCallback((penagihan: PenagihanRow) => {
    setSelectedPenagihan(penagihan)
    setDetailModalOpen(true)
  }, [])

  const handleOpenEditModal = useCallback((penagihan: PenagihanRow) => {
    setSelectedPenagihan(penagihan)
    setEditModalOpen(true)
  }, [])

  const handleOpenDeleteModal = useCallback((penagihan: PenagihanRow) => {
    setDeleteTarget(penagihan)
    setDeleteModalOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return

    setDeleteLoading(true)
    deletePenagihanMutation.mutate(deleteTarget.id_penagihan, {
      onSuccess: () => {
        toast({
          title: "Berhasil",
          description: `Penagihan #${deleteTarget.id_penagihan} dihapus`,
        })
        setDeleteModalOpen(false)
        setDeleteTarget(null)
        refetch()
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      },
      onSettled: () => {
        setDeleteLoading(false)
      },
    })
  }, [deleteTarget, deletePenagihanMutation, toast, refetch])

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

  // Auto buka modal detail/edit jika datang dengan query param (tautan eksternal)
  useEffect(() => {
    if (hasHandledQueryParams) return

    const idParam = searchParams.get("penagihanId")
    if (!idParam) {
      setHasHandledQueryParams(true)
      return
    }

    const id = parseInt(idParam, 10)
    if (Number.isNaN(id) || !data || data.length === 0) {
      if (data && data.length > 0) {
        // Data sudah ada tapi ID tidak valid / tidak ditemukan
        setHasHandledQueryParams(true)
      }
      return
    }

    const found = data.find((item: any) => item.id_penagihan === id)
    if (!found) {
      setHasHandledQueryParams(true)
      return
    }

    const action = searchParams.get("action")

    setSelectedPenagihan(found)
    if (action === "edit") {
      setEditModalOpen(true)
    } else {
      setDetailModalOpen(true)
    }

    setHasHandledQueryParams(true)
  }, [searchParams, data, hasHandledQueryParams])

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
                            <button
                              onClick={() => handleOpenDetailModal(item)}
                              className="p-1 hover:bg-blue-100 text-blue-600"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Lihat Detail</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1 hover:bg-green-100 text-green-600"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleOpenDeleteModal(item)}
                              className="p-1 hover:bg-red-100 text-red-600"
                            >
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

        {/* Detail Modal */}
        <ModalBox
          open={detailModalOpen && !!selectedPenagihan}
          onOpenChange={(open) => {
            setDetailModalOpen(open)
            if (!open) {
              setSelectedPenagihan(null)
            }
          }}
          mode="detail"
          title={
            selectedPenagihan
              ? `Detail Penagihan #${selectedPenagihan.id_penagihan}`
              : "Detail Penagihan"
          }
          description={
            selectedPenagihan
              ? `${selectedPenagihan.nama_toko} • ${selectedPenagihan.kecamatan}, ${selectedPenagihan.kabupaten}`
              : undefined
          }
        >
          {selectedPenagihan && (
            <div className="space-y-4 text-sm">
              {detailPenagihanQuery.isLoading ? (
                <div className="flex items-center justify-center py-6 text-gray-500">
                  Memuat detail penagihan...
                </div>
              ) : (
                <>
                  {detailPenagihanQuery.error && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                      Detail lengkap belum tersedia. Menampilkan data ringkas.
                    </div>
                  )}
                  {(() => {
                    const detail = detailPenagihanData
                    const summary = detail || selectedPenagihan
                    const tanggalDisplay =
                      summary?.tanggal_penagihan ||
                      summary?.dibuat_pada ||
                      selectedPenagihan.dibuat_pada
                    const detailItems = detail?.detail_penagihan || []
                    const totalTerjual = detailItems.reduce(
                      (sum: number, item: any) =>
                        sum + (item.jumlah_terjual || 0),
                      0,
                    )
                    const totalJenis = detailItems.length
                    const totalKembali = detailItems.reduce(
                      (sum: number, item: any) =>
                        sum + (item.jumlah_kembali || 0),
                      0,
                    )

                    return (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="border border-gray-200 bg-gray-50/80 p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Invoice
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              #{summary?.id_penagihan}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {tanggalDisplay
                                ? formatDate(tanggalDisplay)
                                : "-"}
                            </p>
                          </div>
                          <div className="border border-gray-200 bg-white p-3 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Metode Pembayaran
                            </p>
                            <span
                              className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                summary?.metode_pembayaran === "Cash"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {summary?.metode_pembayaran}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-100 bg-gradient-to-tr from-white to-blue-50 p-4">
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">Toko</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {summary?.nama_toko ||
                                summary?.toko?.nama_toko ||
                                "-"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {summary?.kecamatan ||
                                summary?.toko?.kecamatan ||
                                "-"}
                              ,{" "}
                              {summary?.kabupaten ||
                                summary?.toko?.kabupaten ||
                                "-"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">
                              Sales Penagih
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {summary?.nama_sales ||
                                summary?.toko?.sales?.nama_sales ||
                                "-"}
                            </p>
                            {summary?.toko?.sales?.nomor_telepon && (
                              <p className="text-xs text-gray-500">
                                {summary.toko.sales.nomor_telepon}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            {
                              label: "Total Pembayaran",
                              value: formatCurrency(
                                summary?.total_uang_diterima ||
                                  detail?.total_uang_diterima ||
                                  0,
                              ),
                              accent: "text-emerald-600",
                            },
                            {
                              label: "PCS Terjual",
                              value: formatNumber(
                                totalTerjual ||
                                  summary?.total_quantity_terjual ||
                                  0,
                              ),
                              accent: "text-slate-900",
                            },
                            {
                              label: "Jenis Produk",
                              value: formatNumber(
                                totalJenis ||
                                  summary?.total_jenis_produk ||
                                  0,
                              ),
                              accent: "text-slate-900",
                            },
                          ].map((stat) => (
                            <div
                              key={stat.label}
                              className="border border-gray-100 bg-white p-3 shadow-sm"
                            >
                              <p className="text-xs uppercase text-gray-500">
                                {stat.label}
                              </p>
                              <p className={`text-lg font-semibold ${stat.accent}`}>
                                {stat.value}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="border border-gray-100 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-gray-500">
                                Ringkasan Produk
                              </p>
                              <p className="text-sm text-gray-600">
                                {formatNumber(totalTerjual)} pcs terjual •{" "}
                                {formatNumber(totalKembali)} pcs kembali
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {detailItems.length} item
                            </Badge>
                          </div>
                          {detailItems.length > 0 ? (
                            <div className="max-h-60 overflow-auto border border-gray-100">
                              <table className="min-w-full divide-y divide-gray-100 text-xs">
                                <thead className="bg-gray-50 text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">
                                      Produk
                                    </th>
                                    <th className="px-3 py-2 text-center font-medium">
                                      Terjual
                                    </th>
                                    <th className="px-3 py-2 text-center font-medium">
                                      Kembali
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {detailItems.map((item: any) => (
                                    <tr key={item.id_detail_tagih}>
                                      <td className="px-3 py-2">
                                        <p className="font-semibold text-gray-900">
                                          {item.produk?.nama_produk || "Produk"}
                                        </p>
                                        <p className="text-gray-500">
                                          ID: {item.produk?.id_produk || "-"}
                                        </p>
                                      </td>
                                      <td className="px-3 py-2 text-center font-semibold text-emerald-600">
                                        {formatNumber(item.jumlah_terjual || 0)}
                                      </td>
                                      <td className="px-3 py-2 text-center font-semibold text-amber-600">
                                        {formatNumber(item.jumlah_kembali || 0)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              Detail produk lengkap belum tersedia untuk data
                              ini.
                            </p>
                          )}
                        </div>

                        {detail?.potongan_penagihan?.length ? (
                          <div className="border border-amber-100 bg-amber-50/80 p-4">
                            <p className="text-xs uppercase text-amber-700 mb-3">
                              Potongan Penagihan
                            </p>
                            <div className="space-y-2">
                              {detail.potongan_penagihan.map((pot: any) => (
                                <div
                                  key={pot.id_potongan}
                                  className="border border-amber-100 bg-white/70 p-3 text-xs"
                                >
                                  <p className="text-sm font-semibold text-amber-700">
                                    {formatCurrency(pot.jumlah_potongan)}
                                  </p>
                                  {pot.alasan && (
                                    <p className="text-amber-600 mt-1">
                                      {pot.alasan}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )}
        </ModalBox>

        {/* Edit Modal - form edit langsung di modal */}
        <ModalBox
          open={editModalOpen && !!selectedPenagihan}
          onOpenChange={(open) => {
            setEditModalOpen(open)
            if (!open) {
              setSelectedPenagihan(null)
              setEditSubmitting(false)
            }
          }}
          mode="edit"
          title={
            selectedPenagihan
              ? `Edit Penagihan #${selectedPenagihan.id_penagihan}`
              : "Edit Penagihan"
          }
          description={
            selectedPenagihan
              ? `${selectedPenagihan.nama_toko} • ${selectedPenagihan.kecamatan}, ${selectedPenagihan.kabupaten}`
              : undefined
          }
          footer={
            selectedPenagihan ? (
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
                    setSelectedPenagihan(null)
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
          {selectedPenagihan && (
            <PenagihanEditForm
              id={selectedPenagihan.id_penagihan}
              variant="modal"
              formId={modalEditFormId}
              onSubmittingChange={setEditSubmitting}
              initialMetodePembayaran={selectedPenagihan.metode_pembayaran}
              onSuccess={() => {
                setEditModalOpen(false)
                setSelectedPenagihan(null)
                setEditSubmitting(false)
                refetch()
              }}
              onCancel={() => {
                setEditModalOpen(false)
                setSelectedPenagihan(null)
                setEditSubmitting(false)
              }}
            />
          )}
        </ModalBox>

        {/* Delete Confirm Modal */}
        <DeleteConfirmModal
          open={deleteModalOpen && !!deleteTarget}
          onOpenChange={(open) => {
            setDeleteModalOpen(open)
            if (!open) {
              setDeleteTarget(null)
            }
          }}
          onConfirm={handleConfirmDelete}
          itemName={
            deleteTarget
              ? `Penagihan #${deleteTarget.id_penagihan} - ${deleteTarget.nama_toko}`
              : undefined
          }
          loading={deleteLoading}
          extraContent={
            deleteTarget ? (
              <span className="text-xs text-amber-700">
                Data penagihan ini akan dihapus dari daftar. Tindakan tidak
                dapat dibatalkan.
              </span>
            ) : null
          }
        />
      </div>
    </TooltipProvider>
  )
}
