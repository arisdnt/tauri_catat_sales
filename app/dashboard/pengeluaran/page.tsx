'use client'

import React, { useMemo, useCallback, useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Eye,
  Edit,
  Trash2,
  Receipt,
  Search,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  Loader2,
  X
} from 'lucide-react'
import { INDONESIA_TIMEZONE, formatCurrency } from '@/lib/utils'

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

import { useDashboardPengeluaranQuery } from '@/lib/queries'
import {
  useDeletePengeluaran,
  usePengeluaranDetailQuery,
} from '@/lib/queries/pengeluaran'
import { PengeluaranForm } from './components/pengeluaran-form'
import { ModalBox } from '@/components/ui/modal-box'
import { PengeluaranEditForm } from './components/pengeluaran-edit-form'

// Helper function to format numbers
function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// Helper function to format date
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
interface PengeluaranFilters {
  search: string
  date_range: 'today' | 'week' | 'month' | 'current_month' | 'last_month' | 'all'
}

// Column widths as percentages (total = 100%)
// Evenly distributed: 100% / 6 columns = ~16.67% each
const COLUMN_WIDTHS = {
  noPengeluaran: '16.67%',
  tanggal: '16.67%',
  keterangan: '16.67%',
  jumlah: '16.67%',
  bukti: '16.67%',
  aksi: '16.65%'  // Slightly smaller to account for rounding (total = 100%)
}

const ROW_HEIGHT = 56
const HEADER_HEIGHT = 36

