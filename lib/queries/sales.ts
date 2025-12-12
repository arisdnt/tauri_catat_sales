import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

export interface ApiResponse<T> {
  success: boolean
  data: T
}

export interface Sales {
  id_sales: number
  nama_sales: string
  nomor_telepon: string | null
  status_aktif: boolean
  dibuat_pada: string
  diperbarui_pada: string
}

export interface CreateSalesData {
  nama_sales: string
  nomor_telepon?: string
}

export interface UpdateSalesData extends CreateSalesData {
  status_aktif?: boolean
}

export interface SalesStats {
  id_sales: number
  nama_sales: string
  total_stores: number
  total_shipped_items: number
  total_revenue: number
  total_stock?: number
}

// Query Keys
export const salesKeys = {
  all: ['sales'] as const,
  lists: () => [...salesKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...salesKeys.lists(), { filters }] as const,
  details: () => [...salesKeys.all, 'detail'] as const,
  detail: (id: number) => [...salesKeys.details(), id] as const,
  stats: () => [...salesKeys.all, 'stats'] as const,
  activities: (id: number) => [...salesKeys.detail(id), 'activities'] as const,
  recentShipments: (id: number, limit?: number) => [...salesKeys.detail(id), 'recent-shipments', { limit }] as const,
  recentPayments: (id: number, limit?: number) => [...salesKeys.detail(id), 'recent-payments', { limit }] as const,
  inventory: (id: number) => [...salesKeys.detail(id), 'inventory'] as const,
  productSales: (id: number) => [...salesKeys.detail(id), 'product-sales'] as const,
  detailStats: (id: number) => [...salesKeys.detail(id), 'stats'] as const,
}

