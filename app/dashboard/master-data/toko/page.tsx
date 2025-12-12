'use client'

import React, { useMemo, useCallback, useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Eye,
  Edit,
  Trash2,
  MapPin,
  Store,
  Users,
  ExternalLink,
  Package,
  CreditCard,
  Archive,
  Phone,
  CheckCircle,
  XCircle,
  Truck,
  DollarSign,
  Warehouse,
  Search,
  RefreshCw
} from 'lucide-react'

import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSalesOptionsQuery, useKabupatenOptionsQuery, useKecamatanOptionsQuery } from '@/lib/queries/dashboard'
import { useNavigation } from '@/lib/hooks/use-navigation'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useMasterTokoQuery, type MasterToko } from '@/lib/queries/dashboard'
import { useDeleteTokoMutation } from '@/lib/queries/toko'
import { exportStoreData } from '@/lib/excel-export'
import { apiClient } from '@/lib/api-client'

// Status configuration
const statusConfig = {
  true: { 
    label: 'Aktif', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle
  },
  false: { 
    label: 'Non-aktif', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle
  }
}

// Helper function to create status badge
function createStatusBadge(status: boolean) {
  const config = statusConfig[status.toString() as keyof typeof statusConfig]
  const Icon = config.icon
  
  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

// Helper function to format numbers
function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// Helper function to parse product details
function parseProductDetails(detailString: string): Array<{name: string, quantity: number}> {
  if (!detailString) return []
  
  try {
    // Expected format: "Produk A [200], Produk B [300]"
    const products = detailString.split(', ').map(item => {
      const match = item.match(/^(.+?)\s*\[(\d+)\]$/)
      if (match) {
        return {
          name: match[1].trim(),
          quantity: parseInt(match[2])
        }
      }
      return null
    }).filter(Boolean)
    
    return products as Array<{name: string, quantity: number}>
  } catch (error) {
    return []
  }
}

// Product detail tooltip component
function ProductDetailTooltip({ 
  children, 
  detailString, 
  title 
}: { 
  children: React.ReactNode
  detailString?: string
  title: string
}) {
  const products = parseProductDetails(detailString || '')
  
  if (products.length === 0) {
    return <>{children}</>
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <div className="font-semibold text-sm">{title}</div>
          <div className="space-y-1">
            {products.map((product, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-gray-700">{product.name}</span>
                <span className="font-medium">{formatNumber(product.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// Calculate remaining stock details from shipped and sold details
function calculateRemainingStockDetails(detailShipped?: string, detailSold?: string): Array<{name: string, quantity: number}> {
  const shippedProducts = parseProductDetails(detailShipped || '')
  const soldProducts = parseProductDetails(detailSold || '')
  
  // Create a map of product quantities
  const productMap = new Map<string, number>()
  
  // Add shipped quantities
  shippedProducts.forEach(product => {
    productMap.set(product.name, (productMap.get(product.name) || 0) + product.quantity)
  })
  
  // Subtract sold quantities
  soldProducts.forEach(product => {
    productMap.set(product.name, (productMap.get(product.name) || 0) - product.quantity)
  })
  
  // Convert back to array and filter out zero or negative quantities
  const remainingStock = Array.from(productMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .filter(product => product.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  
  return remainingStock
}

// Remaining stock tooltip component
function RemainingStockTooltip({ 
  children, 
  detailShipped, 
  detailSold,
  title 
}: { 
  children: React.ReactNode
  detailShipped?: string
  detailSold?: string
  title: string
}) {
  const remainingProducts = calculateRemainingStockDetails(detailShipped, detailSold)
  
  if (remainingProducts.length === 0) {
    return <>{children}</>
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <div className="font-semibold text-sm">{title}</div>
          <div className="space-y-1">
            {remainingProducts.map((product, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-gray-700">{product.name}</span>
                <span className="font-medium">{formatNumber(product.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// Filter types
interface TokoFilters {
  search: string
  kabupaten: string
  kecamatan: string
  status_toko: string
  sales_id: string
}

export default function TokoPage() {
  const { navigate } = useNavigation()
  const { toast } = useToast()
  const deleteTokoMutation = useDeleteTokoMutation()
  const parentRef = useRef<HTMLDivElement>(null)

  // Filter state
  const [filters, setFilters] = useState<TokoFilters>({
    search: '',
    kabupaten: 'all',
    kecamatan: 'all',
    status_toko: 'all',
    sales_id: 'all'
  })

  // Filter options
  const { data: kabupatenOptions } = useKabupatenOptionsQuery()
  const { data: kecamatanOptions } = useKecamatanOptionsQuery(filters.kabupaten)
  const { data: salesOptions } = useSalesOptionsQuery()

  // Query parameters for API - fixed page + large limit for virtualized list
  const queryParams = useMemo(() => {
    const params: any = {
      page: 1,
      limit: 500
    }

    if (filters.search.trim()) {
      params.search = filters.search.trim()
    }
    if (filters.kabupaten !== 'all') {
      params.kabupaten = filters.kabupaten
    }
    if (filters.kecamatan !== 'all') {
      params.kecamatan = filters.kecamatan
    }
    if (filters.status_toko !== 'all') {
      params.status_toko = filters.status_toko
    }
    if (filters.sales_id !== 'all') {
      params.sales_id = filters.sales_id
    }

    return params
  }, [filters])

  // Dashboard query
  const { data: masterData, isLoading, error, refetch } = useMasterTokoQuery(queryParams)

  const rows: MasterToko[] = masterData?.data?.data || []
  const pagination = masterData?.data?.pagination

  const summary = useMemo(() => {
    const total = pagination?.total ?? rows.length
    const currentPage = pagination?.page ?? 1
    const totalPages = pagination?.totalPages ?? 1

    return {
      total_toko: total,
      current_page_count: rows.length,
      current_page: currentPage,
      total_pages: totalPages
    }
  }, [pagination, rows])

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.kabupaten !== 'all' ||
    filters.kecamatan !== 'all' ||
    filters.status_toko !== 'all' ||
    filters.sales_id !== 'all'
  )

  // Virtualizer for toko list
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10
  })

  // Filter handlers
  const handleFiltersChange = useCallback((newFilters: Partial<TokoFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      kabupaten: 'all',
      kecamatan: 'all',
      status_toko: 'all',
      sales_id: 'all'
    })
  }, [])

  // Handle delete
  const handleDelete = useCallback((toko: MasterToko) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus toko "${toko.nama_toko}"?`)) {
      deleteTokoMutation.mutate(toko.id_toko, {
        onSuccess: () => {
          toast({
            title: "Berhasil",
            description: `Toko "${toko.nama_toko}" berhasil dihapus`,
          })
          refetch()
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Gagal menghapus toko",
            variant: "destructive",
          })
        }
      })
    }
  }, [deleteTokoMutation, toast, refetch])

  // Handle view
  const handleView = useCallback((toko: MasterToko) => {
    navigate(`/dashboard/master-data/toko/${toko.id_toko}`)
  }, [navigate])

  // Handle edit
  const handleEdit = useCallback((toko: MasterToko) => {
    navigate(`/dashboard/master-data/toko/${toko.id_toko}/edit`)
  }, [navigate])

  // Handle export - fetch all data for export
  const handleExport = useCallback(async () => {
    try {
      // Fetch all data with current filters but no pagination limit
      const exportParams = {
        ...filters,
        kabupaten: filters.kabupaten === 'all' ? undefined : filters.kabupaten,
        kecamatan: filters.kecamatan === 'all' ? undefined : filters.kecamatan,
        status_toko: filters.status_toko === 'all' ? undefined : filters.status_toko,
        search: filters.search.trim() || undefined,
        limit: 10000, // Large limit to get all data
        page: 1
      }
      
      const exportData = await apiClient.getMasterToko(exportParams) as any
      
      if (exportData?.data?.data) {
        const result = exportStoreData(exportData.data.data)
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
      } else {
        throw new Error('Gagal mengambil data untuk export')
      }
    } catch (error: any) {
      toast({
        title: "Export Gagal",
        description: error.message || "Terjadi kesalahan saat export",
        variant: "destructive",
      })
    }
  }, [filters, toast])

  // Handle add new
  const handleAdd = useCallback(() => {
    navigate('/dashboard/master-data/toko/add')
  }, [navigate])

  const COLUMN_WIDTHS = {
    nama: '15%',
    kabupaten: '8%',
    kecamatan: '8%',
    telepon: '9%',
    sales: '12%',
    status: '7%',
    dikirim: '9%',
    terjual: '9%',
    stok: '7%',
    pendapatan: '8%',
    aksi: '4%'
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden bg-white">
        {/* Filter bar + summary + actions ala penagihan */}
        <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-[300px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Cari toko, sales, lokasi, telepon..."
                value={filters.search}
                onChange={(e) => handleFiltersChange({ search: e.target.value })}
                className="pl-7 h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none"
              />
            </div>

            {/* Sales */}
            <Select
              value={filters.sales_id}
              onValueChange={(value) => handleFiltersChange({ sales_id: value })}
            >
              <SelectTrigger className="w-[140px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Sales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Sales</SelectItem>
                {salesOptions?.data?.map((sales: any) => (
                  <SelectItem key={sales.id_sales} value={sales.id_sales.toString()}>
                    {sales.nama_sales}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kabupaten */}
            <Select
              value={filters.kabupaten}
              onValueChange={(value) => handleFiltersChange({ kabupaten: value, kecamatan: 'all' })}
            >
              <SelectTrigger className="w-[140px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Kabupaten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kab.</SelectItem>
                {kabupatenOptions?.data?.map((kab: any) => (
                  <SelectItem key={kab.kabupaten} value={kab.kabupaten}>
                    {kab.kabupaten}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kecamatan */}
            <Select
              value={filters.kecamatan}
              onValueChange={(value) => handleFiltersChange({ kecamatan: value })}
              disabled={filters.kabupaten === 'all'}
            >
              <SelectTrigger className="w-[140px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Kecamatan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kec.</SelectItem>
                {kecamatanOptions?.data?.map((kec: any) => (
                  <SelectItem key={kec.kecamatan} value={kec.kecamatan}>
                    {kec.kecamatan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={filters.status_toko}
              onValueChange={(value) => handleFiltersChange({ status_toko: value })}
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

            <div className="flex-1" />

            {/* Summary text */}
            <span className="text-xs text-gray-600 whitespace-nowrap">
              Menampilkan {summary.current_page_count} dari {formatNumber(summary.total_toko)} toko
              (Halaman {summary.current_page} dari {summary.total_pages})
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
              + Toko
            </Button>
          </div>
        </div>

        {/* Table ala penagihan */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header kolom */}
          <div className="flex-shrink-0 border-b bg-gray-100" style={{ height: 36 }}>
            <div className="flex h-full text-sm font-semibold text-gray-700 w-full">
              <div style={{ width: COLUMN_WIDTHS.nama }} className="px-2 flex items-center border-r">
                Nama Toko
              </div>
              <div style={{ width: COLUMN_WIDTHS.kabupaten }} className="px-2 flex items-center border-r">
                Kabupaten
              </div>
              <div style={{ width: COLUMN_WIDTHS.kecamatan }} className="px-2 flex items-center border-r">
                Kecamatan
              </div>
              <div style={{ width: COLUMN_WIDTHS.telepon }} className="px-2 flex items-center border-r">
                Nomor Telepon
              </div>
              <div style={{ width: COLUMN_WIDTHS.sales }} className="px-2 flex items-center border-r">
                Sales Penanggung Jawab
              </div>
              <div style={{ width: COLUMN_WIDTHS.status }} className="px-2 flex items-center border-r">
                Status Toko
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
              <div style={{ width: COLUMN_WIDTHS.pendapatan }} className="px-2 flex items-center border-r">
                Total Pendapatan
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
                <p>Terjadi kesalahan saat memuat data toko.</p>
                <Button onClick={() => refetch()} size="sm">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Coba Lagi
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
                <Store className="w-8 h-8 text-gray-300" />
                <p>Tidak ada data toko ditemukan</p>
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const toko = rows[virtualRow.index]

                  return (
                    <div
                      key={toko.id_toko}
                      className="absolute w-full flex border-b hover:bg-blue-50/50 transition-colors"
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      {/* Nama Toko */}
                      <div style={{ width: COLUMN_WIDTHS.nama }} className="px-2 flex items-center">
                        <div className="text-left">
                          <div className="font-medium text-gray-900 truncate">{toko.nama_toko}</div>
                          {toko.link_gmaps && (
                            <a
                              href={toko.link_gmaps}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 mt-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Lihat di Maps
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Kabupaten */}
                      <div style={{ width: COLUMN_WIDTHS.kabupaten }} className="px-2 flex items-center">
                        <span className="text-sm text-gray-900">
                          {toko.kabupaten || '-'}
                        </span>
                      </div>

                      {/* Kecamatan */}
                      <div style={{ width: COLUMN_WIDTHS.kecamatan }} className="px-2 flex items-center">
                        <span className="text-sm text-gray-900">
                          {toko.kecamatan || '-'}
                        </span>
                      </div>

                      {/* Nomor Telepon */}
                      <div style={{ width: COLUMN_WIDTHS.telepon }} className="px-2 flex items-center">
                        <div className="text-left">
                          {toko.no_telepon ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-green-600" />
                              <a
                                href={`tel:${toko.no_telepon}`}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {toko.no_telepon}
                              </a>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Tidak tersedia</span>
                          )}
                        </div>
                      </div>

                      {/* Sales Penanggung Jawab */}
                      <div style={{ width: COLUMN_WIDTHS.sales }} className="px-2 flex items-center">
                        <div className="text-left">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {toko.nama_sales || 'Sales tidak tersedia'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {toko.telepon_sales ? `Tel: ${toko.telepon_sales}` : 'Tidak ada telepon'}
                          </div>
                        </div>
                      </div>

                      {/* Status Toko */}
                      <div style={{ width: COLUMN_WIDTHS.status }} className="px-2 flex items-center">
                        <div className="text-left">
                          {createStatusBadge(!!toko.status_toko)}
                        </div>
                      </div>

                      {/* Barang Dikirim */}
                      <div style={{ width: COLUMN_WIDTHS.dikirim }} className="px-2 flex items-center">
                        <ProductDetailTooltip
                          detailString={toko.detail_shipped}
                          title="Detail Barang Dikirim"
                        >
                          <div className="text-left flex items-center gap-2">
                            <Truck className="h-4 w-4 text-blue-500" />
                            <div>
                              <div className="text-sm font-medium text-blue-600">
                                {formatNumber(toko.quantity_shipped || 0)}
                              </div>
                              <div className="text-xs text-gray-500">
                                total dikirim
                              </div>
                            </div>
                          </div>
                        </ProductDetailTooltip>
                      </div>

                      {/* Barang Terjual */}
                      <div style={{ width: COLUMN_WIDTHS.terjual }} className="px-2 flex items-center">
                        <ProductDetailTooltip
                          detailString={toko.detail_sold}
                          title="Detail Barang Terjual"
                        >
                          <div className="text-left flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <div>
                              <div className="text-sm font-medium text-green-600">
                                {formatNumber(toko.quantity_sold || 0)}
                              </div>
                              <div className="text-xs text-gray-500">
                                total terjual
                              </div>
                            </div>
                          </div>
                        </ProductDetailTooltip>
                      </div>

                      {/* Sisa Stok */}
                      <div style={{ width: COLUMN_WIDTHS.stok }} className="px-2 flex items-center">
                        <RemainingStockTooltip
                          detailShipped={toko.detail_shipped}
                          detailSold={toko.detail_sold}
                          title="Detail Sisa Stok"
                        >
                          <div className="text-left flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-orange-500" />
                            <div>
                              <div className="text-sm font-medium text-orange-600">
                                {formatNumber(toko.remaining_stock || 0)}
                              </div>
                              <div className="text-xs text-gray-500">
                                sisa stok
                              </div>
                            </div>
                          </div>
                        </RemainingStockTooltip>
                      </div>

                      {/* Total Pendapatan */}
                      <div style={{ width: COLUMN_WIDTHS.pendapatan }} className="px-2 flex items-center">
                        <div className="text-left flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-purple-500" />
                          <div>
                            <div className="text-sm font-medium text-purple-600">
                              Rp {formatNumber(toko.total_revenue || 0)}
                            </div>
                            <div className="text-xs text-gray-500">
                              pendapatan
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Aksi */}
                      <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center gap-0.5">
                        <button
                          onClick={() => handleView(toko)}
                          className="p-1 hover:bg-blue-100 text-blue-600"
                          title="Lihat Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(toko)}
                          className="p-1 hover:bg-green-100 text-green-600"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(toko)}
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