export default function PengeluaranPage() {
  const { toast } = useToast()
  const deleteMutation = useDeletePengeluaran()
  const parentRef = useRef<HTMLDivElement>(null)

  // Filter state
  const [filters, setFilters] = useState<PengeluaranFilters>({
    search: '',
    date_range: 'current_month'
  })

  // Preview state for bukti foto
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedPengeluaran, setSelectedPengeluaran] = useState<any | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const modalFormId = 'pengeluaran-edit-modal-form'

  // Use dashboard query with fixed page+limit (virtualized list)
  const { data: dashboardResult, isLoading, error, refetch } = useDashboardPengeluaranQuery({
    page: 1,
    limit: 500,
    search: filters.search || undefined,
    date_range: filters.date_range
  })

  const data = dashboardResult?.data?.data || []
  const selectedId = selectedPengeluaran?.id_pengeluaran
  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
  } = usePengeluaranDetailQuery(selectedId, {
    enabled: Boolean(selectedId && (detailModalOpen || editModalOpen)),
  })
  const detailPengeluaran = detailData || selectedPengeluaran

  const metadata = useMemo(() => {
    const total = dashboardResult?.data?.pagination?.total ?? data.length
    const totalAmount = data.reduce((sum: number, p: any) => sum + (p.jumlah || 0), 0)
    return { total, totalAmount }
  }, [dashboardResult, data])

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  // Handlers
  const handleFiltersChange = useCallback((newFilters: Partial<PengeluaranFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      date_range: 'current_month'
    })
  }, [])

  const handleDelete = useCallback((pengeluaran: any) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus pengeluaran #${pengeluaran.id_pengeluaran}?`)) {
      deleteMutation.mutate(pengeluaran.id_pengeluaran, {
        onSuccess: () => {
          toast({
            title: "Berhasil",
            description: `Pengeluaran #${pengeluaran.id_pengeluaran} berhasil dihapus`,
          })
          setDetailModalOpen(false)
          setEditModalOpen(false)
          setSelectedPengeluaran(null)
          refetch()
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message || "Gagal menghapus pengeluaran",
            variant: "destructive",
          })
        }
      })
    }
  }, [deleteMutation, toast, refetch])

  const handleView = useCallback((pengeluaran: any) => {
    setSelectedPengeluaran(pengeluaran)
    setDetailModalOpen(true)
  }, [])

  const handleEdit = useCallback((pengeluaran: any) => {
    setSelectedPengeluaran(pengeluaran)
    setEditModalOpen(true)
  }, [])

  const handleAdd = useCallback(() => {
    setCreateModalOpen(true)
  }, [])

  const handleExport = useCallback(() => {
    if (!data) return

    const csvContent = [
      ['Tanggal Pengeluaran', 'Keterangan', 'Jumlah', 'Bukti Foto'],
      ...data.map((item: any) => [
        item.tanggal_pengeluaran ? formatDate(item.tanggal_pengeluaran) : '',
        item.keterangan || '-',
        item.jumlah || 0,
        item.url_bukti_foto ? 'Ada' : 'Tidak ada'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pengeluaran-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export Berhasil",
      description: "Data pengeluaran berhasil diexport",
    })
  }, [data, toast])

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.search ||
      (filters.date_range && filters.date_range !== 'all')
    )
  }, [filters])

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden bg-white">
        {/* Filter Bar - Fixed */}
        <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-[320px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Cari keterangan, jumlah..."
                value={filters.search}
                onChange={(e) => handleFiltersChange({ search: e.target.value })}
                className="pl-7 h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none"
              />
            </div>

            {/* Periode */}
            <Select value={filters.date_range} onValueChange={(v) => handleFiltersChange({ date_range: v as any })}>
              <SelectTrigger className="w-[150px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
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
              {formatNumber(metadata?.total || 0)} pengeluaran • {formatCurrency(metadata?.totalAmount || 0)}
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
              <Plus className="w-3.5 h-3.5 mr-1" />
              Pengeluaran
            </Button>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table Header - Fixed */}
          <div className="flex-shrink-0 border-b bg-gray-100" style={{ height: HEADER_HEIGHT }}>
            <div className="flex h-full text-sm font-semibold text-gray-700 w-full">
              <div style={{ width: COLUMN_WIDTHS.noPengeluaran }} className="px-2 flex items-center border-r">No. Pengeluaran</div>
              <div style={{ width: COLUMN_WIDTHS.tanggal }} className="px-2 flex items-center border-r">Tanggal</div>
              <div style={{ width: COLUMN_WIDTHS.keterangan }} className="px-2 flex items-center border-r">Keterangan</div>
              <div style={{ width: COLUMN_WIDTHS.jumlah }} className="px-2 flex items-center border-r">Jumlah</div>
              <div style={{ width: COLUMN_WIDTHS.bukti }} className="px-2 flex items-center border-r">Bukti</div>
              <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center">Aksi</div>
            </div>
          </div>

          {/* Virtual Scroll Container */}
          <div ref={parentRef} className="flex-1 overflow-auto scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
                <p>Terjadi kesalahan saat memuat data pengeluaran.</p>
                <Button onClick={() => refetch()} size="sm">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Coba Lagi
                </Button>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
                <Receipt className="w-8 h-8 text-gray-300" />
                <p>Tidak ada data pengeluaran</p>
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = data[virtualRow.index]
                  const tanggalDisplay = item.tanggal_pengeluaran
                  const dateInfo = tanggalDisplay ? formatDateWithDay(tanggalDisplay) : { date: '-', day: '' }

                  return (
                    <div
                      key={item.id_pengeluaran}
                      className="absolute w-full flex border-b hover:bg-blue-50/50 transition-colors"
                      style={{
                        height: ROW_HEIGHT,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      {/* No. Pengeluaran */}
                      <div style={{ width: COLUMN_WIDTHS.noPengeluaran }} className="px-2 flex flex-col justify-center">
                        <span className="text-sm font-mono font-medium text-gray-900">#{item.id_pengeluaran}</span>
                      </div>

                      {/* Tanggal */}
                      <div style={{ width: COLUMN_WIDTHS.tanggal }} className="px-2 flex flex-col justify-center">
                        <span className="text-sm font-medium text-gray-900">{dateInfo.date}</span>
                        {dateInfo.day && (
                          <span className="text-xs text-gray-500">({dateInfo.day})</span>
                        )}
                      </div>

                      {/* Keterangan */}
                      <div style={{ width: COLUMN_WIDTHS.keterangan }} className="px-2 flex items-center overflow-hidden">
                        <span className="text-sm text-gray-900 line-clamp-2">
                          {item.keterangan}
                        </span>
                      </div>

                      {/* Jumlah */}
                      <div style={{ width: COLUMN_WIDTHS.jumlah }} className="px-2 flex flex-col justify-center">
                        <span className="text-sm font-semibold text-red-600">
                          {formatCurrency(item.jumlah || 0)}
                        </span>
                      </div>

                      {/* Bukti */}
                      <div style={{ width: COLUMN_WIDTHS.bukti }} className="px-2 flex items-center">
                        {item.url_bukti_foto ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 cursor-pointer"
                            onMouseEnter={() => setPreviewUrl(item.url_bukti_foto)}
                            onMouseLeave={() => setPreviewUrl((current) => current === item.url_bukti_foto ? null : current)}
                          >
                            <ImageIcon className="w-3 h-3 mr-1" />
                            Ada
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                            Tidak
                          </Badge>
                        )}
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

        {/* Global preview overlay for bukti foto */}
        {previewUrl && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <div className="bg-white border rounded-lg shadow-2xl p-4 max-w-lg pointer-events-auto">
              <img
                src={previewUrl}
                alt="Preview bukti"
                className="w-full h-80 object-cover rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <p className="text-sm text-gray-600 mt-3 text-center font-medium">Preview Bukti Foto</p>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        <ModalBox
          open={detailModalOpen && !!selectedPengeluaran}
          onOpenChange={(open) => {
            setDetailModalOpen(open)
            if (!open) {
              setSelectedPengeluaran(null)
            }
          }}
          mode="detail"
          title={
            selectedPengeluaran
              ? `Detail Pengeluaran #${selectedPengeluaran.id_pengeluaran}`
              : 'Detail Pengeluaran'
          }
          description={
            detailPengeluaran?.tanggal_pengeluaran
              ? formatDate(detailPengeluaran.tanggal_pengeluaran)
              : undefined
          }
          className="max-w-3xl"
        >
          {detailLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Memuat detail pengeluaran...
            </div>
          ) : detailError ? (
            <p className="text-sm text-red-600">
              Gagal memuat detail pengeluaran.
            </p>
          ) : detailPengeluaran ? (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Pengeluaran
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    #{detailPengeluaran.id_pengeluaran}
                  </p>
                  {detailPengeluaran.tanggal_pengeluaran && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(detailPengeluaran.tanggal_pengeluaran)}
                    </p>
                  )}
                </div>
                <div className="rounded border border-gray-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Jumlah
                  </p>
                  <p className="text-lg font-semibold text-red-600">
                    {formatCurrency(detailPengeluaran.jumlah || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Dibuat:{' '}
                    {detailPengeluaran.dibuat_pada
                      ? new Date(
                          detailPengeluaran.dibuat_pada,
                        ).toLocaleString('id-ID')
                      : '-'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Diperbarui:{' '}
                    {detailPengeluaran.diperbarui_pada
                      ? new Date(
                          detailPengeluaran.diperbarui_pada,
                        ).toLocaleString('id-ID')
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="rounded border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Keterangan
                </p>
                <p className="mt-2 text-sm text-gray-900">
                  {detailPengeluaran.keterangan || '-'}
                </p>
              </div>

              {detailPengeluaran.url_bukti_foto ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Bukti Foto
                  </p>
                  <div className="rounded border border-gray-200 bg-white p-3">
                    <img
                      src={detailPengeluaran.url_bukti_foto}
                      alt="Bukti pengeluaran"
                      className="w-full max-h-72 rounded object-contain"
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            detailPengeluaran.url_bukti_foto as string,
                            '_blank',
                          )
                        }
                      >
                        Lihat Bukti
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                  Tidak ada bukti foto yang tersimpan.
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Data pengeluaran tidak tersedia.
            </p>
          )}
        </ModalBox>

        {/* Edit Modal */}
        <ModalBox
          open={editModalOpen && !!selectedPengeluaran}
          onOpenChange={(open) => {
            setEditModalOpen(open)
            if (!open) {
              setSelectedPengeluaran(null)
              setEditSubmitting(false)
            }
          }}
          mode="edit"
          title={
            selectedPengeluaran
              ? `Edit Pengeluaran #${selectedPengeluaran.id_pengeluaran}`
              : 'Edit Pengeluaran'
          }
          description={
            detailPengeluaran?.tanggal_pengeluaran
              ? formatDate(detailPengeluaran.tanggal_pengeluaran)
              : undefined
          }
          footer={
            selectedPengeluaran ? (
              <div className="flex w-full items-center justify-end gap-3">
                <Button
                  form={modalFormId}
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
                      Simpan Perubahan
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
                  onClick={() => {
                    setEditModalOpen(false)
                    setSelectedPengeluaran(null)
                    setEditSubmitting(false)
                  }}
                >
                  <X className="h-4 w-4" />
                  Tutup
                </Button>
              </div>
            ) : undefined
          }
          className="max-w-3xl"
        >
          {selectedPengeluaran && (
            <PengeluaranEditForm
              id={selectedPengeluaran.id_pengeluaran}
              formId={modalFormId}
              initialData={detailPengeluaran || selectedPengeluaran}
              onSubmittingChange={setEditSubmitting}
              onSuccess={() => {
                setEditModalOpen(false)
                setSelectedPengeluaran(null)
                setEditSubmitting(false)
                refetch()
              }}
            />
          )}
        </ModalBox>

        {/* Create Modal */}
        <PengeluaranForm
          open={createModalOpen}
          onOpenChange={(open) => {
            setCreateModalOpen(open)
            if (!open) {
              refetch() // Refresh data setelah create
            }
          }}
        />
      </div>
    </TooltipProvider>
  )
}
