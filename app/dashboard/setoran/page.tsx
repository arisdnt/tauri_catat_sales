'use client'

import React, { useMemo, useCallback, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Eye,
  Edit,
  Trash2,
  Banknote,
  Clock,
  Building,
  User,
  TrendingUp,
  CheckCircle,
  XCircle,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  CreditCard,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertCircle,
  TrendingDown
} from 'lucide-react'

import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigation } from '@/lib/hooks/use-navigation'

import { useDashboardSetoranQuery } from '@/lib/queries/dashboard'
import { useDeleteSetoranMutation } from '@/lib/queries/setoran'
import { usePengeluaranTotalByRange } from '@/lib/queries/pengeluaran'
import { exportDepositData } from '@/lib/excel-export'

// Page animations (identical to toko)
const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1
    }
  }
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4 }
  },
  hover: {
    scale: 1.02,
    transition: { duration: 0.2 }
  }
}

// Helper function to format numbers (identical to toko)
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

// Helper function to get date range display text
function getDateRangeDisplay(dateRange: string): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (dateRange) {
    case 'today':
      return `Today (${today.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })})`
    
    case 'week': {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 6)
      return `${weekAgo.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} - ${today.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    }
    
    case 'month': {
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 29)
      return `${monthAgo.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} - ${today.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    }
    
    case 'current_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      return `${firstDay.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} - ${today.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    }
    
    case 'last_month': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      return `${lastMonth.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} - ${lastDayOfLastMonth.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    }
    
    default:
      return dateRange
  }
}

// Filter types
interface SetoranFilters {
  search: string
  status_setoran: string
  date_range: 'today' | 'week' | 'month' | 'current_month' | 'last_month' | 'all'
  event_type: 'all' | 'PEMBAYARAN_CASH' | 'PEMBAYARAN_TRANSFER' | 'SETORAN'
}

// Cash Flow Summary Component - FIXED to show proper setoran count
// Statistics Card Component - Removed as requested
// This component has been removed and its functionality moved to CashFlowSummary

function CashFlowSummary({ summary, recordCount, currentFilter }: { 
  summary: any, 
  recordCount: number,
  currentFilter: string 
}) {
  // Use the same date range filter as the main page
  const dateRangeFilter = currentFilter || 'today'

  const { data: pengeluaranData, isLoading: isPengeluaranLoading } = usePengeluaranTotalByRange(dateRangeFilter)

  const stats = useMemo(() => {
    if (!summary) {
      return {
        totalCash: 0,
        totalTransfer: 0,
        totalSetoran: 0,
        totalPengeluaran: pengeluaranData?.total_pengeluaran || 0,
        totalTransactionsCash: 0,
        totalTransactionsTransfer: 0,
        totalSetoranTransactions: 0,
        totalRecords: recordCount || 0
      }
    }

    // Use the accurate summary data from database function
    const totalCash = summary.total_cash_in || 0
    const totalSetoran = summary.total_setoran || 0
    const totalPengeluaran = pengeluaranData?.total_pengeluaran || 0
    // PERBAIKAN: Kurangi total cash dengan setoran dan pengeluaran
    const sisaCash = totalCash - totalSetoran - totalPengeluaran
    
    return {
      totalCash,
      totalTransfer: summary.total_transfer_in || 0,
      totalSetoran: summary.total_setoran || 0,
      totalPengeluaran,
      sisaCash,
      totalTransactionsCash: summary.total_cash_transactions || 0,
      totalTransactionsTransfer: summary.total_transfer_transactions || 0,
      totalSetoranTransactions: summary.total_setoran_transactions || 0,
      totalRecords: recordCount || 0
    }
  }, [summary, recordCount, pengeluaranData])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-2">
      {/* Cash Payments Card */}
      <motion.div variants={cardVariants} whileHover="hover">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Total Pembayaran Cash</p>
                <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalCash)}</p>
                <p className="text-xs text-green-600 mt-1">
                  {stats.totalTransactionsCash} transaksi
                </p>
              </div>
              <div className="p-3 bg-green-200 rounded-full">
                <Wallet className="w-6 h-6 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transfer Payments Card */}
      <motion.div variants={cardVariants} whileHover="hover">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Pembayaran Transfer</p>
                <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.totalTransfer)}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {stats.totalTransactionsTransfer} transaksi
                </p>
              </div>
              <div className="p-3 bg-blue-200 rounded-full">
                <CreditCard className="w-6 h-6 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Setoran Card */}
      <motion.div variants={cardVariants} whileHover="hover">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Total Setoran</p>
                <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totalSetoran)}</p>
                <p className="text-xs text-purple-600 mt-1">
                  {stats.totalSetoranTransactions} setoran
                </p>
              </div>
              <div className="p-3 bg-purple-200 rounded-full">
                <ArrowUpCircle className="w-6 h-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Total Pengeluaran Card */}
      <motion.div variants={cardVariants} whileHover="hover">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-red-900">
                  {isPengeluaranLoading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    formatCurrency(stats.totalPengeluaran)
                  )}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Pengeluaran operasional
                </p>
              </div>
              <div className="p-3 bg-red-200 rounded-full">
                <TrendingDown className="w-6 h-6 text-red-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sisa Cash di Tangan Sales Card */}
      <motion.div variants={cardVariants} whileHover="hover">
        <Card className={`bg-gradient-to-br ${
          (stats.sisaCash ?? 0) > 0 
            ? 'from-orange-50 to-orange-100 border-orange-200' 
            : (stats.sisaCash ?? 0) < 0
            ? 'from-gray-50 to-gray-100 border-gray-200'
            : 'from-yellow-50 to-yellow-100 border-yellow-200'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  (stats.sisaCash ?? 0) > 0 ? 'text-orange-700' : 
                  (stats.sisaCash ?? 0) < 0 ? 'text-gray-700' : 'text-yellow-700'
                }`}>
                  Sisa Cash di Tangan Sales
                </p>
                <p className={`text-2xl font-bold ${
                  (stats.sisaCash ?? 0) > 0 ? 'text-orange-900' : 
                  (stats.sisaCash ?? 0) < 0 ? 'text-gray-900' : 'text-yellow-900'
                }`}>
                  {isPengeluaranLoading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    formatCurrency(Math.abs(stats.sisaCash ?? 0))
                  )}
                </p>
                <p className={`text-xs mt-1 ${
                  (stats.sisaCash ?? 0) > 0 ? 'text-orange-600' : 
                  (stats.sisaCash ?? 0) < 0 ? 'text-gray-600' : 'text-yellow-600'
                }`}>
                  {(stats.sisaCash ?? 0) > 0 ? 'Sisa positif' : 
                   (stats.sisaCash ?? 0) < 0 ? 'Defisit' : 'Seimbang'}
                </p>
              </div>
              <div className={`p-3 rounded-full ${
                (stats.sisaCash ?? 0) > 0 ? 'bg-orange-200' : 
                (stats.sisaCash ?? 0) < 0 ? 'bg-gray-200' : 'bg-yellow-200'
              }`}>
                {(stats.sisaCash ?? 0) > 0 ? (
                  <Wallet className="w-6 h-6 text-orange-700" />
                ) : (stats.sisaCash ?? 0) < 0 ? (
                  <AlertCircle className="w-6 h-6 text-gray-700" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-yellow-700" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// Filter component
function SetoranFilterPanel({ 
  filters, 
  onFiltersChange,
  onClearFilters,
  isLoading
}: {
  filters: SetoranFilters
  onFiltersChange: (filters: Partial<SetoranFilters>) => void
  onClearFilters: () => void
  isLoading: boolean
}) {
  const hasActiveFilters = Boolean(
    filters.search || 
    (filters.date_range && filters.date_range !== 'all') ||
    (filters.status_setoran && filters.status_setoran !== 'all') ||
    (filters.event_type && filters.event_type !== 'all')  // 'all' is now the default, so only show as active if different
  )

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Search Input */}
          <div className="flex-1 min-w-[300px]">
            <label className="text-sm font-medium">Pencarian</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari penerima, ID setoran..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="min-w-[160px]">
            <label className="text-sm font-medium">Periode Waktu</label>
            <Select
              value={filters.date_range}
              onValueChange={(value) => onFiltersChange({ date_range: value as any })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">7 Hari Terakhir</SelectItem>
                <SelectItem value="month">30 Hari Terakhir</SelectItem>
                <SelectItem value="current_month">Bulan Ini</SelectItem>
                <SelectItem value="last_month">Bulan Lalu</SelectItem>
                <SelectItem value="all">Semua Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Event Type Filter */}
          <div className="min-w-[160px]">
            <label className="text-sm font-medium">Jenis Transaksi</label>
            <Select
              value={filters.event_type}
              onValueChange={(value) => onFiltersChange({ event_type: value as any })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Setoran saja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Transaksi</SelectItem>
                <SelectItem value="PEMBAYARAN_CASH">💰 Cash Masuk</SelectItem>
                <SelectItem value="PEMBAYARAN_TRANSFER">💳 Transfer Masuk</SelectItem>
                <SelectItem value="SETORAN">📤 Setoran</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[160px]">
            <label className="text-sm font-medium">Status Balance</label>
            <Select
              value={filters.status_setoran}
              onValueChange={(value) => onFiltersChange({ status_setoran: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="SESUAI">Sesuai</SelectItem>
                <SelectItem value="KURANG_SETOR">Kurang Setor</SelectItem>
                <SelectItem value="LEBIH_SETOR">Lebih Setor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              disabled={!hasActiveFilters || isLoading}
              className="px-3 py-2"
              title="Clear Filters"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              {filters.search && (
                <Badge variant="secondary">Search: {filters.search}</Badge>
              )}
              {filters.date_range && filters.date_range !== 'all' && (
                <Badge variant="secondary">
                  Period: {getDateRangeDisplay(filters.date_range)}
                </Badge>
              )}
              {filters.event_type && filters.event_type !== 'all' && (
                <Badge variant="secondary">
                  Jenis: {filters.event_type === 'PEMBAYARAN_CASH' ? 'Cash Masuk' : 
                         filters.event_type === 'PEMBAYARAN_TRANSFER' ? 'Transfer Masuk' : 'Setoran'}
                </Badge>
              )}
              {filters.status_setoran && filters.status_setoran !== 'all' && (
                <Badge variant="secondary">Status: {filters.status_setoran}</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DepositsPage() {
  const { navigate } = useNavigation()
  const { toast } = useToast()
  const deleteSetoranMutation = useDeleteSetoranMutation()
  const parentRef = useRef<HTMLDivElement>(null)

  // Filter state - DEFAULT to show all transactions
  const [filters, setFilters] = useState<SetoranFilters>({
    search: '',
    status_setoran: 'all',
    date_range: 'current_month',
    event_type: 'all'
  })

  // Use dashboard query with fixed page+limit (virtualized list)
  const { data: dashboardData, isLoading, error, refetch } = useDashboardSetoranQuery({
    page: 1,
    limit: 500,
    ...filters
  })

  const rows = dashboardData?.data?.data || []
  const pagination = dashboardData?.data?.pagination

  const summary = useMemo(() => {
    const total = pagination?.total ?? rows.length
    const currentPage = pagination?.page ?? 1
    const totalPages = pagination?.total_pages ?? 1
    return {
      total_deposits: total,
      current_page_count: rows.length,
      current_page: currentPage,
      total_pages: totalPages
    }
  }, [pagination, rows])

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10
  })

  // Filter handlers
  const handleFiltersChange = useCallback((newFilters: Partial<SetoranFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status_setoran: 'all',
      date_range: 'current_month',
      event_type: 'all'
    })
  }, [])

  // Handle delete (adapted for setoran)
  const handleDelete = useCallback((setoran: any) => {
    if (setoran.event_type !== 'SETORAN') {
      toast({
        title: "Error",
        description: "Hanya transaksi setoran yang dapat dihapus",
        variant: "destructive",
      })
      return
    }

    if (window.confirm(`Apakah Anda yakin ingin menghapus setoran #${setoran.id_setoran}?`)) {
      deleteSetoranMutation.mutate(setoran.id_setoran, {
        onSuccess: () => {
          toast({
            title: "Berhasil",
            description: `Setoran #${setoran.id_setoran} berhasil dihapus`,
          })
          refetch()
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.message || "Gagal menghapus setoran",
            variant: "destructive",
          })
        }
      })
    }
  }, [deleteSetoranMutation, toast, refetch])

  // Handle view
  const handleView = useCallback((setoran: any) => {
    if (setoran.event_type !== 'SETORAN') {
      toast({
        title: "Info",
        description: "Detail view hanya tersedia untuk transaksi setoran",
        variant: "default",
      })
      return
    }
    navigate(`/dashboard/setoran/${setoran.id_setoran}`)
  }, [navigate, toast])

  // Handle edit
  const handleEdit = useCallback((setoran: any) => {
    if (setoran.event_type !== 'SETORAN') {
      toast({
        title: "Info",
        description: "Edit hanya tersedia untuk transaksi setoran",
        variant: "default",
      })
      return
    }
    navigate(`/dashboard/setoran/${setoran.id_setoran}/edit`)
  }, [navigate, toast])

  // Handle export
  const handleExport = useCallback(() => {
    if (!rows) return

    const result = exportDepositData(rows)
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
  }, [rows, toast])

  // Handle add new
  const handleAdd = useCallback(() => {
    navigate('/dashboard/setoran/add')
  }, [navigate])

  // Helpers for row rendering
  const getEventDisplay = (type: string) => {
    switch (type) {
      case 'PEMBAYARAN_CASH': return { icon: '💰', text: 'Cash Masuk', color: 'text-green-600' }
      case 'PEMBAYARAN_TRANSFER': return { icon: '💳', text: 'Transfer Masuk', color: 'text-blue-600' }
      case 'SETORAN': return { icon: '📤', text: 'Setoran', color: 'text-purple-600' }
      default: return { icon: '📊', text: 'Transaksi', color: 'text-gray-600' }
    }
  }

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'PEMBAYARAN_CASH': return 'text-green-900'
      case 'PEMBAYARAN_TRANSFER': return 'text-blue-900'
      case 'SETORAN': return 'text-purple-900'
      default: return 'text-gray-900'
    }
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'PEMBAYARAN_CASH': return 'bg-green-100 text-green-800'
      case 'PEMBAYARAN_TRANSFER': return 'bg-blue-100 text-blue-800'
      case 'SETORAN': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'PEMBAYARAN_CASH': return 'Cash In'
      case 'PEMBAYARAN_TRANSFER': return 'Transfer In'
      case 'SETORAN': return 'Cash Out'
      default: return 'Unknown'
    }
  }

  const COLUMN_WIDTHS = {
    id: '18%',
    jumlah: '24%',
    penerima: '23%',
    waktu: '18%',
    status: '11%',
    aksi: '6%'
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Filter bar + summary + actions ala penagihan */}
      <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-[300px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Cari penerima, ID..."
              value={filters.search}
              onChange={(e) => handleFiltersChange({ search: e.target.value })}
              className="pl-7 h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none"
            />
          </div>

          {/* Periode */}
          <Select
            value={filters.date_range}
            onValueChange={(value) => handleFiltersChange({ date_range: value as any })}
          >
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

          {/* Jenis Transaksi */}
          <Select
            value={filters.event_type}
            onValueChange={(value) => handleFiltersChange({ event_type: value as any })}
          >
            <SelectTrigger className="w-[170px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Jenis transaksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Transaksi</SelectItem>
              <SelectItem value="PEMBAYARAN_CASH">Cash Masuk</SelectItem>
              <SelectItem value="PEMBAYARAN_TRANSFER">Transfer Masuk</SelectItem>
              <SelectItem value="SETORAN">Setoran</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Balance */}
          <Select
            value={filters.status_setoran}
            onValueChange={(value) => handleFiltersChange({ status_setoran: value })}
          >
            <SelectTrigger className="w-[150px] h-7 text-xs focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="SESUAI">Sesuai</SelectItem>
              <SelectItem value="KURANG_SETOR">Kurang Setor</SelectItem>
              <SelectItem value="LEBIH_SETOR">Lebih Setor</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Summary text */}
          <span className="text-xs text-gray-600 whitespace-nowrap">
            {filters.event_type === 'SETORAN'
              ? `Menampilkan ${summary.current_page_count} dari ${formatNumber(summary.total_deposits)} setoran (Halaman ${summary.current_page} dari ${summary.total_pages})`
              : `Menampilkan ${summary.current_page_count} dari ${formatNumber(summary.total_deposits)} transaksi (Halaman ${summary.current_page} dari ${summary.total_pages})`}
          </span>

          {/* Clear */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 px-2 text-xs"
            disabled={
              !(
                filters.search ||
                filters.date_range !== 'all' ||
                filters.status_setoran !== 'all' ||
                filters.event_type !== 'all'
              )
            }
          >
            <Trash2 className="w-3 h-3" />
          </Button>

          {/* Actions */}
          <Button onClick={handleExport} variant="outline" size="sm" className="h-7 text-xs">
            Export
          </Button>
          <Button onClick={handleAdd} size="sm" className="h-7 text-xs">
            + Setoran
          </Button>
        </div>
      </div>

      {/* Cash Flow Summary row (stat cards) */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-white">
        <CashFlowSummary
          summary={dashboardData?.data?.summary}
          recordCount={rows.length}
          currentFilter={filters.date_range}
        />
      </div>

      {/* Table Container ala penagihan */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header kolom */}
        <div className="flex-shrink-0 border-b bg-gray-100" style={{ height: 36 }}>
          <div className="flex h-full text-sm font-semibold text-gray-700 w-full">
            <div style={{ width: COLUMN_WIDTHS.id }} className="px-2 flex items-center border-r">
              ID & Jenis Transaksi
            </div>
            <div style={{ width: COLUMN_WIDTHS.jumlah }} className="px-2 flex items-center border-r">
              Jumlah & Deskripsi
            </div>
            <div style={{ width: COLUMN_WIDTHS.penerima }} className="px-2 flex items-center border-r">
              Penerima & Running Balance
            </div>
            <div style={{ width: COLUMN_WIDTHS.waktu }} className="px-2 flex items-center border-r">
              Waktu Transaksi
            </div>
            <div style={{ width: COLUMN_WIDTHS.status }} className="px-2 flex items-center border-r">
              Status & Kategori
            </div>
            <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center">
              Aksi
            </div>
          </div>
        </div>

        {/* Virtualized rows */}
        <div ref={parentRef} className="flex-1 overflow-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
              <p>Terjadi kesalahan saat memuat data setoran.</p>
              <Button onClick={() => refetch()} size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Coba Lagi
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
              <Receipt className="w-8 h-8 text-gray-300" />
              <p>Tidak ada data setoran ditemukan</p>
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = rows[virtualRow.index]
                const eventDisplay = getEventDisplay(item.event_type)
                const runningBalance = item.cash_balance_kumulatif || 0
                const waktu = item.waktu_setoran ? new Date(item.waktu_setoran) : null

                return (
                  <div
                    key={item.id_setoran}
                    className="absolute w-full flex border-b hover:bg-blue-50/50 transition-colors"
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {/* ID & Jenis */}
                    <div style={{ width: COLUMN_WIDTHS.id }} className="px-2 flex flex-col justify-center">
                      <span className="text-sm font-mono font-medium text-gray-900">#{item.id_setoran}</span>
                      <span className="text-xs text-gray-500">{item.tanggal_setoran}</span>
                      <span className={`text-xs font-medium mt-1 ${eventDisplay.color}`}>
                        {eventDisplay.icon} {eventDisplay.text}
                      </span>
                    </div>

                    {/* Jumlah & Deskripsi */}
                    <div style={{ width: COLUMN_WIDTHS.jumlah }} className="px-2 flex flex-col justify-center overflow-hidden">
                      <span className={`text-sm font-medium ${getAmountColor(item.event_type)}`}>
                        {formatCurrency(item.total_setoran || 0)}
                      </span>
                      <span className="text-xs text-gray-600 mt-1 truncate" title={item.description}>
                        {item.description}
                      </span>
                      {item.nama_toko && item.nama_toko !== 'N/A' && (
                        <span className="text-xs text-gray-500 mt-1">
                          {item.nama_toko}
                        </span>
                      )}
                    </div>

                    {/* Penerima & Running Balance */}
                    <div style={{ width: COLUMN_WIDTHS.penerima }} className="px-2 flex flex-col justify-center overflow-hidden">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.penerima_setoran || 'Sistem'}
                      </span>
                      <span className={`text-xs font-medium ${
                        runningBalance > 1000000 ? 'text-orange-600' : 
                        runningBalance < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        Cash On Hand: {formatCurrency(Math.abs(runningBalance))}
                      </span>
                      <span className={`text-xs ${
                        runningBalance > 1000000 ? 'text-orange-500' : 
                        runningBalance < 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {runningBalance > 1000000 ? '⚠️ Cash Tinggi' : 
                         runningBalance < 0 ? '❌ Cash Negatif' : '✅ Normal'}
                      </span>
                    </div>

                    {/* Waktu Transaksi */}
                    <div style={{ width: COLUMN_WIDTHS.waktu }} className="px-2 flex flex-col justify-center">
                      {waktu && (
                        <>
                          <span className="text-sm font-medium text-gray-900">
                            {waktu.toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="text-xs text-gray-500">
                            {waktu.toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })} WIB
                          </span>
                        </>
                      )}
                    </div>

                    {/* Status & Kategori */}
                    <div style={{ width: COLUMN_WIDTHS.status }} className="px-2 flex flex-col justify-center overflow-hidden">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getEventTypeColor(item.event_type)}`}>
                        {getEventTypeLabel(item.event_type)}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        {item.transaction_category}
                      </span>
                      {item.kecamatan && item.kecamatan !== 'N/A' && (
                        <span className="text-xs text-gray-400 mt-1 truncate">
                          {item.kecamatan}
                        </span>
                      )}
                    </div>

                    {/* Aksi */}
                    <div style={{ width: COLUMN_WIDTHS.aksi }} className="px-2 flex items-center gap-0.5">
                      <button onClick={() => handleView(item)} className="p-1 hover:bg-blue-100 text-blue-600" title="Lihat Detail">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(item)} className="p-1 hover:bg-green-100 text-green-600" title="Edit">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item)} className="p-1 hover:bg-red-100 text-red-600" title="Hapus">
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
  )
}
