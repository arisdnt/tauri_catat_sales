import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Database } from '@/types/database'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'

type PengeluaranOperasional = Database['public']['Tables']['pengeluaran_operasional']['Row']

interface PengeluaranResponse {
  data: PengeluaranOperasional[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface PengeluaranParams {
  page?: number
  limit?: number
  search?: string
  date_range?: string
}

interface PengeluaranStatsResponse {
  total_pengeluaran: number
  tanggal: string
}

interface PengeluaranStatsByRangeResponse {
  total_pengeluaran: number
  date_range: string
}

// Query key factory
export const pengeluaranKeys = {
  all: ['pengeluaran'] as const,
  lists: () => [...pengeluaranKeys.all, 'list'] as const,
  list: (params: PengeluaranParams) => [...pengeluaranKeys.lists(), params] as const,
  stats: () => [...pengeluaranKeys.all, 'stats'] as const,
  totalByDate: (date: string) => [...pengeluaranKeys.stats(), 'total-by-date', date] as const,
  totalByRange: (dateRange: string) => [...pengeluaranKeys.stats(), 'total-by-range', dateRange] as const,
}

// Fetch pengeluaran list - Direct Supabase query
export const usePengeluaranList = (params: PengeluaranParams = {}) => {
  return useQuery({
    queryKey: pengeluaranKeys.list(params),
    queryFn: async (): Promise<PengeluaranResponse> => {
      const page = params.page || 1
      const limit = params.limit || 50
      const offset = (page - 1) * limit

      let query = supabase
        .from('pengeluaran_operasional')
        .select('*', { count: 'exact' })

      if (params.search) {
        query = query.ilike('keterangan', `%${params.search}%`)
      }

      query = query
        .order('tanggal_pengeluaran', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw new Error(error.message)

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Create pengeluaran mutation - Direct Supabase insert
export const useCreatePengeluaran = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FormData) => {
      // Parse FormData - using correct column names
      const keterangan = data.get('keterangan') as string || data.get('kategori') as string || data.get('deskripsi') as string
      const jumlah = parseFloat(data.get('jumlah') as string)
      const tanggal_pengeluaran = data.get('tanggal_pengeluaran') as string || data.get('tanggal') as string
      const buktiFile = data.get('bukti') as File | null

      let url_bukti_foto = null

      // Handle file upload if provided
      if (buktiFile && buktiFile.size > 0) {
        const fileExt = buktiFile.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `pengeluaran/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('bukti-pengeluaran')
          .upload(filePath, buktiFile)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          // Continue without bukti if upload fails
        } else {
          const { data: urlData } = supabase.storage
            .from('bukti-pengeluaran')
            .getPublicUrl(filePath)
          url_bukti_foto = urlData.publicUrl
        }
      }

      const { data: result, error } = await supabase
        .from('pengeluaran_operasional')
        .insert([{
          keterangan,
          jumlah,
          tanggal_pengeluaran: tanggal_pengeluaran || new Date().toISOString().split('T')[0],
          url_bukti_foto
        }])
        .select()
        .single()

      if (error) throw new Error(error.message)

      return { success: true, data: result }
    },
    onSuccess: () => {
      // Invalidate and refetch pengeluaran queries
      queryClient.invalidateQueries({ queryKey: pengeluaranKeys.lists() })
    },
  })
}

// Delete pengeluaran mutation - Direct Supabase delete
export const useDeletePengeluaran = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      // Get the record first to check for bukti file
      const { data: existing } = await supabase
        .from('pengeluaran_operasional')
        .select('url_bukti_foto')
        .eq('id_pengeluaran', id)
        .single()

      // Delete the file from storage if exists
      if (existing?.url_bukti_foto) {
        try {
          // Extract file path from URL
          const url = new URL(existing.url_bukti_foto)
          const pathParts = url.pathname.split('/')
          const filePath = pathParts.slice(pathParts.indexOf('pengeluaran')).join('/')

          await supabase.storage
            .from('bukti-pengeluaran')
            .remove([filePath])
        } catch (e) {
          console.error('Failed to delete file:', e)
        }
      }

      const { error } = await supabase
        .from('pengeluaran_operasional')
        .delete()
        .eq('id_pengeluaran', id)

      if (error) throw new Error(error.message)

      return { success: true }
    },
    onSuccess: () => {
      // Invalidate and refetch pengeluaran queries
      queryClient.invalidateQueries({ queryKey: pengeluaranKeys.lists() })
    },
  })
}

// Get total pengeluaran by date - Direct Supabase query
export const usePengeluaranTotalByDate = (date: string) => {
  return useQuery({
    queryKey: pengeluaranKeys.totalByDate(date),
    queryFn: async (): Promise<PengeluaranStatsResponse> => {
      const { data, error } = await supabase
        .from('pengeluaran_operasional')
        .select('jumlah')
        .gte('tanggal_pengeluaran', `${date}`)
        .lte('tanggal_pengeluaran', `${date}`)

      if (error) throw new Error(error.message)

      const totalPengeluaran = data?.reduce((sum, item) => sum + Number(item.jumlah), 0) || 0

      return {
        total_pengeluaran: totalPengeluaran,
        tanggal: date
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!date, // Only run query if date is provided
  })
}

// Get total pengeluaran by date range - Direct Supabase query
export const usePengeluaranTotalByRange = (dateRange: string = 'today') => {
  return useQuery({
    queryKey: pengeluaranKeys.totalByRange(dateRange),
    queryFn: async (): Promise<PengeluaranStatsByRangeResponse> => {
      const response = await apiClient.getDashboardPengeluaranStats({ date_range: dateRange }) as { data: PengeluaranStatsByRangeResponse } | PengeluaranStatsByRangeResponse
      return (response as any).data || response
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!dateRange, // Only run query if dateRange is provided
  })
}

// Helper function to format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Helper function to format date
export const formatDate = (dateString: string): string => {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

// Helper function to format date for input
export const formatDateForInput = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
}