// Queries
export function useSalesQuery(status?: 'active') {
  return useQuery({
    queryKey: salesKeys.list({ status }),
    queryFn: () => apiClient.getSales() as Promise<ApiResponse<Sales[]>>,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useSalesDetailQuery(id: number) {
  return useQuery({
    queryKey: salesKeys.detail(id),
    queryFn: () => apiClient.getSalesById(id) as Promise<ApiResponse<Sales>>,
    enabled: !!id,
  })
}

export function useSalesStatsQuery() {
  return useQuery({
    queryKey: salesKeys.stats(),
    queryFn: () => apiClient.getSalesStats() as Promise<ApiResponse<SalesStats[]>>,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useSalesDetailStatsQuery(id: number) {
  return useQuery({
    queryKey: salesKeys.detailStats(id),
    queryFn: async () => {
      // Direct Supabase query for sales stats by ID
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id_sales, nama_sales')
        .eq('id_sales', id)
        .single()

      if (salesError) throw new Error('Failed to fetch sales')

      // Get store count
      const { count: storeCount } = await supabase
        .from('toko')
        .select('*', { count: 'exact', head: true })
        .eq('id_sales', id)
        .eq('status_toko', true)

      // Get shipment stats
      const { data: shipments } = await supabase
        .from('pengiriman')
        .select(`
          id_pengiriman,
          toko!inner(id_sales),
          detail_pengiriman(jumlah_kirim)
        `)
        .eq('toko.id_sales', id)

      const totalShipped = shipments?.reduce((sum, s) =>
        sum + (s.detail_pengiriman?.reduce((detailSum, d: any) => detailSum + (d.jumlah_kirim || 0), 0) || 0), 0) || 0

      // Get payment stats
      const { data: payments } = await supabase
        .from('penagihan')
        .select(`
          total_uang_diterima,
          toko!inner(id_sales)
        `)
        .eq('toko.id_sales', id)

      const totalRevenue = payments?.reduce((sum, p) => sum + (p.total_uang_diterima || 0), 0) || 0

      return {
        success: true,
        data: {
          id_sales: sales.id_sales,
          nama_sales: sales.nama_sales,
          total_stores: storeCount || 0,
          total_shipped_items: totalShipped,
          total_revenue: totalRevenue
        }
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useSalesActivitiesQuery(id: number) {
  return useQuery({
    queryKey: salesKeys.activities(id),
    queryFn: async () => {
      // Combine shipments and payments as activities
      const { data: shipments } = await supabase
        .from('pengiriman')
        .select(`
          id_pengiriman,
          tanggal_kirim,
          toko!inner(id_sales, nama_toko),
          detail_pengiriman(jumlah_kirim, produk(nama_produk))
        `)
        .eq('toko.id_sales', id)
        .order('tanggal_kirim', { ascending: false })
        .limit(20)

      const { data: payments } = await supabase
        .from('penagihan')
        .select(`
          id_penagihan,
          dibuat_pada,
          total_uang_diterima,
          metode_pembayaran,
          toko!inner(id_sales, nama_toko)
        `)
        .eq('toko.id_sales', id)
        .order('dibuat_pada', { ascending: false })
        .limit(20)

      const activities = [
        ...(shipments?.map(s => ({
          type: 'shipment' as const,
          id: s.id_pengiriman,
          date: s.tanggal_kirim,
          toko: (s.toko as any)?.nama_toko,
          details: s.detail_pengiriman
        })) || []),
        ...(payments?.map(p => ({
          type: 'payment' as const,
          id: p.id_penagihan,
          date: p.dibuat_pada,
          toko: (p.toko as any)?.nama_toko,
          amount: p.total_uang_diterima,
          method: p.metode_pembayaran
        })) || [])
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return { success: true, data: activities }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

export function useSalesRecentShipmentsQuery(id: number, limit?: number) {
  return useQuery({
    queryKey: salesKeys.recentShipments(id, limit),
    queryFn: async () => {
      let query = supabase
        .from('pengiriman')
        .select(`
          id_pengiriman,
          tanggal_kirim,
          toko!inner(id_sales, nama_toko, kecamatan, kabupaten),
          detail_pengiriman(jumlah_kirim, produk(nama_produk, harga_satuan))
        `)
        .eq('toko.id_sales', id)
        .order('tanggal_kirim', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query
      if (error) throw new Error('Failed to fetch recent shipments')

      return { success: true, data: data || [] }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

export function useSalesRecentPaymentsQuery(id: number, limit?: number) {
  return useQuery({
    queryKey: salesKeys.recentPayments(id, limit),
    queryFn: async () => {
      let query = supabase
        .from('penagihan')
        .select(`
          id_penagihan,
          dibuat_pada,
          total_uang_diterima,
          metode_pembayaran,
          toko!inner(id_sales, nama_toko, kecamatan, kabupaten),
          detail_penagihan(jumlah_terjual, jumlah_kembali, produk(nama_produk))
        `)
        .eq('toko.id_sales', id)
        .order('dibuat_pada', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query
      if (error) throw new Error('Failed to fetch recent payments')

      return { success: true, data: data || [] }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

export function useSalesInventoryQuery(id: number) {
  return useQuery({
    queryKey: salesKeys.inventory(id),
    queryFn: async () => {
      // Get all stores for this sales
      const { data: stores } = await supabase
        .from('toko')
        .select('id_toko, nama_toko')
        .eq('id_sales', id)
        .eq('status_toko', true)

      if (!stores || stores.length === 0) {
        return { success: true, data: [] }
      }

      const storeIds = stores.map(s => s.id_toko)

      // Get all shipments for these stores
      const { data: shipments } = await supabase
        .from('detail_pengiriman')
        .select(`
          jumlah_kirim,
          id_produk,
          produk(nama_produk, harga_satuan),
          pengiriman!inner(id_toko)
        `)
        .in('pengiriman.id_toko', storeIds)

      // Get all billings for these stores
      const { data: billings } = await supabase
        .from('detail_penagihan')
        .select(`
          jumlah_terjual,
          jumlah_kembali,
          id_produk,
          penagihan!inner(id_toko)
        `)
        .in('penagihan.id_toko', storeIds)

      // Calculate inventory by product
      const inventoryMap = new Map<number, { nama_produk: string; shipped: number; sold: number; returned: number; stock: number }>()

      shipments?.forEach(s => {
        const existing = inventoryMap.get(s.id_produk) || { nama_produk: (s.produk as any)?.nama_produk || '', shipped: 0, sold: 0, returned: 0, stock: 0 }
        existing.shipped += s.jumlah_kirim
        inventoryMap.set(s.id_produk, existing)
      })

      billings?.forEach(b => {
        const existing = inventoryMap.get(b.id_produk) || { nama_produk: '', shipped: 0, sold: 0, returned: 0, stock: 0 }
        existing.sold += b.jumlah_terjual
        existing.returned += b.jumlah_kembali
        inventoryMap.set(b.id_produk, existing)
      })

      const inventory = Array.from(inventoryMap.entries()).map(([id_produk, data]) => ({
        id_produk,
        nama_produk: data.nama_produk,
        shipped: data.shipped,
        sold: data.sold,
        returned: data.returned,
        stock: data.shipped - data.sold + data.returned
      }))

      return { success: true, data: inventory }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useSalesProductSalesQuery(id: number) {
  return useQuery({
    queryKey: salesKeys.productSales(id),
    queryFn: async () => {
      // Get all stores for this sales
      const { data: stores } = await supabase
        .from('toko')
        .select('id_toko')
        .eq('id_sales', id)
        .eq('status_toko', true)

      if (!stores || stores.length === 0) {
        return { success: true, data: [] }
      }

      const storeIds = stores.map(s => s.id_toko)

      // Get all billings with product details
      const { data: billings } = await supabase
        .from('detail_penagihan')
        .select(`
          jumlah_terjual,
          id_produk,
          produk(nama_produk, harga_satuan),
          penagihan!inner(id_toko)
        `)
        .in('penagihan.id_toko', storeIds)

      // Aggregate by product
      const productSalesMap = new Map<number, { nama_produk: string; harga_satuan: number; total_sold: number; total_revenue: number }>()

      billings?.forEach(b => {
        const produk = b.produk as any
        const hargaSatuan = produk?.harga_satuan || 0
        const existing = productSalesMap.get(b.id_produk) || {
          nama_produk: produk?.nama_produk || '',
          harga_satuan: hargaSatuan,
          total_sold: 0,
          total_revenue: 0
        }
        existing.total_sold += b.jumlah_terjual
        existing.total_revenue += b.jumlah_terjual * hargaSatuan
        productSalesMap.set(b.id_produk, existing)
      })

      const productSales = Array.from(productSalesMap.entries()).map(([id_produk, data]) => ({
        id_produk,
        ...data
      }))

      return { success: true, data: productSales }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Mutations
export function useCreateSalesMutation() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (data: CreateSalesData) => apiClient.createSales(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesKeys.lists() })
      toast({
        title: 'Berhasil',
        description: 'Sales berhasil ditambahkan',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Gagal menambahkan sales',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateSalesMutation() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSalesData }) =>
      apiClient.updateSales(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: salesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: salesKeys.detail(id) })
      toast({
        title: 'Berhasil',
        description: 'Sales berhasil diperbarui',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Gagal memperbarui sales',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteSalesMutation() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: (id: number) => apiClient.deleteSales(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesKeys.lists() })
      toast({
        title: 'Berhasil',
        description: 'Sales berhasil dihapus',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Gagal menghapus sales',
        variant: 'destructive',
      })
    },
  })
}