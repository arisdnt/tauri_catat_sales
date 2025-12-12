'use client'

import React, { useMemo, useCallback, useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Eye,
  Edit,
  Trash2,
  Star,
  Package,
  DollarSign,
  TrendingUp,
  Activity,
  Search,
  Filter,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { useMasterProdukQuery, useMasterProdukStatsQuery, type MasterProduk } from '@/lib/queries/dashboard'
import { formatCurrency } from '@/lib/form-utils'
import { ModalBox } from '@/components/ui/modal-box'
import { useProdukDetailQuery } from '@/lib/queries/produk'
import { ProdukDetailPanel } from './components/produk-detail-panel'
import { ProdukEditForm } from './components/produk-edit-form'
import { ProdukCreateForm } from './components/produk-create-form'

// Helper function to format numbers
function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// Filter types
interface ProdukFilters {
  search: string
  status_produk: string
  is_priority: string
  date_range: string
}

// Column definitions for produk (used by virtualized renderer)
function useProdukColumns() {
  // Define responsive columns with balanced sizing and left alignment
  const columns = useMemo<ColumnDef<MasterProduk>[]>(() => [
    {
      accessorKey: 'nama_produk',
      header: 'Nama Produk',
      cell: ({ row }) => {
        const produk = row.original
        return (
          <div className="text-left">
            <div className="flex items-center gap-2">
              {produk.is_priority && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              )}
              <div className="font-medium text-gray-900 truncate">
                {produk.nama_produk || 'Unknown Product'}
              </div>
            </div>
            <div className="text-xs text-gray-500">
              ID: {produk.id_produk || 'N/A'}
            </div>
          </div>
        )
      },
      size: 200,
      minSize: 180,
      maxSize: 250,
      meta: { priority: 'high', columnType: 'name' },
    },
    {
      accessorKey: 'harga_satuan',
      header: 'Harga Satuan',
      cell: ({ row }) => {
        const produk = row.original
        return (
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900">
              {formatCurrency(produk.harga_satuan || 0)}
            </div>
          </div>
        )
      },
      size: 140,
      minSize: 120,
      maxSize: 160,
      meta: { priority: 'high', columnType: 'currency' },
    },
    {
      accessorKey: 'status_produk',
      header: 'Status',
      cell: ({ row }) => {
        const produk = row.original
        return (
          <div className="text-left">
            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
              produk.status_produk 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {produk.status_produk ? 'Aktif' : 'Tidak Aktif'}
            </span>
          </div>
        )
      },
      size: 120,
      minSize: 100,
      maxSize: 140,
      meta: { priority: 'medium', columnType: 'status' },
    },
    {
      accessorKey: 'total_dikirim',
      header: 'Total Dikirim',
      cell: ({ row }) => {
        const produk = row.original
        return (
          <div className="text-left flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium text-blue-600">
                {formatNumber(produk.total_dikirim || 0)}
              </div>
              <div className="text-xs text-gray-500">
                Nilai: {formatCurrency(produk.nilai_total_dikirim || (produk.total_dikirim || 0) * (produk.harga_satuan || 0))}
              </div>
            </div>
          </div>
        )
      },
      size: 140,
      minSize: 120,
      maxSize: 160,
      meta: { priority: 'medium', columnType: 'stats' },
    },
    {
      accessorKey: 'total_terjual',
      header: 'Total Terjual',
      cell: ({ row }) => {
        const produk = row.original
        return (
          <div className="text-left flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-sm font-medium text-green-600">
                {formatNumber(produk.total_terjual || 0)}
              </div>
              <div className="text-xs text-gray-500">
                Nilai: {formatCurrency(produk.nilai_total_terjual || (produk.total_terjual || 0) * (produk.harga_satuan || 0))}
              </div>
            </div>
          </div>
        )
      },
      size: 140,
      minSize: 120,
      maxSize: 160,
      meta: { priority: 'medium', columnType: 'stats' },
    },
    {
      accessorKey: 'stok_di_toko',
      header: 'Sisa Stok',
      cell: ({ row }) => {
        const produk = row.original
        return (
          <div className="text-left flex items-center gap-2">
            <Activity className={`h-4 w-4 ${
              (produk.stok_di_toko || 0) < 0 ? 'text-red-500' : 
              (produk.stok_di_toko || 0) === 0 ? 'text-yellow-500' :
              'text-green-500'
            }`} />
            <div>
              <div className={`text-sm font-medium ${
                (produk.stok_di_toko || 0) < 0 ? 'text-red-600' : 
                (produk.stok_di_toko || 0) === 0 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {formatNumber(produk.stok_di_toko || 0)}
              </div>
              <div className="text-xs text-gray-500">
                Return: {formatNumber(produk.total_dikembalikan || 0)}
              </div>
            </div>
          </div>
        )
      },
      size: 120,
      minSize: 100,
      maxSize: 140,
      meta: { priority: 'medium', columnType: 'stats' },
    },
    {
      accessorKey: 'total_dibayar',
      header: 'Total Dibayar',
      cell: ({ row }) => {
        const produk = row.original
        return (
          <div className="text-left flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-500" />
            <div>
              <div className="text-sm font-medium text-purple-600">
                {formatCurrency(produk.total_dibayar || 0)}
              </div>
              <div className="text-xs text-gray-500">
                Cash: {formatCurrency(produk.total_dibayar_cash || produk.total_dibayar || 0)}
              </div>
            </div>
          </div>
        )
      },
      size: 150,
      minSize: 130,
      maxSize: 170,
      meta: { priority: 'medium', columnType: 'stats' },
    },
  ], [])

  return columns
}

export default function ProdukPage() {
  const parentRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Filter and pagination state
  const [filters, setFilters] = useState<ProdukFilters>({
    search: '',
    status_produk: 'all',
    is_priority: 'all',
    date_range: 'current_month'
  })
  
  const [page, setPage] = useState(1)
  const limit = 30

  // Use dashboard query with server-side filtering and pagination
  const { data: masterData, isLoading, error, refetch } = useMasterProdukQuery({
    page,
    limit,
    ...filters
  })
  
  // Use separate query for statistics that respects all filters including date_range
  const { data: statsData, isLoading: isStatsLoading } = useMasterProdukStatsQuery({
    search: filters.search,
    status_produk: filters.status_produk,
    is_priority: filters.is_priority,
    date_range: filters.date_range
  })
  
  // Transform data for compatibility with existing table component
  const data = {
    data: masterData?.data?.data || [],
    pagination: masterData?.data?.pagination ? {
      hasNextPage: masterData.data.pagination.has_next,
      hasPrevPage: masterData.data.pagination.has_prev,
      totalPages: masterData.data.pagination.total_pages,
      currentPage: masterData.data.pagination.page,
      pageSize: masterData.data.pagination.limit,
      total: masterData.data.pagination.total,
      totalItems: masterData.data.pagination.total,
      totalRecords: masterData.data.pagination.total,
      limit: masterData.data.pagination.limit,
      page: masterData.data.pagination.page,
      from: ((masterData.data.pagination.page - 1) * masterData.data.pagination.limit) + 1,
      to: Math.min(masterData.data.pagination.page * masterData.data.pagination.limit, masterData.data.pagination.total)
    } : {
      hasNextPage: false,
      hasPrevPage: false,
      totalPages: 1,
      currentPage: 1,
      pageSize: 30,
      total: 0,
      totalItems: 0,
      totalRecords: 0,
      limit: 30,
      page: 1,
      from: 0,
      to: 0
    }
  }

  const [selectedProduk, setSelectedProduk] = useState<MasterProduk | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const modalFormId = selectedProduk
    ? `produk-edit-form-${selectedProduk.id_produk}`
    : undefined
  const createFormId = "produk-create-form-modal"

  const produkDetailQuery = useProdukDetailQuery(selectedProduk?.id_produk, {
    enabled: Boolean(selectedProduk && (detailModalOpen || editModalOpen)),
  })

  const detailRecord = produkDetailQuery.data?.data as Partial<MasterProduk> | undefined

  // Filter handlers
  const handleFiltersChange = useCallback((newFilters: Partial<ProdukFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPage(1) // Reset to first page when filters change
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status_produk: 'all',
      is_priority: 'all',
      date_range: 'current_month'
    })
    setPage(1) // Reset to first page when clearing filters
  }, [])

  // Handle delete
  const handleDelete = useCallback((produk: MasterProduk) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus produk "${produk.nama_produk}"?`)) {
      // Note: We would need to implement delete mutation for produk
      console.log('Delete produk:', produk.id_produk)
      toast({
        title: "Info",
        description: "Fitur hapus produk belum diimplementasi",
        variant: "destructive",
      })
    }
  }, [toast])

  // Handle view
  const handleView = useCallback((produk: MasterProduk) => {
    setSelectedProduk(produk)
    setDetailModalOpen(true)
  }, [])

  // Handle edit
  const handleEdit = useCallback((produk: MasterProduk) => {
    setSelectedProduk(produk)
    setEditModalOpen(true)
  }, [])

  // Handle export
  const handleExport = useCallback(() => {
    if (!data?.data) return
    
    // Note: We would need to implement export for produk
    console.log('Export produk data:', data.data)
    toast({
      title: "Info",
      description: "Fitur export produk belum diimplementasi",
    })
  }, [data?.data, toast])

  // Handle add new
  const handleAdd = useCallback(() => {
    setCreateModalOpen(true)
  }, [])

  // Summary statistics using filtered data from stats API
  const stats = statsData?.data || {
    total_produk: 0,
    produk_aktif: 0,
    produk_priority: 0,
    total_dikirim: 0,
    total_terjual: 0,
    total_dikembalikan: 0,
    sisa_stok_total: 0,
    nilai_total_dikirim: 0,
    nilai_total_terjual: 0,
    nilai_total_dikembalikan: 0,
    total_dibayar: 0
  }
  
  const summary = {
    total_produk: stats.total_produk,
    current_page_count: data.data.length,
    total_pages: data.pagination.totalPages,
    produk_aktif: stats.produk_aktif,
    produk_priority: stats.produk_priority,
    total_dikirim: stats.total_dikirim,
    total_terjual: stats.total_terjual,
    sisa_stok_total: stats.sisa_stok_total
  }

  // Show error state if data fetch fails
  if (error && !isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h2>
          <p className="text-red-700 mb-4">{error.message || 'Failed to load product data'}</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const columns = useProdukColumns()

  const COLUMN_WIDTHS = {
    nama: '20%',
    harga: '11%',
    status: '9%',
    dikirim: '14%',
    terjual: '14%',
    stok: '11%',
    dibayar: '13%',
    aksi: '4%'
  }

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.status_produk !== 'all' ||
    filters.is_priority !== 'all' ||
    filters.date_range !== 'all'
  )

  // Virtualizer for produk list
  const virtualizer = useVirtualizer({
    count: data.data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10
  })

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Filter bar + summary + actions ala penagihan */}
      <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-[300px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Cari produk..."
              value={filters.search}
              onChange={(e) => handleFiltersChange({ search: e.target.value })}
              className="pl-7 h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none"
            />
          </div>

          {/* Status */}
          <Select
            value={filters.status_produk}
            onValueChange={(value) => handleFiltersChange({ status_produk: value })}
          >
            <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="true">Aktif</SelectItem>
              <SelectItem value="false">Tidak Aktif</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select
            value={filters.is_priority}
            onValueChange={(value) => handleFiltersChange({ is_priority: value })}
          >
            <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="true">Priority</SelectItem>
              <SelectItem value="false">Non-Priority</SelectItem>
            </SelectContent>
          </Select>

          {/* Periode */}
          <Select
            value={filters.date_range}
            onValueChange={(value) => handleFiltersChange({ date_range: value })}
          >
            <SelectTrigger className="w-[150px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Waktu</SelectItem>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="week">7 Hari Terakhir</SelectItem>
              <SelectItem value="month">30 Hari Terakhir</SelectItem>
              <SelectItem value="current_month">Bulan Ini</SelectItem>
              <SelectItem value="last_month">Bulan Lalu</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Summary text */}
          <span className="text-xs text-gray-600 whitespace-nowrap">
            Menampilkan {summary.current_page_count} dari {formatNumber(summary.total_produk)} produk
            (Halaman {data.pagination.currentPage} dari {summary.total_pages})
          </span>

          {/* Clear filters */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 px-2 text-xs"
            disabled={!hasActiveFilters}
          >
            <Trash2 className="w-3 h-3" />
          </Button>

          {/* Actions */}
          <Button onClick={handleExport} variant="outline" size="sm" className="h-7 text-xs">
            Export
          </Button>
          <Button onClick={handleAdd} size="sm" className="h-7 text-xs">
            + Produk
          </Button>
        </div>
      </div>

      {/* (Opsional) ringkas metrik utama di bar kecil di bawah filter, kalau mau nanti bisa ditambah stat chip */}

      {/* Tabel ala penagihan */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header kolom */}
        <div className="flex-shrink-0 border-b bg-gray-100" style={{ height: 36 }}>
          <div className="flex h-full text-sm font-semibold text-gray-700 w-full">
            <div style={{ width: COLUMN_WIDTHS.nama }} className="px-2 flex items-center border-r">
              Nama Produk
            </div>
            <div style={{ width: COLUMN_WIDTHS.harga }} className="px-2 flex items-center border-r">
              Harga Satuan
            </div>
            <div style={{ width: COLUMN_WIDTHS.status }} className="px-2 flex items-center border-r">
              Status
            </div>
            <div style={{ width: COLUMN_WIDTHS.dikirim }} className="px-2 flex items-center border-r">
              Total Dikirim
            </div>
            <div style={{ width: COLUMN_WIDTHS.terjual }} className="px-2 flex items-center border-r">
              Total Terjual
            </div>
            <div style={{ width: COLUMN_WIDTHS.stok }} className="px-2 flex items-center border-r">
              Sisa Stok
            </div>
            <div style={{ width: COLUMN_WIDTHS.dibayar }} className="px-2 flex items-center border-r">
              Total Dibayar
            </div>
            <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center">
              Aksi
            </div>
          </div>
        </div>

        {/* Body virtualized */}
        <div ref={parentRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
              <p>Terjadi kesalahan saat memuat data produk.</p>
              <Button onClick={() => refetch()} size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Coba Lagi
              </Button>
            </div>
          ) : data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
              <Package className="w-8 h-8 text-gray-300" />
              <p>Tidak ada data produk ditemukan</p>
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const produk = data.data[virtualRow.index] as MasterProduk
                // Render each column using the same cell logic as useProdukColumns

                const renderCell = (col: ColumnDef<MasterProduk>, idx: number) => {
                  const Cell = col.cell as any
                  return (
                    <div key={idx} className="px-2 py-1">
                      {Cell ? <Cell row={{ original: produk }} /> : null}
                    </div>
                  )
                }

                return (
                  <div
                    key={produk.id_produk}
                    className="absolute w-full flex border-b hover:bg-blue-50/50 transition-colors"
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {/* Nama */}
                    <div style={{ width: COLUMN_WIDTHS.nama }} className="flex items-center">
                      {renderCell(columns[0], 0)}
                    </div>
                    {/* Harga */}
                    <div style={{ width: COLUMN_WIDTHS.harga }} className="flex items-center">
                      {renderCell(columns[1], 1)}
                    </div>
                    {/* Status */}
                    <div style={{ width: COLUMN_WIDTHS.status }} className="flex items-center">
                      {renderCell(columns[2], 2)}
                    </div>
                    {/* Total dikirim */}
                    <div style={{ width: COLUMN_WIDTHS.dikirim }} className="flex items-center">
                      {renderCell(columns[3], 3)}
                    </div>
                    {/* Total terjual */}
                    <div style={{ width: COLUMN_WIDTHS.terjual }} className="flex items-center">
                      {renderCell(columns[4], 4)}
                    </div>
                    {/* Sisa stok */}
                    <div style={{ width: COLUMN_WIDTHS.stok }} className="flex items-center">
                      {renderCell(columns[5], 5)}
                    </div>
                    {/* Total dibayar */}
                    <div style={{ width: COLUMN_WIDTHS.dibayar }} className="flex items-center">
                      {renderCell(columns[6], 6)}
                    </div>
                    {/* Aksi */}
                    <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center gap-0.5">
                      <button onClick={() => handleView(produk)} className="p-1 hover:bg-blue-100 text-blue-600" title="Lihat">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(produk)} className="p-1 hover:bg-green-100 text-green-600" title="Edit">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(produk)} className="p-1 hover:bg-red-100 text-red-600" title="Hapus">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <ModalBox
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open)
          if (!open) {
            setCreateSubmitting(false)
          }
        }}
        mode="edit"
        title="Tambah Produk"
        description="Masukkan informasi produk baru"
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <Button
              form={createFormId}
              type="submit"
              disabled={createSubmitting}
              className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              {createSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Simpan Produk
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                setCreateModalOpen(false)
                setCreateSubmitting(false)
              }}
            >
              <X className="h-4 w-4" />
              Tutup
            </Button>
          </div>
        }
        className="max-w-2xl"
      >
        <ProdukCreateForm
          formId={createFormId}
          className="space-y-4"
          onSubmittingChange={setCreateSubmitting}
          onSuccess={() => {
            setCreateModalOpen(false)
            setCreateSubmitting(false)
            refetch()
          }}
        />
      </ModalBox>

      {/* Detail Modal */}
      <ModalBox
        open={detailModalOpen && !!selectedProduk}
        onOpenChange={(open) => {
          setDetailModalOpen(open)
          if (!open && !editModalOpen) {
            setSelectedProduk(null)
          }
        }}
        mode="detail"
        title={
          selectedProduk
            ? `Detail Produk #${selectedProduk.id_produk}`
            : "Detail Produk"
        }
        description={selectedProduk?.nama_produk}
        className="max-w-3xl"
      >
        {produkDetailQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memuat detail produk...
          </div>
        ) : produkDetailQuery.error ? (
          <p className="text-sm text-red-600">
            Gagal memuat detail produk.
          </p>
        ) : (
          <ProdukDetailPanel
            produk={selectedProduk}
            detailRecord={detailRecord as any}
          />
        )}
      </ModalBox>

      {/* Edit Modal */}
      <ModalBox
        open={editModalOpen && !!selectedProduk}
        onOpenChange={(open) => {
          setEditModalOpen(open)
          if (!open) {
            setEditSubmitting(false)
            if (!detailModalOpen) {
              setSelectedProduk(null)
            }
          }
        }}
        mode="edit"
        title={
          selectedProduk
            ? `Edit Produk #${selectedProduk.id_produk}`
            : "Edit Produk"
        }
        description={selectedProduk?.nama_produk}
        footer={
          selectedProduk ? (
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
                  setEditSubmitting(false)
                  if (!detailModalOpen) {
                    setSelectedProduk(null)
                  }
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
        {selectedProduk && (
          <ProdukEditForm
            id={selectedProduk.id_produk}
            formId={modalFormId}
            initialData={{ ...selectedProduk, ...(detailRecord as any) }}
            onSubmittingChange={setEditSubmitting}
            onSuccess={() => {
              setEditModalOpen(false)
              setEditSubmitting(false)
              setSelectedProduk(null)
              refetch()
            }}
            className="space-y-4"
          />
        )}
      </ModalBox>
    </div>
  )
}
