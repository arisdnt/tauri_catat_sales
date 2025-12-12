/**
 * Data Access Layer
 *
 * Semua operasi membaca/menulis data sebaiknya mengikuti jalur:
 *   Supabase -> Realtime -> Dexie -> UI
 *
 * Untuk CRUD, frontend tidak langsung menulis ke Supabase,
 * tetapi menulis ke Dexie Outbox terlebih dahulu:
 *   Frontend -> Dexie Outbox -> Supabase (via worker) -> Realtime -> Dexie
 *
 * Catatan: Auth tetap menggunakan Supabase langsung.
 */

import { supabase } from './supabase'
import { db } from './db/dexie'
import { queueOutboxEntry } from './db/outbox'
import {
  optimisticInsertSales,
  optimisticUpdateSales,
  optimisticDeleteSales,
  optimisticInsertProduk,
  optimisticUpdateProduk,
  optimisticDeleteProduk,
  optimisticInsertToko,
  optimisticUpdateToko,
  optimisticDeleteToko,
  optimisticInsertSetoran,
  optimisticUpdateSetoran,
  optimisticDeleteSetoran,
  optimisticInsertShipment,
  optimisticUpdateShipment,
  optimisticDeleteShipment,
  optimisticInsertBilling,
  optimisticUpdateBilling,
  optimisticDeleteBilling,
  isTempId
} from './db/optimistic'
import {
  invalidateSalesQueries,
  invalidateProdukQueries,
  invalidateTokoQueries,
  invalidateSetoranQueries,
  invalidatePengirimanQueries,
  invalidatePenagihanQueries
} from './react-query'

// Helper to create success response format
function createResponse<T>(data: T, statusCode = 200) {
  return { success: true, data, statusCode }
}

// Helper to throw error with consistent format
function throwError(message: string): never {
  throw new Error(message)
}

class ApiClient {
  // ============================================================
  // SALES API
  // ============================================================

  async getSales() {
    // Baca dari Dexie (mirror sales table)
    const all = await db.sales.toArray()
    const active = all.filter(s => s.status_aktif)

    // Remove duplicates based on nama_sales
    const uniqueData = active.filter((sales, index, self) =>
      index === self.findIndex(s => s.nama_sales === sales.nama_sales)
    )

    uniqueData.sort((a, b) => a.nama_sales.localeCompare(b.nama_sales))

    return createResponse(uniqueData)
  }

  async getSalesById(id: number) {
    const row = await db.sales.get(id)
    if (!row) throwError('Sales not found')
    return createResponse(row)
  }

  async createSales(data: { nama_sales: string; nomor_telepon?: string }) {
    if (!data.nama_sales) throwError('Nama sales is required')

    // Optimistic update: langsung insert ke Dexie untuk UI instant
    const optimisticRecord = await optimisticInsertSales({
      nama_sales: data.nama_sales,
      nomor_telepon: data.nomor_telepon || null
    })

    // Queue insert to outbox untuk sync ke Supabase
    await queueOutboxEntry('sales', 'insert', {
      nama_sales: data.nama_sales,
      nomor_telepon: data.nomor_telepon || null,
      status_aktif: true
    }, { localTempId: optimisticRecord._tempId })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateSalesQueries()

    return createResponse(optimisticRecord, 202)
  }

  async updateSales(id: number, data: { nama_sales: string; nomor_telepon?: string; status_aktif?: boolean }) {
    // Optimistic update: langsung update Dexie
    await optimisticUpdateSales(id, {
      nama_sales: data.nama_sales,
      nomor_telepon: data.nomor_telepon,
      status_aktif: data.status_aktif
    })

    // Queue update to outbox
    await queueOutboxEntry('sales', 'update', {
      id_sales: id,
      nama_sales: data.nama_sales,
      nomor_telepon: data.nomor_telepon,
      status_aktif: data.status_aktif
    }, { primaryKeyField: 'id_sales' })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateSalesQueries()

    return createResponse({
      id_sales: id,
      ...data
    })
  }

  async deleteSales(id: number) {
    // Optimistic delete: langsung soft delete di Dexie
    await optimisticDeleteSales(id)

    // Queue delete to outbox (as update with status_aktif = false)
    await queueOutboxEntry('sales', 'update', {
      id_sales: id,
      status_aktif: false
    }, { primaryKeyField: 'id_sales' })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateSalesQueries()

    return createResponse({ message: 'Sales deactivated successfully' })
  }

  // ============================================================
  // PRODUCTS API
  // ============================================================

