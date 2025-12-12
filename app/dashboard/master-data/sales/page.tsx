'use client'

import React, { useMemo, useCallback, useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Store,
  Package,
  Search,
  RefreshCw,
  Phone
} from 'lucide-react'

import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavigation } from '@/lib/hooks/use-navigation'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useMasterSalesQuery, type MasterSales } from '@/lib/queries/dashboard'
import { useDeleteSalesMutation } from '@/lib/queries/sales'
import { exportSalesData } from '@/lib/excel-export'
import { INDONESIA_TIMEZONE } from '@/lib/utils'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'

// Helper function to format numbers
function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// Helper function to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

// Filter types
interface SalesFilters {
  search: string
  status_aktif: string
  telepon_exists: string
  start_date: string
  end_date: string
}

export default function SalesPage() {
  const { navigate } = useNavigation()
  const { toast } = useToast()
  const deleteSalesMutation = useDeleteSalesMutation()

  // Initialize date range for current month (1st to last day)
  const initializeDateRange = () => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    // Start from the 1st day of current month
    const firstDay = new Date(currentYear, currentMonth, 1)
    // End at current date
    const lastDay = new Date(today)

    // Format dates using Indonesia timezone
    const startDate = new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(firstDay)

    const endDate = new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(lastDay)

    return { startDate, endDate }
  }

  // Filter state with default date range
  const [filters, setFilters] = useState<SalesFilters>(() => {
    const { startDate, endDate } = initializeDateRange()
    return {
      search: '',
      status_aktif: 'all',
      telepon_exists: 'all',
      start_date: startDate,
      end_date: endDate
    }
  })

  // Use new dashboard query with date parameters
  const { data: masterData, isLoading, error, refetch } = useMasterSalesQuery({
    start_date: filters.start_date,
    end_date: filters.end_date
  })

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (!masterData?.data) return []

    let filtered = [...masterData.data]

    // Search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim()
      filtered = filtered.filter(item =>
        item.nama_sales?.toLowerCase().includes(searchTerm) ||
        item.nomor_telepon?.includes(searchTerm) ||
        item.id_sales?.toString().includes(searchTerm)
      )
    }

    // Status filter
    if (filters.status_aktif !== 'all') {
      const isActive = filters.status_aktif === 'true'
      filtered = filtered.filter(item => item.status_aktif === isActive)
    }

    // Phone filter
    if (filters.telepon_exists !== 'all') {
      const hasPhone = filters.telepon_exists === 'true'
      filtered = filtered.filter(item => hasPhone ? !!item.nomor_telepon : !item.nomor_telepon)
    }

    return filtered
  }, [masterData?.data, filters])

  // Filter handlers
  const handleFiltersChange = useCallback((newFilters: Partial<SalesFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleClearFilters = useCallback(() => {
    const { startDate, endDate } = initializeDateRange()
    setFilters({
      search: '',
      status_aktif: 'all',
      telepon_exists: 'all',
      start_date: startDate,
      end_date: endDate
    })
  }, [])

  // Handle delete
  const handleDelete = useCallback((sales: MasterSales) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus sales "${sales.nama_sales}"?`)) {
      deleteSalesMutation.mutate(sales.id_sales, {
        onSuccess: () => {
          toast({
            title: "Berhasil",
            description: `Sales "${sales.nama_sales}" berhasil dihapus`,
          })
          refetch()
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Gagal menghapus sales",
            variant: "destructive",
          })
        }
      })
    }
  }, [deleteSalesMutation, toast, refetch])

  // Handle view
  const handleView = useCallback((sales: MasterSales) => {
    navigate(`/dashboard/master-data/sales/${sales.id_sales}`)
  }, [navigate])

  // Handle edit
  const handleEdit = useCallback((sales: MasterSales) => {
    navigate(`/dashboard/master-data/sales/${sales.id_sales}/edit`)
  }, [navigate])

  // Handle export
  const handleExport = useCallback(() => {
    if (!filteredData || filteredData.length === 0) return

    const result = exportSalesData(filteredData)
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
  }, [filteredData, toast])

  // Handle add new
  const handleAdd = useCallback(() => {
    navigate('/dashboard/master-data/sales/add')
  }, [navigate])

  // Summary statistics for header display only
  const summary = {
    total_sales: filteredData.length,
    active_sales: filteredData.filter(s => s.status_aktif).length,
    total_stores: filteredData.reduce((sum, s) => sum + (Number(s.total_stores) || 0), 0),
    total_shipped_items: filteredData.reduce((sum, s) => sum + (Number(s.quantity_shipped) || 0), 0),
    total_items_sold: filteredData.reduce((sum, s) => sum + (Number(s.quantity_sold) || 0), 0),
    total_remaining_stock: filteredData.reduce((sum, s) => sum + ((Number(s.quantity_shipped) || 0) - (Number(s.quantity_sold) || 0)), 0),
    total_revenue: filteredData.reduce((sum, s) => sum + (Number(s.total_revenue) || 0), 0)
  }

  const rows = filteredData

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.status_aktif !== 'all' ||
    filters.telepon_exists !== 'all' ||
    filters.start_date !== initializeDateRange().startDate ||
    filters.end_date !== initializeDateRange().endDate
  )

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10
  })

  const COLUMN_WIDTHS = {
    sales: '17%',
    telepon: '12%',
    status: '7%',
    totalToko: '9%',
    dikirim: '10%',
    terjual: '10%',
    stok: '9%',
    revenue: '13%',
    dibuat: '7%',
    aksi: '6%'
  }

  // Helper to apply quick date presets
  const handleDatePresetChange = useCallback((preset: string) => {
    const today = new Date()
    let start = new Date(today)
    let end = new Date(today)

    switch (preset) {
      case 'today':
        // start & end already today
        break
      case '7_days':
        start.setDate(end.getDate() - 6)
        break
      case '30_days':
        start.setDate(end.getDate() - 29)
        break
      case 'current_month': {
        const year = today.getFullYear()
        const month = today.getMonth()
        start = new Date(year, month, 1)
        end = new Date(today)
        break
      }
      default:
        // 'custom' or unknown: do not change dates
        return
    }

    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })

    const startDate = fmt.format(start)
    const endDate = fmt.format(end)

    setFilters(prev => ({
      ...prev,
      start_date: startDate,
      end_date: endDate
    }))
  }, [])

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden bg-white">
        {/* Filter bar + summary + actions (termasuk periode) */}
        <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-[260px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Cari sales, telepon..."
                value={filters.search}
                onChange={(e) => handleFiltersChange({ search: e.target.value })}
                className="pl-7 h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none"
              />
            </div>

            {/* Status */}
            <Select
              value={filters.status_aktif}
              onValueChange={(value) => handleFiltersChange({ status_aktif: value })}
            >
              <SelectTrigger className="w-[120px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="true">Aktif</SelectItem>
                <SelectItem value="false">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>

            {/* Telepon */}
            <Select
              value={filters.telepon_exists}
              onValueChange={(value) => handleFiltersChange({ telepon_exists: value })}
            >
              <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Telepon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="true">Ada Telepon</SelectItem>
                <SelectItem value="false">Tanpa Telepon</SelectItem>
              </SelectContent>
            </Select>

            {/* Periode (quick range dropdown) */}
            <Select defaultValue="current_month" onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-[130px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="7_days">7 Hari</SelectItem>
                <SelectItem value="30_days">30 Hari</SelectItem>
                <SelectItem value="current_month">Bulan Ini</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom date range inputs */}
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFiltersChange({ start_date: e.target.value })}
                className="w-40 h-7 text-xs"
              />
              <span className="text-xs text-gray-500">s/d</span>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFiltersChange({ end_date: e.target.value })}
                className="w-40 h-7 text-xs"
              />
            </div>

            <div className="flex-1" />

            {/* Summary text */}
            <span className="text-xs text-gray-600 whitespace-nowrap">
              Menampilkan {formatNumber(summary.total_sales)} sales
              {masterData?.data && summary.total_sales !== masterData.data.length &&
                ` dari ${formatNumber(masterData.data.length)} total`
              } • Revenue {formatCurrency(summary.total_revenue)}
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
              + Sales
            </Button>
          </div>
        </div>

        {/* Tabel ala penagihan */}
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {/* Header kolom */}
          <div className="flex-shrink-0 border-b bg-gray-100 w-full" style={{ height: 36 }}>
            <div className="flex h-full text-sm font-semibold text-gray-700 w-full" style={{ tableLayout: 'fixed' }}>
              <div style={{ width: COLUMN_WIDTHS.sales }} className="px-2 flex items-center border-r">
                Sales
              </div>
              <div style={{ width: COLUMN_WIDTHS.telepon }} className="px-2 flex items-center border-r">
                Telepon
              </div>
              <div style={{ width: COLUMN_WIDTHS.status }} className="px-2 flex items-center border-r">
                Status
              </div>
              <div style={{ width: COLUMN_WIDTHS.totalToko }} className="px-2 flex items-center border-r">
                Total Toko
              </div>
              <div style={{ width: COLUMN_WIDTHS.dikirim }} className="px-2 flex items-center border-r">
                Barang Dikirim
              </div>
              <div style={{ width: COLUMN_WIDTHS.terjual }} className="px-2 flex items-center border-r">
                Barang Terjual
              </div>
              <div style={{ width: COLUMN_WIDTHS.stok }} className="px-2 flex items-center border-r">
                Sisa Stok
              </div>
              <div style={{ width: COLUMN_WIDTHS.revenue }} className="px-2 flex items-center border-r">
                Total Revenue
              </div>
              <div style={{ width: COLUMN_WIDTHS.dibuat }} className="px-2 flex items-center border-r">
                Dibuat
              </div>
              <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center">
                Aksi
              </div>
            </div>
          </div>

          {/* Body virtualized */}
          <div ref={parentRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
                <p>Terjadi kesalahan saat memuat data sales.</p>
                <Button onClick={() => refetch()} size="sm">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Coba Lagi
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
                <Store className="w-8 h-8 text-gray-300" />
                <p>Tidak ada data sales ditemukan</p>
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const sales = rows[virtualRow.index]
                  const remainingStock = (sales.quantity_shipped || 0) - (sales.quantity_sold || 0)
                  const remainingDetails = 'Detail stok tidak tersedia untuk data sales'

                  return (
                    <div
                      key={sales.id_sales}
                      className="absolute w-full flex border-b hover:bg-blue-50/50 transition-colors"
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      {/* Sales */}
                      <div style={{ width: COLUMN_WIDTHS.sales }} className="px-2 flex items-center">
                        <div className="min-w-0 text-left">
                          <div className="font-medium text-gray-900 truncate">{sales.nama_sales}</div>
                          <div className="text-xs text-gray-500 font-mono">#{sales.id_sales}</div>
                        </div>
                      </div>

                      {/* Telepon */}
                      <div style={{ width: COLUMN_WIDTHS.telepon }} className="px-2 flex items-center">
                        <div className="min-w-0 text-left">
                          {sales.nomor_telepon ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-green-600" />
                              <a
                                href={`tel:${sales.nomor_telepon}`}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {sales.nomor_telepon}
                              </a>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Tidak tersedia</span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{ width: COLUMN_WIDTHS.status }} className="px-2 flex items-center">
                        <div className="text-left">
                          <Badge
                            variant="outline"
                            className={`text-xs ${sales.status_aktif
                              ? 'border-green-200 text-green-700 bg-green-50'
                              : 'border-red-200 text-red-700 bg-red-50'
                              }`}
                          >
                            {sales.status_aktif ? 'AKTIF' : 'NON'}
                          </Badge>
                        </div>
                      </div>

                      {/* Total Toko */}
                      <div style={{ width: COLUMN_WIDTHS.totalToko }} className="px-2 flex items-center">
                        <div className="text-left flex items-center gap-2">
                          <Store className="h-4 w-4 text-blue-500" />
                          <div>
                            <div className="text-sm font-medium text-blue-600">
                              {formatNumber(sales.total_stores)}
                            </div>
                            <div className="text-xs text-gray-500">toko</div>
                          </div>
                        </div>
                      </div>

                      {/* Barang Dikirim */}
                      <div style={{ width: COLUMN_WIDTHS.dikirim }} className="px-2 flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-left flex items-center gap-2 cursor-help">
                              <Package className="h-4 w-4 text-blue-500" />
                              <div>
                                <div className="text-sm font-medium text-blue-600">
                                  {formatNumber(sales.quantity_shipped)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  barang
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="p-2">
                              <p className="font-semibold text-sm mb-2">Detail Barang Dikirim:</p>
                              <p className="text-xs whitespace-pre-line">
                                {sales.detail_shipped || 'Tidak ada detail pengiriman'}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Barang Terjual */}
                      <div style={{ width: COLUMN_WIDTHS.terjual }} className="px-2 flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-left flex items-center gap-2 cursor-help">
                              <Package className="h-4 w-4 text-green-500" />
                              <div>
                                <div className="text-sm font-medium text-green-600">
                                  {formatNumber(sales.quantity_sold)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  barang
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="p-2">
                              <p className="font-semibold text-sm mb-2">Detail Barang Terjual:</p>
                              <p className="text-xs whitespace-pre-line">
                                {sales.detail_sold || 'Tidak ada detail penjualan'}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Sisa Stok */}
                      <div style={{ width: COLUMN_WIDTHS.stok }} className="px-2 flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-left flex items-center gap-2 cursor-help">
                              <Package className="h-4 w-4 text-orange-500" />
                              <div>
                                <div className="text-sm font-medium text-orange-600">
                                  {formatNumber(remainingStock)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  sisa stok
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="p-2">
                              <p className="font-semibold text-sm mb-2">Detail Sisa Stok:</p>
                              <p className="text-xs whitespace-pre-line">
                                {remainingDetails || 'Tidak ada detail tersedia'}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Total Revenue */}
                      <div style={{ width: COLUMN_WIDTHS.revenue }} className="px-2 flex items-center">
                        <div className="text-left flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-purple-500" />
                          <div>
                            <div className="text-sm font-medium text-purple-600">
                              {formatCurrency(sales.total_revenue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              revenue
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dibuat */}
                      <div style={{ width: COLUMN_WIDTHS.dibuat }} className="px-2 flex items-center">
                        <div className="text-left">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(sales.dibuat_pada).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Aksi */}
                      <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center gap-0.5">
                        <button
                          onClick={() => handleView(sales)}
                          className="p-1 hover:bg-blue-100 text-blue-600"
                          title="Lihat Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(sales)}
                          className="p-1 hover:bg-green-100 text-green-600"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sales)}
                          className="p-1 hover:bg-red-100 text-red-600"
                          title="Hapus"
                        >
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
      </div>
    </TooltipProvider>
  )
}