  async getProducts(status?: 'active') {
    let data = await db.produk.toArray()

    if (status === 'active') {
      data = data.filter(p => p.status_produk)
    }

    data.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk))
    return createResponse(data)
  }

  async getProductById(id: number) {
    const row = await db.produk.get(id)
    if (!row) throwError('Produk not found')
    return createResponse(row)
  }

  async getProductStats() {
    const data = await db.v_master_produk.toArray()
    return createResponse(data)
  }

  async getSalesStats() {
    const data = await db.v_master_sales.toArray()
    return createResponse(data)
  }

  async createProduct(data: { nama_produk: string; harga_satuan: number; is_priority?: boolean; priority_order?: number }) {
    if (!data.nama_produk || data.nama_produk.trim() === '') {
      throwError('Nama produk harus diisi')
    }
    if (!data.harga_satuan || data.harga_satuan <= 0) {
      throwError('Harga satuan harus berupa angka positif')
    }

    // Optimistic update: langsung insert ke Dexie
    const optimisticRecord = await optimisticInsertProduk({
      nama_produk: data.nama_produk.trim(),
      harga_satuan: data.harga_satuan,
      is_priority: data.is_priority,
      priority_order: data.priority_order
    })

    const payload = {
      nama_produk: data.nama_produk.trim(),
      harga_satuan: data.harga_satuan,
      status_produk: true,
      is_priority: Boolean(data.is_priority),
      priority_order: Number(data.priority_order) || 0
    }

    // Queue insert to outbox
    await queueOutboxEntry('produk', 'insert', payload, { localTempId: optimisticRecord._tempId })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateProdukQueries()

    return createResponse(optimisticRecord, 202)
  }

  async updateProduct(id: number, data: {
    nama_produk?: string
    harga_satuan?: number
    status_produk?: boolean
    is_priority?: boolean
    priority_order?: number
  }) {
    // Optimistic update: langsung update Dexie
    await optimisticUpdateProduk(id, data)

    const payload: Record<string, any> = { id_produk: id }

    if (data.nama_produk !== undefined) payload.nama_produk = data.nama_produk
    if (data.harga_satuan !== undefined) payload.harga_satuan = data.harga_satuan
    if (data.status_produk !== undefined) payload.status_produk = data.status_produk
    if (data.is_priority !== undefined) payload.is_priority = data.is_priority
    if (data.priority_order !== undefined) payload.priority_order = data.priority_order

    // Queue update to outbox
    await queueOutboxEntry('produk', 'update', payload, { primaryKeyField: 'id_produk' })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateProdukQueries()

    return createResponse({
      id_produk: id,
      ...payload
    })
  }

  async deleteProduct(id: number) {
    // Optimistic delete: langsung soft delete di Dexie
    await optimisticDeleteProduk(id)

    // Queue delete to outbox
    await queueOutboxEntry('produk', 'update', {
      id_produk: id,
      status_produk: false
    }, { primaryKeyField: 'id_produk' })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateProdukQueries()

    return createResponse({ message: 'Product deactivated successfully' })
  }

  // ============================================================
  // STORES API
  // ============================================================

  async getStores(
    status?: 'active',
    includeSales?: boolean,
    page?: number,
    limit?: number,
    search?: string,
    filters?: Record<string, string>
  ) {
    const pageNum = page || 1
    const limitNum = limit || 50
    const offset = (pageNum - 1) * limitNum

    let rows = await db.toko.toArray()

    if (status === 'active') {
      rows = rows.filter(t => t.status_toko === true || (t.status_toko as any) === 1)
    }
    if (search) {
      const s = search.toLowerCase()
      rows = rows.filter(t =>
        (t.nama_toko || '').toLowerCase().includes(s) ||
        (t.kecamatan || '').toLowerCase().includes(s) ||
        (t.kabupaten || '').toLowerCase().includes(s)
      )
    }
    if (filters?.sales_id) {
      rows = rows.filter(t => String(t.id_sales) === String(filters.sales_id))
    }
    if (filters?.kabupaten) {
      rows = rows.filter(t => (t.kabupaten || '') === filters.kabupaten)
    }
    if (filters?.kecamatan) {
      rows = rows.filter(t => (t.kecamatan || '') === filters.kecamatan)
    }

    // Join sales info if requested
    let dataWithSales: any[] = rows
    if (includeSales) {
      const salesRows = await db.sales.toArray()
      const salesMap = new Map(salesRows.map(s => [s.id_sales, s]))
      dataWithSales = rows.map(t => {
        const sales = salesMap.get(t.id_sales)
        return {
          ...t,
          sales: sales ? {
            id_sales: sales.id_sales,
            nama_sales: sales.nama_sales,
            nomor_telepon: sales.nomor_telepon,
            status_aktif: sales.status_aktif
          } : undefined
        }
      })
    }

    dataWithSales.sort((a, b) => (a.nama_toko || '').localeCompare(b.nama_toko || ''))

    const totalCount = dataWithSales.length
    const totalPages = Math.ceil(totalCount / limitNum)
    const pageRows = dataWithSales.slice(offset, offset + limitNum)

    return createResponse({
      data: pageRows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    })
  }

  async get(url: string) {
    // This is a generic method - parse the URL and route appropriately
    // For now, just return empty since specific methods should be used
    console.warn('Generic get() called, use specific methods instead:', url)
    return createResponse(null)
  }

  async getStoreById(id: number) {
    const toko = await db.toko.get(id)
    if (!toko) {
      throwError('Store not found')
    }

    const sales = await db.sales.get(toko.id_sales)

    const result: any = {
      ...toko,
      sales: sales
        ? {
          id_sales: sales.id_sales,
          nama_sales: sales.nama_sales,
          nomor_telepon: sales.nomor_telepon,
          status_aktif: sales.status_aktif
        }
        : undefined
    }

    return createResponse(result)
  }

  async createStore(data: {
    nama_toko: string
    id_sales: number
    alamat?: string
    desa?: string
    kecamatan?: string
    kabupaten?: string
    no_telepon?: string
    link_gmaps?: string
  }) {
    if (!data.nama_toko || !data.id_sales) {
      throwError('Nama toko and id_sales are required')
    }

    // Optimistic update: langsung insert ke Dexie
    const optimisticRecord = await optimisticInsertToko({
      id_sales: data.id_sales,
      nama_toko: data.nama_toko,
      kecamatan: data.kecamatan || null,
      kabupaten: data.kabupaten || null,
      no_telepon: data.no_telepon || null,
      link_gmaps: data.link_gmaps || null
    })

    const payload = {
      nama_toko: data.nama_toko,
      id_sales: data.id_sales,
      kecamatan: data.kecamatan || null,
      kabupaten: data.kabupaten || null,
      no_telepon: data.no_telepon || null,
      link_gmaps: data.link_gmaps || null,
      status_toko: true
    }

    // Queue insert to outbox
    await queueOutboxEntry('toko', 'insert', payload, { localTempId: optimisticRecord._tempId })

    const sales = await db.sales.get(data.id_sales)

    const result: any = {
      ...optimisticRecord,
      sales: sales
        ? {
          id_sales: sales.id_sales,
          nama_sales: sales.nama_sales,
          nomor_telepon: sales.nomor_telepon,
          status_aktif: sales.status_aktif
        }
        : undefined
    }

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateTokoQueries()

    return createResponse(result, 202)
  }

  async updateStore(id: number, data: {
    nama_toko: string
    id_sales: number
    alamat?: string
    desa?: string
    kecamatan?: string
    kabupaten?: string
    no_telepon?: string
    link_gmaps?: string
    status_toko?: boolean
  }) {
    // Optimistic update: langsung update Dexie
    await optimisticUpdateToko(id, {
      id_sales: data.id_sales,
      nama_toko: data.nama_toko,
      kecamatan: data.kecamatan ?? null,
      kabupaten: data.kabupaten ?? null,
      no_telepon: data.no_telepon ?? null,
      link_gmaps: data.link_gmaps ?? null,
      status_toko: data.status_toko
    })

    const payload = {
      id_toko: id,
      nama_toko: data.nama_toko,
      id_sales: data.id_sales,
      kecamatan: data.kecamatan ?? null,
      kabupaten: data.kabupaten ?? null,
      no_telepon: data.no_telepon ?? null,
      link_gmaps: data.link_gmaps ?? null,
      status_toko: data.status_toko
    }

    // Queue update to outbox
    await queueOutboxEntry('toko', 'update', payload, {
      primaryKeyField: 'id_toko'
    })

    const sales = await db.sales.get(data.id_sales)

    const result: any = {
      ...payload,
      sales: sales
        ? {
          id_sales: sales.id_sales,
          nama_sales: sales.nama_sales,
          nomor_telepon: sales.nomor_telepon,
          status_aktif: sales.status_aktif
        }
        : undefined
    }

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateTokoQueries()

    return createResponse(result)
  }

  async deleteStore(id: number) {
    // Optimistic delete: langsung soft delete di Dexie
    await optimisticDeleteToko(id)

    // Queue delete to outbox
    await queueOutboxEntry(
      'toko',
      'update',
      {
        id_toko: id,
        status_toko: false
      },
      { primaryKeyField: 'id_toko' }
    )

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateTokoQueries()

    return createResponse({ message: 'Store deactivated successfully' })
  }

  async importStores(data: any[]) {
    const { data: result, error } = await supabase
      .from('toko')
      .insert(data)
      .select()

    if (error) throwError(error.message)
    return createResponse(result, 201)
  }

  // ============================================================
  // SHIPMENTS API
  // ============================================================

  async getShipments(includeDetails?: boolean, page?: number, limit?: number) {
    const pageNum = page || 1
    const limitNum = limit || 50
    const offset = (pageNum - 1) * limitNum

    const [pengirimanData, tokoData, detailData, produkData] = await Promise.all([
      db.pengiriman.toArray(),
      db.toko.toArray(),
      db.detail_pengiriman.toArray(),
      db.produk.toArray()
    ])

    const tokoMap = new Map(tokoData.map(t => [t.id_toko, t]))
    const produkMap = new Map(produkData.map(p => [p.id_produk, p]))

    let rows = pengirimanData.map(p => {
      const toko = tokoMap.get(p.id_toko)

      const tokoNested = toko ? {
        id_toko: toko.id_toko,
        nama_toko: toko.nama_toko,
        kecamatan: toko.kecamatan || '',
        kabupaten: toko.kabupaten || ''
      } : undefined

      let detail_pengiriman: any[] | undefined
      if (includeDetails) {
        const detailsForShipment = detailData.filter(d => d.id_pengiriman === p.id_pengiriman)
        detail_pengiriman = detailsForShipment.map(d => {
          const produk = produkMap.get(d.id_produk)
          return {
            id_detail_kirim: d.id_detail_kirim,
            jumlah_kirim: d.jumlah_kirim,
            produk: produk ? {
              id_produk: produk.id_produk,
              nama_produk: produk.nama_produk,
              harga_satuan: produk.harga_satuan
            } : null
          }
        })
      }

      return {
        ...p,
        toko: tokoNested,
        detail_pengiriman
      }
    })

    // Sort by tanggal_kirim desc
    rows.sort((a, b) => new Date(b.tanggal_kirim).getTime() - new Date(a.tanggal_kirim).getTime())

    const total = rows.length
    const totalPages = Math.ceil(total / limitNum)
    const pageRows = rows.slice(offset, offset + limitNum)

    return createResponse({
      data: pageRows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total
      }
    })
  }

  async getShipmentById(id: number) {
    let pengiriman = await db.pengiriman.get(id)
    if (!pengiriman) {
      await this.hydrateShipmentFromSupabase(id)
      pengiriman = await db.pengiriman.get(id)
    }

    if (!pengiriman) {
      throwError('Pengiriman not found')
    }

    const [tokoData, detailData, produkData] = await Promise.all([
      db.toko.toArray(),
      db.detail_pengiriman.where('id_pengiriman').equals(id).toArray(),
      db.produk.toArray()
    ])

    const tokoMap = new Map(tokoData.map(t => [t.id_toko, t]))
    const produkMap = new Map(produkData.map(p => [p.id_produk, p]))

    const toko = tokoMap.get(pengiriman.id_toko)

    const tokoNested = toko ? {
      id_toko: toko.id_toko,
      nama_toko: toko.nama_toko,
      kecamatan: toko.kecamatan || '',
      kabupaten: toko.kabupaten || ''
    } : undefined

    const detail_pengiriman = detailData.map(d => {
      const produk = produkMap.get(d.id_produk)
      return {
        id_detail_kirim: d.id_detail_kirim,
        id_produk: d.id_produk,
        jumlah_kirim: d.jumlah_kirim,
        produk: produk ? {
          id_produk: produk.id_produk,
          nama_produk: produk.nama_produk,
          harga_satuan: produk.harga_satuan
        } : null
      }
    })

    const result = {
      ...pengiriman,
      toko: tokoNested,
      detail_pengiriman
    }

    return createResponse(result)
  }

  async createShipment(data: {
    id_toko: number
    tanggal_kirim: string
    details: Array<{
      id_produk: number
      jumlah_kirim: number
    }>
  }) {
    // Optimistic update: langsung insert ke Dexie
    const optimisticResult = await optimisticInsertShipment({
      id_toko: data.id_toko,
      tanggal_kirim: data.tanggal_kirim,
      details: data.details
    })

    // Queue shipment create to outbox
    await queueOutboxEntry('pengiriman', 'shipment_create', data, { localTempId: optimisticResult.pengiriman._tempId })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidatePengirimanQueries()

    return createResponse({
      ...optimisticResult.pengiriman,
      details: data.details
    }, 202)
  }

  async updateShipment(id: number, data: {
    tanggal_kirim: string
    details: Array<{
      id_produk: number
      jumlah_kirim: number
    }>
  }) {
    // Optimistic update: langsung update Dexie
    await optimisticUpdateShipment(id, {
      tanggal_kirim: data.tanggal_kirim,
      details: data.details
    })

    // Queue update to outbox
    await queueOutboxEntry('pengiriman', 'shipment_update', {
      id_pengiriman: id,
      ...data
    })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidatePengirimanQueries()

    return createResponse({
      id_pengiriman: id,
      ...data
    })
  }

  async deleteShipment(id: number) {
    // Optimistic delete: langsung hapus di Dexie
    await optimisticDeleteShipment(id)

    // Queue delete to outbox
    await queueOutboxEntry('pengiriman', 'shipment_delete', { id_pengiriman: id })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidatePengirimanQueries()

    return createResponse({ message: 'Shipment deleted successfully' })
  }

  async createBatchShipment(data: {
    id_sales: number
    tanggal_kirim: string
    stores: Array<{
      id_toko: number
      details: Array<{
        id_produk: number
        jumlah_kirim: number
      }>
    }>
    keterangan?: string
  }) {
    // Queue one shipment_create per store
    for (const store of data.stores) {
      await queueOutboxEntry('pengiriman', 'shipment_create', {
        id_toko: store.id_toko,
        tanggal_kirim: data.tanggal_kirim,
        details: store.details
      })
    }

    return createResponse({
      id_sales: data.id_sales,
      tanggal_kirim: data.tanggal_kirim,
      stores: data.stores.length
    }, 202)
  }

  async getBatchShipments(id_sales?: number, tanggal_kirim?: string, limit?: number) {
    const [pengirimanData, tokoData, detailData, produkData] = await Promise.all([
      db.pengiriman.toArray(),
      db.toko.toArray(),
      db.detail_pengiriman.toArray(),
      db.produk.toArray()
    ])

    const tokoMap = new Map(tokoData.map(t => [t.id_toko, t]))
    const produkMap = new Map(produkData.map(p => [p.id_produk, p]))

    let rows = pengirimanData.map(p => {
      const toko = tokoMap.get(p.id_toko)
      const detailForShipment = detailData.filter(d => d.id_pengiriman === p.id_pengiriman)

      const detailWithProduk = detailForShipment.map(d => {
        const produk = produkMap.get(d.id_produk)
        return {
          id_produk: d.id_produk,
          jumlah_kirim: d.jumlah_kirim,
          produk: produk ? { nama_produk: produk.nama_produk } : null
        }
      })

      return {
        ...p,
        toko: toko ? { id_toko: toko.id_toko, nama_toko: toko.nama_toko, id_sales: toko.id_sales } : null,
        detail_pengiriman: detailWithProduk
      }
    })

    if (id_sales) {
      rows = rows.filter(r => r.toko && r.toko.id_sales === id_sales)
    }
    if (tanggal_kirim) {
      rows = rows.filter(r => r.tanggal_kirim === tanggal_kirim)
    }

    rows.sort((a, b) => new Date(b.tanggal_kirim).getTime() - new Date(a.tanggal_kirim).getTime())

    if (limit && rows.length > limit) {
      rows = rows.slice(0, limit)
    }

    return createResponse(rows)
  }

  // ============================================================
  // PRIORITY PRODUCTS API
  // ============================================================

  async getPriorityProducts() {
    let rows = await db.produk.toArray()
    rows = rows.filter(p => p.status_produk && p.is_priority === true)
    rows.sort((a, b) => (a.priority_order ?? 0) - (b.priority_order ?? 0))
    return createResponse(rows)
  }

  async updateProductPriority(id_produk: number, data: {
    is_priority: boolean
    priority_order?: number
  }) {
    const payload = {
      id_produk,
      is_priority: data.is_priority,
      priority_order: data.priority_order ?? 0
    }

    await queueOutboxEntry('produk', 'update', payload, {
      primaryKeyField: 'id_produk'
    })

    return createResponse(payload)
  }

  async getNonPriorityProducts() {
    let rows = await db.produk.toArray()
    rows = rows.filter(p => p.status_produk && !p.is_priority)
    rows.sort((a, b) => (a.nama_produk || '').localeCompare(b.nama_produk || ''))
    return createResponse(rows)
  }

  // ============================================================
  // STORES BY SALES API
  // ============================================================

  async getStoresBySales(id_sales: number) {
    let rows = await db.toko.where('id_sales').equals(id_sales).toArray()
    rows = rows.filter(t => t.status_toko === true || (t.status_toko as any) === 1)
    rows.sort((a, b) => (a.nama_toko || '').localeCompare(b.nama_toko || ''))
    return createResponse(rows)
  }

  // ============================================================
  // BILLING (PENAGIHAN) API
  // ============================================================

  private async hydrateBillingFromSupabase(id: number) {
    try {
      const { data: billing, error } = await supabase
        .from('penagihan')
        .select('*')
        .eq('id_penagihan', id)
        .maybeSingle()

      if (error || !billing) {
        console.warn('[ApiClient] Penagihan not found in Supabase:', id, error)
        return null
      }

      await db.penagihan.put(billing)

      const [{ data: detailRows, error: detailError }, { data: potonganRows, error: potonganError }] = await Promise.all([
        supabase.from('detail_penagihan').select('*').eq('id_penagihan', id),
        supabase.from('potongan_penagihan').select('*').eq('id_penagihan', id)
      ])

      if (!detailError && detailRows && detailRows.length > 0) {
        await db.detail_penagihan.bulkPut(detailRows)
      }
      if (!potonganError && potonganRows && potonganRows.length > 0) {
        await db.potongan_penagihan.bulkPut(potonganRows)
      }

      if (billing.id_toko) {
        let tokoRow = await db.toko.get(billing.id_toko)
        if (!tokoRow) {
          const { data: tokoFromSupabase } = await supabase
            .from('toko')
            .select('*')
            .eq('id_toko', billing.id_toko)
            .maybeSingle()
          if (tokoFromSupabase) {
            await db.toko.put(tokoFromSupabase)
            tokoRow = tokoFromSupabase
          }
        }

        if (tokoRow?.id_sales) {
          const salesRow = await db.sales.get(tokoRow.id_sales)
          if (!salesRow) {
            const { data: salesFromSupabase } = await supabase
              .from('sales')
              .select('*')
              .eq('id_sales', tokoRow.id_sales)
              .maybeSingle()
            if (salesFromSupabase) {
              await db.sales.put(salesFromSupabase)
            }
          }
        }
      }

      return billing
    } catch (error) {
      console.error('[ApiClient] Failed to hydrate billing from Supabase:', id, error)
      return null
    }
  }

  private async hydrateShipmentFromSupabase(id: number) {
    try {
      const { data: shipment, error } = await supabase
        .from('pengiriman')
        .select('*')
        .eq('id_pengiriman', id)
        .maybeSingle()

      if (error || !shipment) {
        console.warn('[ApiClient] Pengiriman not found in Supabase:', id, error)
        return null
      }

      await db.pengiriman.put(shipment)

      const { data: detailRows, error: detailError } = await supabase
        .from('detail_pengiriman')
        .select('*')
        .eq('id_pengiriman', id)

      if (!detailError && detailRows && detailRows.length > 0) {
        await db.detail_pengiriman.bulkPut(detailRows)

        const missingProductIds = new Set<number>()
        for (const row of detailRows) {
          if (!(await db.produk.get(row.id_produk))) {
            missingProductIds.add(row.id_produk)
          }
        }
        if (missingProductIds.size > 0) {
          const { data: productRows } = await supabase
            .from('produk')
            .select('*')
            .in('id_produk', Array.from(missingProductIds))
          if (productRows && productRows.length > 0) {
            await db.produk.bulkPut(productRows)
          }
        }
      }

      if (shipment.id_toko) {
        let tokoRow = await db.toko.get(shipment.id_toko)
        if (!tokoRow) {
          const { data: tokoFromSupabase } = await supabase
            .from('toko')
            .select('*')
            .eq('id_toko', shipment.id_toko)
            .maybeSingle()
          if (tokoFromSupabase) {
            await db.toko.put(tokoFromSupabase)
            tokoRow = tokoFromSupabase
          }
        }

        if (tokoRow?.id_sales) {
          const salesRow = await db.sales.get(tokoRow.id_sales)
          if (!salesRow) {
            const { data: salesFromSupabase } = await supabase
              .from('sales')
              .select('*')
              .eq('id_sales', tokoRow.id_sales)
              .maybeSingle()
            if (salesFromSupabase) {
              await db.sales.put(salesFromSupabase)
            }
          }
        }
      }

      return shipment
    } catch (error) {
      console.error('[ApiClient] Failed to hydrate pengiriman from Supabase:', id, error)
      return null
    }
  }

  async getBillings(includeDetails?: boolean) {
    const [
      penagihanData,
      tokoData,
      salesData,
      detailData,
      produkData,
      potonganData
    ] = await Promise.all([
      db.penagihan.toArray(),
      db.toko.toArray(),
      db.sales.toArray(),
      db.detail_penagihan.toArray(),
      db.produk.toArray(),
      db.potongan_penagihan.toArray()
    ])

    const tokoMap = new Map(tokoData.map(t => [t.id_toko, t]))
    const salesMap = new Map(salesData.map(s => [s.id_sales, s]))
    const produkMap = new Map(produkData.map(p => [p.id_produk, p]))

    const detailByPenagihan = new Map<number, any[]>()
    if (includeDetails) {
      for (const d of detailData) {
        const list = detailByPenagihan.get(d.id_penagihan) || []
        const produk = produkMap.get(d.id_produk)
        list.push({
          id_detail_tagih: d.id_detail_tagih,
          id_produk: d.id_produk,
          jumlah_terjual: d.jumlah_terjual,
          jumlah_kembali: d.jumlah_kembali,
          produk: produk ? {
            id_produk: produk.id_produk,
            nama_produk: produk.nama_produk,
            harga_satuan: produk.harga_satuan
          } : null
        })
        detailByPenagihan.set(d.id_penagihan, list)
      }
    }

    const potonganByPenagihan = new Map<number, any[]>()
    for (const p of potonganData) {
      const list = potonganByPenagihan.get(p.id_penagihan) || []
      list.push({
        id_potongan: p.id_potongan,
        jumlah_potongan: p.jumlah_potongan,
        alasan: p.alasan ?? undefined
      })
      potonganByPenagihan.set(p.id_penagihan, list)
    }

    let rows = penagihanData.map(p => {
      const toko = tokoMap.get(p.id_toko)
      const sales = toko ? salesMap.get(toko.id_sales) : undefined

      const tokoNested = toko ? {
        id_toko: toko.id_toko,
        nama_toko: toko.nama_toko,
        kecamatan: toko.kecamatan || '',
        kabupaten: toko.kabupaten || '',
        link_gmaps: toko.link_gmaps || undefined,
        sales: sales ? {
          id_sales: sales.id_sales,
          nama_sales: sales.nama_sales,
          nomor_telepon: sales.nomor_telepon || undefined
        } : undefined
      } : undefined

      const detail_penagihan = includeDetails
        ? (detailByPenagihan.get(p.id_penagihan) || [])
        : undefined

      const potongan_penagihan = potonganByPenagihan.get(p.id_penagihan) || []

      return {
        ...p,
        toko: tokoNested,
        detail_penagihan,
        potongan_penagihan
      }
    })

    // Sort by dibuat_pada desc untuk konsistensi
    rows.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime())

    return createResponse(rows)
  }

  async getBillingById(id: number) {
    let penagihan = await db.penagihan.get(id)
    if (!penagihan) {
      penagihan = await this.hydrateBillingFromSupabase(id)
    }

    if (!penagihan) {
      throwError('Penagihan not found')
    }

    const [tokoData, salesData, detailData, produkData, potonganData] = await Promise.all([
      db.toko.toArray(),
      db.sales.toArray(),
      db.detail_penagihan.where('id_penagihan').equals(id).toArray(),
      db.produk.toArray(),
      db.potongan_penagihan.where('id_penagihan').equals(id).toArray()
    ])

    const tokoMap = new Map(tokoData.map(t => [t.id_toko, t]))
    const salesMap = new Map(salesData.map(s => [s.id_sales, s]))
    const produkMap = new Map(produkData.map(p => [p.id_produk, p]))

    const toko = tokoMap.get(penagihan.id_toko)
    const sales = toko ? salesMap.get(toko.id_sales) : undefined

    const tokoNested = toko ? {
      id_toko: toko.id_toko,
      nama_toko: toko.nama_toko,
      kecamatan: toko.kecamatan || '',
      kabupaten: toko.kabupaten || '',
      link_gmaps: toko.link_gmaps || undefined,
      sales: sales ? {
        id_sales: sales.id_sales,
        nama_sales: sales.nama_sales,
        nomor_telepon: sales.nomor_telepon || undefined
      } : undefined
    } : undefined

    const detail_penagihan = detailData.map(d => {
      const produk = produkMap.get(d.id_produk)
      return {
        id_detail_tagih: d.id_detail_tagih,
        id_produk: d.id_produk,
        jumlah_terjual: d.jumlah_terjual,
        jumlah_kembali: d.jumlah_kembali,
        produk: produk ? {
          id_produk: produk.id_produk,
          nama_produk: produk.nama_produk,
          harga_satuan: produk.harga_satuan
        } : null
      }
    })

    const potongan_penagihan = potonganData.map(p => ({
      id_potongan: p.id_potongan,
      jumlah_potongan: p.jumlah_potongan,
      alasan: p.alasan || undefined
    }))

    const result = {
      ...penagihan,
      toko: tokoNested,
      detail_penagihan,
      potongan_penagihan
    }

    return createResponse(result)
  }

  async createBilling(data: {
    id_toko: number
    total_uang_diterima: number
    metode_pembayaran: 'Cash' | 'Transfer'
    details: Array<{
      id_produk: number
      jumlah_terjual: number
      jumlah_kembali: number
    }>
    potongan?: {
      jumlah_potongan: number
      alasan?: string
    }
    auto_restock?: boolean
    additional_shipment?: {
      enabled: boolean
      details: Array<{
        id_produk: number
        jumlah_kirim: number
      }>
    }
  }) {
    // Optimistic update: langsung insert ke Dexie
    const optimisticResult = await optimisticInsertBilling({
      id_toko: data.id_toko,
      total_uang_diterima: data.total_uang_diterima,
      metode_pembayaran: data.metode_pembayaran,
      ada_potongan: !!(data.potongan && data.potongan.jumlah_potongan > 0),
      details: data.details,
      potongan: data.potongan
    })

    // Queue bundled billing operation ke outbox.
    // Worker Outbox akan menjalankan seluruh proses di Supabase.
    await queueOutboxEntry('penagihan', 'billing_create', data, { localTempId: optimisticResult.penagihan._tempId })

    // Hitung flag untuk feedback UI (tidak menunggu Supabase).
    const hasReturnedItems = data.details.some(d => d.jumlah_kembali > 0)
    const hasAdditionalShipment = !!(data.additional_shipment?.enabled && data.additional_shipment.details.length > 0)

    // Invalidate queries to trigger re-fetch from Dexie
    invalidatePenagihanQueries()

    return createResponse({
      ...optimisticResult.penagihan,
      auto_restock_shipment: data.auto_restock && hasReturnedItems,
      additional_shipment: hasAdditionalShipment
    }, 202)
  }

  async updateBilling(id: number, data: {
    total_uang_diterima: number
    metode_pembayaran: 'Cash' | 'Transfer'
    details: Array<{
      id_produk: number
      jumlah_terjual: number
      jumlah_kembali: number
    }>
    potongan?: {
      jumlah_potongan: number
      alasan?: string
    }
  }) {
    // Optimistic update: langsung update Dexie
    await optimisticUpdateBilling(id, {
      total_uang_diterima: data.total_uang_diterima,
      metode_pembayaran: data.metode_pembayaran,
      details: data.details,
      potongan: data.potongan
    })

    // Queue update to outbox
    await queueOutboxEntry('penagihan', 'billing_update', {
      id_penagihan: id,
      ...data
    })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidatePenagihanQueries()

    return createResponse({
      id_penagihan: id,
      ...data
    })
  }

  async deleteBilling(id: number) {
    // Optimistic delete: langsung hapus di Dexie
    await optimisticDeleteBilling(id)

    // Queue delete to outbox
    await queueOutboxEntry('penagihan', 'billing_delete', { id_penagihan: id })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidatePenagihanQueries()

    return createResponse({ message: 'Billing deleted successfully' })
  }

  // ============================================================
  // DEPOSIT (SETORAN) API
  // ============================================================

  async getDeposits() {
    const rows = await db.setoran.toArray()
    rows.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime())
    return createResponse(rows)
  }

  async getCashBalance() {
    const { data, error } = await supabase
      .rpc('get_cash_balance')

    if (error) throwError(error.message)
    return createResponse(data)
  }

  async getDepositById(id: number) {
    const row = await db.setoran.get(id)
    if (!row) throwError('Setoran not found')
    return createResponse(row)
  }

  async createDeposit(data: {
    total_setoran: number
    penerima_setoran: string
  }) {
    const today = new Date().toISOString().split('T')[0]

    // Optimistic update: langsung insert ke Dexie
    const optimisticRecord = await optimisticInsertSetoran({
      total_setoran: data.total_setoran,
      penerima_setoran: data.penerima_setoran,
      tanggal_setoran: today
    })

    // Queue insert to outbox
    await queueOutboxEntry('setoran', 'insert', {
      total_setoran: data.total_setoran,
      penerima_setoran: data.penerima_setoran,
      tanggal_setoran: today
    }, { localTempId: optimisticRecord._tempId })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateSetoranQueries()

    return createResponse(optimisticRecord, 202)
  }

  async updateDeposit(id: number, data: {
    total_setoran: number
    penerima_setoran: string
  }) {
    // Optimistic update: langsung update Dexie
    await optimisticUpdateSetoran(id, {
      total_setoran: data.total_setoran,
      penerima_setoran: data.penerima_setoran
    })

    // Queue update to outbox
    await queueOutboxEntry('setoran', 'update', {
      id_setoran: id,
      total_setoran: data.total_setoran,
      penerima_setoran: data.penerima_setoran
    }, { primaryKeyField: 'id_setoran' })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateSetoranQueries()

    return createResponse({
      id_setoran: id,
      ...data
    })
  }

  async deleteDeposit(id: number) {
    // Optimistic delete: langsung mark as deleted di Dexie
    await optimisticDeleteSetoran(id)

    // Queue delete to outbox
    await queueOutboxEntry('setoran', 'delete', {
      id_setoran: id
    }, { primaryKeyField: 'id_setoran' })

    // Invalidate queries to trigger re-fetch from Dexie
    invalidateSetoranQueries()

    return createResponse({ message: 'Deposit deleted successfully' })
  }

  // ============================================================
  // REPORTS API
  // ============================================================

  async getReport(type: 'pengiriman' | 'penagihan' | 'rekonsiliasi' | 'dashboard-stats' | 'product-movement', startDate?: string, endDate?: string, productId?: string) {
    if (type === 'dashboard-stats') {
      return this.getDashboardStats()
    }

    // Untuk tipe lain, gunakan snapshot dari v_dashboard_overview di Dexie
    const rows = await db.v_dashboard_overview.toArray()
    const row = rows[0]
    if (!row) throwError('Dashboard overview not available')
    return createResponse(row)
  }

  async getDashboardStats(timeFilter?: string) {
    const rows = await db.v_dashboard_overview.toArray()
    const row = rows[0]
    if (!row) throwError('Dashboard overview not available')
    return createResponse(row)
  }

  // ============================================================
  // DASHBOARD VIEWS API
  // ============================================================

  async getDashboardPenagihan(params?: {
    page?: number
    limit?: number
    search?: string
    metode_pembayaran?: string
    ada_potongan?: string
    sales_id?: string
    kabupaten?: string
    kecamatan?: string
    date_range?: string
  }) {
    const page = params?.page || 1
    const limit = params?.limit || 30
    const offset = (page - 1) * limit

    let rows = await db.v_penagihan_dashboard.toArray()

    // Search by toko / sales name
    if (params?.search) {
      const search = params.search.toLowerCase()
      rows = rows.filter((r: any) =>
        (r.nama_toko || '').toLowerCase().includes(search) ||
        (r.nama_sales || '').toLowerCase().includes(search)
      )
    }

    // Filter by payment method
    if (params?.metode_pembayaran && params.metode_pembayaran !== 'all') {
      rows = rows.filter((r: any) => r.metode_pembayaran === params.metode_pembayaran)
    }

    // Filter by potongan
    if (params?.ada_potongan && params.ada_potongan !== 'all') {
      const flag = params.ada_potongan === 'true'
      rows = rows.filter((r: any) => Boolean(r.ada_potongan) === flag)
    }

    // Filter by sales / wilayah
    if (params?.sales_id && params.sales_id !== 'all') {
      rows = rows.filter((r: any) => String(r.id_sales) === String(params.sales_id))
    }
    if (params?.kabupaten && params.kabupaten !== 'all') {
      rows = rows.filter((r: any) => (r.kabupaten || '') === params.kabupaten)
    }
    if (params?.kecamatan && params.kecamatan !== 'all') {
      rows = rows.filter((r: any) => (r.kecamatan || '') === params.kecamatan)
    }

    // Filter by date range (based on dibuat_pada)
    if (params?.date_range && params.date_range !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      let startDate: Date
      let endDate: Date

      switch (params.date_range) {
        case 'today':
          startDate = today
          endDate = today
          break
        case 'week': {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 6)
          startDate = weekAgo
          endDate = today
          break
        }
        case 'month': {
          const monthAgo = new Date(today)
          monthAgo.setDate(monthAgo.getDate() - 29)
          startDate = monthAgo
          endDate = today
          break
        }
        case 'current_month': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = today
          break
        }
        case 'last_month': {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
        }
        default:
          startDate = new Date(0)
          endDate = today
      }

      rows = rows.filter((r: any) => {
        const d = r.dibuat_pada ? new Date(r.dibuat_pada) : null
        if (!d || Number.isNaN(d.getTime())) return false
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        return dateOnly >= startDate && dateOnly <= endDate
      })
    }

    // Sort by dibuat_pada desc
    rows.sort((a: any, b: any) => {
      const da = a.dibuat_pada ? new Date(a.dibuat_pada).getTime() : 0
      const db = b.dibuat_pada ? new Date(b.dibuat_pada).getTime() : 0
      return db - da
    })

    const total = rows.length
    const totalPages = Math.ceil(total / limit)
    const pageData = rows.slice(offset, offset + limit)

    return {
      success: true,
      data: {
        data: pageData,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      }
    }
  }

  async getDashboardPengiriman(params?: {
    page?: number
    limit?: number
    search?: string
    is_autorestock?: string
    sales_id?: string
    kabupaten?: string
    kecamatan?: string
    date_range?: string
  }) {
    const page = params?.page || 1
    const limit = params?.limit || 30
    const offset = (page - 1) * limit

    let rows = await db.v_pengiriman_dashboard.toArray()

    if (params?.search) {
      const search = params.search.toLowerCase()
      rows = rows.filter((r: any) =>
        (r.nama_toko || '').toLowerCase().includes(search) ||
        (r.nama_sales || '').toLowerCase().includes(search)
      )
    }
    if (params?.is_autorestock && params.is_autorestock !== 'all') {
      const flag = params.is_autorestock === 'true'
      rows = rows.filter((r: any) => Boolean(r.is_autorestock) === flag)
    }
    if (params?.sales_id && params.sales_id !== 'all') {
      rows = rows.filter((r: any) => String(r.id_sales) === String(params.sales_id))
    }
    if (params?.kabupaten && params.kabupaten !== 'all') {
      rows = rows.filter((r: any) => (r.kabupaten || '') === params.kabupaten)
    }
    if (params?.kecamatan && params.kecamatan !== 'all') {
      rows = rows.filter((r: any) => (r.kecamatan || '') === params.kecamatan)
    }

    // Filter by date range (based on tanggal_kirim)
    if (params?.date_range && params.date_range !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      let startDate: Date
      let endDate: Date

      switch (params.date_range) {
        case 'today':
          startDate = today
          endDate = today
          break
        case 'week': {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 6)
          startDate = weekAgo
          endDate = today
          break
        }
        case 'month': {
          const monthAgo = new Date(today)
          monthAgo.setDate(monthAgo.getDate() - 29)
          startDate = monthAgo
          endDate = today
          break
        }
        case 'current_month': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = today
          break
        }
        case 'last_month': {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
        }
        default:
          startDate = new Date(0)
          endDate = today
      }

      rows = rows.filter((r: any) => {
        const d = r.tanggal_kirim ? new Date(r.tanggal_kirim) : null
        if (!d || Number.isNaN(d.getTime())) return false
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        return dateOnly >= startDate && dateOnly <= endDate
      })
    }

    // Sort by tanggal_kirim desc
    rows.sort((a: any, b: any) => {
      const da = a.tanggal_kirim ? new Date(a.tanggal_kirim).getTime() : 0
      const db = b.tanggal_kirim ? new Date(b.tanggal_kirim).getTime() : 0
      return db - da
    })

    const total = rows.length
    const totalPages = Math.ceil(total / limit)
    const pageData = rows.slice(offset, offset + limit)

    return {
      success: true,
      data: {
        data: pageData,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      }
    }
  }

  async getDashboardSetoran(params?: {
    page?: number
    limit?: number
    search?: string
    status_setoran?: string
    date_range?: string
    event_type?: string
  }) {
    const page = params?.page || 1
    const limit = params?.limit || 30
    const offset = (page - 1) * limit

    let rows = await db.v_setoran_dashboard_fixed.toArray()

    // Text search across penerima, toko, sales, kategori
    if (params?.search) {
      const search = params.search.toLowerCase()
      rows = rows.filter((r: any) =>
        (r.penerima_setoran || '').toLowerCase().includes(search) ||
        (r.nama_toko || '').toLowerCase().includes(search) ||
        (r.nama_sales || '').toLowerCase().includes(search) ||
        (r.transaction_category || '').toLowerCase().includes(search)
      )
    }

    // Filter by status_setoran (SESUAI / KURANG_SETOR / LEBIH_SETOR)
    if (params?.status_setoran && params.status_setoran !== 'all') {
      rows = rows.filter((r: any) => r.status_setoran === params.status_setoran)
    }

    // Filter by jenis event (cash / transfer / setoran)
    if (params?.event_type && params.event_type !== 'all') {
      rows = rows.filter((r: any) => r.event_type === params.event_type)
    }

    // Filter by date range (berdasarkan tanggal_setoran)
    if (params?.date_range && params.date_range !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      let startDate: Date
      let endDate: Date

      switch (params.date_range) {
        case 'today':
          startDate = today
          endDate = today
          break
        case 'week': {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 6)
          startDate = weekAgo
          endDate = today
          break
        }
        case 'month': {
          const monthAgo = new Date(today)
          monthAgo.setDate(monthAgo.getDate() - 29)
          startDate = monthAgo
          endDate = today
          break
        }
        case 'current_month': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = today
          break
        }
        case 'last_month': {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
        }
        default:
          startDate = new Date(0)
          endDate = today
      }

      rows = rows.filter((r: any) => {
        const d = r.tanggal_setoran ? new Date(r.tanggal_setoran) : null
        if (!d || Number.isNaN(d.getTime())) return false
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        return dateOnly >= startDate && dateOnly <= endDate
      })
    }

    // Sort by tanggal_setoran desc
    rows.sort((a: any, b: any) => {
      const da = a.tanggal_setoran ? new Date(a.tanggal_setoran).getTime() : 0
      const db = b.tanggal_setoran ? new Date(b.tanggal_setoran).getTime() : 0
      return db - da
    })

    const total = rows.length
    const totalPages = Math.ceil(total / limit)
    const pageData = rows.slice(offset, offset + limit)

    // Summary berdasarkan rows yang sudah difilter
    let total_cash_in = 0
    let total_transfer_in = 0
    let total_setoran = 0
    let total_cash_transactions = 0
    let total_transfer_transactions = 0
    let total_setoran_transactions = 0

    for (const r of rows) {
      const amount = Number(r.total_setoran || 0)
      switch (r.event_type) {
        case 'PEMBAYARAN_CASH':
          total_cash_in += amount
          total_cash_transactions += 1
          break
        case 'PEMBAYARAN_TRANSFER':
          total_transfer_in += amount
          total_transfer_transactions += 1
          break
        case 'SETORAN':
          total_setoran += amount
          total_setoran_transactions += 1
          break
      }
    }

    const net_cash_flow = total_cash_in + total_transfer_in - total_setoran
    const total_events = total

    return {
      success: true,
      data: {
        data: pageData,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        summary: {
          total_cash_in,
          total_transfer_in,
          total_setoran,
          net_cash_flow,
          total_cash_transactions,
          total_transfer_transactions,
          total_setoran_transactions,
          total_events
        }
      }
    }
  }

  async getDashboardPengeluaran(params?: {
    page?: number
    limit?: number
    search?: string
    date_range?: string
  }) {
    const page = params?.page || 1
    const limit = params?.limit || 30
    const offset = (page - 1) * limit

    let rows = await db.pengeluaran_operasional.toArray()

    if (params?.search) {
      const search = params.search.toLowerCase()
      rows = rows.filter((r: any) =>
        (r.keterangan || '').toLowerCase().includes(search)
      )
    }

    // Filter by date range (based on tanggal_pengeluaran)
    if (params?.date_range && params.date_range !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      let startDate: Date
      let endDate: Date

      switch (params.date_range) {
        case 'today':
          startDate = today
          endDate = today
          break
        case 'week': {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 6)
          startDate = weekAgo
          endDate = today
          break
        }
        case 'month': {
          const monthAgo = new Date(today)
          monthAgo.setDate(monthAgo.getDate() - 29)
          startDate = monthAgo
          endDate = today
          break
        }
        case 'current_month': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = today
          break
        }
        case 'last_month': {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
        }
        default:
          startDate = new Date(0)
          endDate = today
      }

      rows = rows.filter((r: any) => {
        const d = r.tanggal_pengeluaran ? new Date(r.tanggal_pengeluaran) : null
        if (!d || Number.isNaN(d.getTime())) return false
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        return dateOnly >= startDate && dateOnly <= endDate
      })
    }

    // Sort by tanggal_pengeluaran desc
    rows.sort((a: any, b: any) => {
      const da = a.tanggal_pengeluaran ? new Date(a.tanggal_pengeluaran).getTime() : 0
      const db = b.tanggal_pengeluaran ? new Date(b.tanggal_pengeluaran).getTime() : 0
      return db - da
    })

    const total = rows.length
    const totalPages = Math.ceil(total / limit)
    const pageData = rows.slice(offset, offset + limit)

    return {
      success: true,
      data: {
        data: pageData,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      }
    }
  }

  async getDashboardPengeluaranStats(params?: {
    date_range?: string
  }) {
    let rows = await db.pengeluaran_operasional.toArray()

    // Terapkan filter date_range yang sama dengan dashboard pengeluaran
    if (params?.date_range && params.date_range !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      let startDate: Date
      let endDate: Date

      switch (params.date_range) {
        case 'today':
          startDate = today
          endDate = today
          break
        case 'week': {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 6)
          startDate = weekAgo
          endDate = today
          break
        }
        case 'month': {
          const monthAgo = new Date(today)
          monthAgo.setDate(monthAgo.getDate() - 29)
          startDate = monthAgo
          endDate = today
          break
        }
        case 'current_month': {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = today
          break
        }
        case 'last_month': {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
        }
        default:
          startDate = new Date(0)
          endDate = today
      }

      rows = rows.filter((r: any) => {
        const d = r.tanggal_pengeluaran ? new Date(r.tanggal_pengeluaran) : null
        if (!d || Number.isNaN(d.getTime())) return false
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        return dateOnly >= startDate && dateOnly <= endDate
      })
    }

    const totalPengeluaran = rows.reduce((sum: number, item: any) => sum + Number(item.jumlah || item.jumlah_pengeluaran || 0), 0)

    return {
      success: true,
      data: {
        total_pengeluaran: totalPengeluaran,
        date_range: params?.date_range || 'all'
      }
    }
  }

  async getDashboardOverview() {
    const rows = await db.v_dashboard_overview.toArray()
    const row = rows[0]
    if (!row) throwError('Dashboard overview not available')
    return { success: true, data: row }
  }

  // ============================================================
  // MASTER DATA API
  // ============================================================

  async getMasterProduk(params?: {
    page?: number
    limit?: number
    search?: string
    status_produk?: string
    is_priority?: string
    date_range?: string
  }) {
    const page = params?.page || 1
    const limit = params?.limit || 50
    const offset = (page - 1) * limit

    let rows = await db.v_master_produk.toArray()

    if (params?.search) {
      const search = params.search.toLowerCase()
      rows = rows.filter((r: any) => (r.nama_produk || '').toLowerCase().includes(search))
    }
    if (params?.status_produk && params.status_produk !== 'all') {
      const flag = params.status_produk === 'true'
      rows = rows.filter((r: any) => Boolean(r.status_produk) === flag)
    }
    if (params?.is_priority && params.is_priority !== 'all') {
      const flag = params.is_priority === 'true'
      rows = rows.filter((r: any) => Boolean(r.is_priority) === flag)
    }

    rows.sort((a: any, b: any) => (a.nama_produk || '').localeCompare(b.nama_produk || ''))

    const total = rows.length
    const totalPages = Math.ceil(total / limit)
    const pageData = rows.slice(offset, offset + limit)

    return {
      success: true,
      data: {
        data: pageData,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      }
    }
  }

  async getMasterToko(params?: {
    page?: number
    limit?: number
    search?: string
    kabupaten?: string
    kecamatan?: string
    status_toko?: string
    sales_id?: string
  }) {
    const page = params?.page || 1
    const limit = params?.limit || 25
    const offset = (page - 1) * limit

    // Fetch base table and view data
    const [tokoRows, viewRows, salesRows] = await Promise.all([
      db.toko.toArray(),
      db.v_master_toko.toArray(),
      db.sales.toArray()
    ])

    // Create maps for joining
    const viewById = new Map<number, any>(
      viewRows.map((row: any) => [row.id_toko, row])
    )
    const salesById = new Map<number, any>(
      salesRows.map((row: any) => [row.id_sales, row])
    )

    // Merge: base table data + view stats + sales info
    // Base table is the source of truth for basic fields (optimistic updates go here)
    // View provides computed stats that are eventually consistent
    let rows = tokoRows
      .filter((t: any) => !t._deleted) // Exclude soft-deleted optimistic records
      .map((t: any) => {
        const v = viewById.get(t.id_toko) || {}
        const s = salesById.get(t.id_sales) || {}
        return {
          id_toko: t.id_toko,
          nama_toko: t.nama_toko,
          kecamatan: t.kecamatan,
          kabupaten: t.kabupaten,
          link_gmaps: t.link_gmaps,
          no_telepon: t.no_telepon,
          status_toko: t.status_toko,
          id_sales: t.id_sales,
          nama_sales: s.nama_sales || v.nama_sales || '',
          telepon_sales: s.nomor_telepon || v.telepon_sales || '',
          dibuat_pada: t.dibuat_pada,
          diperbarui_pada: t.diperbarui_pada,
          // Stats from view (eventually consistent)
          quantity_shipped: v.quantity_shipped || 0,
          quantity_sold: v.quantity_sold || 0,
          quantity_returned: v.quantity_returned || 0,
          remaining_stock: v.remaining_stock || 0,
          total_revenue: v.total_revenue || 0,
          detail_shipped: v.detail_shipped,
          detail_sold: v.detail_sold,
          // Pending flag for UI feedback
          _pending: t._pending
        }
      })

    // Apply filters
    if (params?.search) {
      const search = params.search.toLowerCase()
      rows = rows.filter((r: any) =>
        (r.nama_toko || '').toLowerCase().includes(search) ||
        (r.nama_sales || '').toLowerCase().includes(search)
      )
    }
    if (params?.kabupaten && params.kabupaten !== 'all') {
      rows = rows.filter((r: any) => (r.kabupaten || '') === params.kabupaten)
    }
    if (params?.kecamatan && params.kecamatan !== 'all') {
      rows = rows.filter((r: any) => (r.kecamatan || '') === params.kecamatan)
    }
    if (params?.status_toko && params.status_toko !== 'all') {
      const flag = params.status_toko === 'true'
      rows = rows.filter((r: any) => Boolean(r.status_toko) === flag)
    }
    if (params?.sales_id && params.sales_id !== 'all') {
      rows = rows.filter((r: any) => String(r.id_sales) === String(params.sales_id))
    }

    rows.sort((a: any, b: any) => (a.nama_toko || '').localeCompare(b.nama_toko || ''))

    const total = rows.length
    const totalPages = Math.ceil(total / limit)
    const pageData = rows.slice(offset, offset + limit)

    return {
      success: true,
      data: {
        data: pageData,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          from: offset + 1,
          to: Math.min(offset + limit, total)
        }
      }
    }
  }

  async getMasterSales(params?: {
    start_date?: string
    end_date?: string
  }) {
    const [salesRows, masterRows] = await Promise.all([
      db.sales.toArray(),
      db.v_master_sales.toArray()
    ])

    const masterById = new Map<number, any>(
      masterRows.map((row: any) => [row.id_sales, row])
    )

    const merged = salesRows.map((s: any) => {
      const m = masterById.get(s.id_sales) || {}
      return {
        id_sales: s.id_sales,
        nama_sales: s.nama_sales,
        nomor_telepon: s.nomor_telepon,
        status_aktif: s.status_aktif,
        dibuat_pada: s.dibuat_pada,
        diperbarui_pada: s.diperbarui_pada,
        total_stores: m.total_stores ?? 0,
        total_revenue: m.total_revenue ?? 0,
        quantity_shipped: m.quantity_shipped ?? 0,
        quantity_sold: m.quantity_sold ?? 0,
        detail_shipped: m.detail_shipped ?? 'Tidak ada produk terkirim',
        detail_sold: m.detail_sold ?? 'Tidak ada produk terjual',
      }
    })

    merged.sort((a, b) => (a.nama_sales || '').localeCompare(b.nama_sales || ''))

    return { success: true, data: merged }
  }

  // ============================================================
  // FILTER OPTIONS API
  // ============================================================

  async getFilterOptions() {
    const [allSales, allToko] = await Promise.all([
      db.sales.toArray(),
      db.toko.toArray()
    ])

    const sales = allSales
      .filter(s => s.status_aktif === true || (s.status_aktif as any) === 1)
      .sort((a, b) => a.nama_sales.localeCompare(b.nama_sales))

    const toko = allToko
      .filter(t => t.status_toko === true || (t.status_toko as any) === 1)

    const kabupatenSet = new Set<string>()
    const kecamatanSet = new Set<string>()

    for (const t of toko) {
      if (t.kabupaten) kabupatenSet.add(t.kabupaten)
      if (t.kecamatan) kecamatanSet.add(t.kecamatan)
    }

    const uniqueKabupaten = Array.from(kabupatenSet)
    const uniqueKecamatan = Array.from(kecamatanSet)

    return {
      success: true,
      data: {
        sales: sales.map(s => ({ id_sales: s.id_sales, nama_sales: s.nama_sales })),
        kabupaten: uniqueKabupaten.map(k => ({ kabupaten: k })),
        kecamatan: uniqueKecamatan.map(k => ({ kecamatan: k }))
      }
    }
  }

  async getSalesOptions() {
    const rows = await db.sales.toArray()
    const active = rows
      .filter(s => s.status_aktif === true || (s.status_aktif as any) === 1)
      .sort((a, b) => a.nama_sales.localeCompare(b.nama_sales))

    return {
      success: true,
      data: active.map(s => ({
        id_sales: s.id_sales,
        nama_sales: s.nama_sales,
        status_aktif: s.status_aktif
      }))
    }
  }

  async getKabupatenOptions() {
    const rows = await db.toko.toArray()
    const active = rows.filter(t => t.status_toko === true || (t.status_toko as any) === 1)
    const unique = [...new Set(active.map(t => t.kabupaten).filter(Boolean) as string[])]
    unique.sort((a, b) => a.localeCompare(b))
    return { success: true, data: unique.map(k => ({ kabupaten: k })) }
  }

  async getKecamatanOptions(kabupaten?: string) {
    let rows = await db.toko.toArray()
    rows = rows.filter(t => t.status_toko === true || (t.status_toko as any) === 1)
    if (kabupaten && kabupaten !== 'all') {
      rows = rows.filter(t => (t.kabupaten || '') === kabupaten)
    }

    const unique = [...new Set(rows.map(t => t.kecamatan).filter(Boolean) as string[])]
    unique.sort((a, b) => a.localeCompare(b))
    return { success: true, data: unique.map(k => ({ kecamatan: k, kabupaten: kabupaten || '' })) }
  }

  async getTokoOptions(filters?: { sales_id?: number; kabupaten?: string; kecamatan?: string }) {
    let rows = await db.toko.toArray()
    rows = rows.filter(t => t.status_toko === true || (t.status_toko as any) === 1)

    if (filters?.sales_id) {
      rows = rows.filter(t => t.id_sales === filters.sales_id)
    }
    if (filters?.kabupaten) {
      rows = rows.filter(t => (t.kabupaten || '') === filters.kabupaten)
    }
    if (filters?.kecamatan) {
      rows = rows.filter(t => (t.kecamatan || '') === filters.kecamatan)
    }

    rows.sort((a, b) => (a.nama_toko || '').localeCompare(b.nama_toko || ''))

    return {
      success: true,
      data: rows.map(t => ({
        id_toko: t.id_toko,
        nama_toko: t.nama_toko,
        kecamatan: t.kecamatan,
        kabupaten: t.kabupaten,
        status_toko: t.status_toko,
        id_sales: t.id_sales
      }))
    }
  }

  async getProdukOptions() {
    let rows = await db.produk.toArray()
    rows = rows.filter(p => p.status_produk === true)
    rows.sort((a, b) => (a.nama_produk || '').localeCompare(b.nama_produk || ''))

    return {
      success: true,
      data: rows.map(p => ({
        id_produk: p.id_produk,
        nama_produk: p.nama_produk,
        harga_satuan: p.harga_satuan,
        status_produk: p.status_produk,
        is_priority: p.is_priority
      }))
    }
  }

  async getMasterProdukStats(params?: {
    search?: string
    status_produk?: string
    is_priority?: string
    date_range?: string
  }) {
    let rows = await db.v_master_produk.toArray()

    if (params?.search) {
      const search = params.search.toLowerCase()
      rows = rows.filter((p: any) => (p.nama_produk || '').toLowerCase().includes(search))
    }
    if (params?.status_produk && params.status_produk !== 'all') {
      const flag = params.status_produk === 'true'
      rows = rows.filter((p: any) => Boolean(p.status_produk) === flag)
    }
    if (params?.is_priority && params.is_priority !== 'all') {
      const flag = params.is_priority === 'true'
      rows = rows.filter((p: any) => Boolean(p.is_priority) === flag)
    }

    const stats = {
      total_produk: rows.length || 0,
      produk_aktif: rows.filter((p: any) => p.status_produk).length || 0,
      produk_priority: rows.filter((p: any) => p.is_priority).length || 0,
      total_dikirim: rows.reduce((sum: number, p: any) => sum + (p.total_dikirim || 0), 0) || 0,
      total_terjual: rows.reduce((sum: number, p: any) => sum + (p.total_terjual || 0), 0) || 0,
      total_dikembalikan: rows.reduce((sum: number, p: any) => sum + (p.total_dikembalikan || 0), 0) || 0,
      sisa_stok_total: rows.reduce((sum: number, p: any) => sum + (p.stok_di_toko || 0), 0) || 0,
      nilai_total_dikirim: rows.reduce((sum: number, p: any) => sum + (p.nilai_total_dikirim || 0), 0) || 0,
      nilai_total_terjual: rows.reduce((sum: number, p: any) => sum + (p.nilai_total_terjual || 0), 0) || 0,
      nilai_total_dikembalikan: rows.reduce((sum: number, p: any) => sum + (p.nilai_total_dikembalikan || 0), 0) || 0,
      total_dibayar: rows.reduce((sum: number, p: any) => sum + (p.total_dibayar || 0), 0) || 0
    }

    return { success: true, data: stats }
  }

  // ============================================================
  // LEGACY COMPATIBILITY
  // ============================================================

  async getDirectQuery(entity: 'sales' | 'produk' | 'toko' | 'penagihan' | 'pengiriman', params?: string) {
    const viewMap = {
      sales: 'v_master_sales',
      produk: 'v_master_produk',
      toko: 'v_master_toko',
      penagihan: 'v_penagihan_dashboard',
      pengiriman: 'v_pengiriman_dashboard'
    }

    const { data, error } = await supabase
      .from(viewMap[entity])
      .select('*')

    if (error) throwError(error.message)
    return createResponse(data)
  }

  async getDirectQueryById(entity: 'sales' | 'produk' | 'toko' | 'penagihan' | 'pengiriman', id: number) {
    const tableMap = {
      sales: 'sales',
      produk: 'produk',
      toko: 'toko',
      penagihan: 'penagihan',
      pengiriman: 'pengiriman'
    }
    const idFieldMap = {
      sales: 'id_sales',
      produk: 'id_produk',
      toko: 'id_toko',
      penagihan: 'id_penagihan',
      pengiriman: 'id_pengiriman'
    }

    const { data, error } = await supabase
      .from(tableMap[entity])
      .select('*')
      .eq(idFieldMap[entity], id)
      .single()

    if (error) throwError(error.message)
    return createResponse(data)
  }

  // Legacy aliases
  async getMaterializedView(entity: 'sales' | 'produk' | 'toko' | 'penagihan' | 'pengiriman', params?: string) {
    return this.getDirectQuery(entity, params)
  }

  async getMaterializedViewById(entity: 'sales' | 'produk' | 'toko' | 'penagihan' | 'pengiriman', id: number, extraParams?: string) {
    return this.getDirectQueryById(entity, id)
  }

  // Search methods
  async searchStores(searchTerm: string, filters?: {
    id_sales?: number
    kabupaten?: string
    kecamatan?: string
  }) {
    let rows = await db.toko.toArray()
    rows = rows.filter(t => t.status_toko === true || (t.status_toko as any) === 1)

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      rows = rows.filter(t =>
        (t.nama_toko || '').toLowerCase().includes(search) ||
        (t.kecamatan || '').toLowerCase().includes(search) ||
        (t.kabupaten || '').toLowerCase().includes(search)
      )
    }
    if (filters?.id_sales) {
      rows = rows.filter(t => t.id_sales === filters.id_sales)
    }
    if (filters?.kabupaten) {
      rows = rows.filter(t => (t.kabupaten || '') === filters.kabupaten)
    }
    if (filters?.kecamatan) {
      rows = rows.filter(t => (t.kecamatan || '') === filters.kecamatan)
    }

    rows.sort((a, b) => (a.nama_toko || '').localeCompare(b.nama_toko || ''))
    return createResponse(rows)
  }

  async searchProducts(searchTerm: string, withStats: boolean = true, priorityOnly: boolean = false) {
    let rows = withStats
      ? await db.v_master_produk.toArray()
      : await db.produk.toArray()

    rows = rows.filter((p: any) => p.status_produk === true)

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      rows = rows.filter((p: any) => (p.nama_produk || '').toLowerCase().includes(search))
    }
    if (priorityOnly) {
      rows = rows.filter((p: any) => p.is_priority === true)
    }

    rows.sort((a: any, b: any) => (a.nama_produk || '').localeCompare(b.nama_produk || ''))
    return createResponse(rows)
  }

  async searchSales(searchTerm: string) {
    let rows = await db.sales.toArray()
    rows = rows.filter(s => s.status_aktif === true || (s.status_aktif as any) === 1)

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      rows = rows.filter(s => (s.nama_sales || '').toLowerCase().includes(search))
    }

    rows.sort((a, b) => (a.nama_sales || '').localeCompare(b.nama_sales || ''))
    return createResponse(rows)
  }

  // Public method to get auth headers (kept for compatibility)
  async getAuthHeadersPublic() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('No authenticated session found')
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }
}

export const apiClient = new ApiClient()
