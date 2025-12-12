/**
 * Optimistic Update Utilities
 *
 * Modul ini menyediakan fungsi-fungsi untuk melakukan optimistic updates
 * ke Dexie, sehingga UI langsung ter-update tanpa menunggu response dari Supabase.
 *
 * Arsitektur:
 * 1. CRUD dilakukan → Dexie langsung di-update dengan flag _pending
 * 2. Data di-queue ke outbox
 * 3. Outbox worker kirim ke Supabase
 * 4. Supabase Realtime event masuk → reconcile dengan optimistic record
 *
 * Supabase tetap menjadi source of truth.
 */

import { db, type Sales, type Produk, type Toko, type Pengiriman, type DetailPengiriman, type Penagihan, type DetailPenagihan, type Setoran, type PengeluaranOperasional, type PotonganPenagihan } from './dexie'

// Counter untuk generate temporary ID (negatif agar tidak konflik dengan real ID)
let tempIdCounter = -1

/**
 * Generate temporary ID untuk optimistic insert.
 * Menggunakan ID negatif agar tidak konflik dengan ID dari Supabase.
 */
export function generateTempId(): number {
    return tempIdCounter--
}

/**
 * Check apakah ID adalah temporary ID
 */
export function isTempId(id: number): boolean {
    return id < 0
}

/**
 * Get current timestamp in ISO format
 */
function getNow(): string {
    return new Date().toISOString()
}

// ============================================================
// SALES OPTIMISTIC OPERATIONS
// ============================================================

export interface OptimisticSales extends Sales {
    _pending?: boolean
    _tempId?: number
    _deleted?: boolean
}

export async function optimisticInsertSales(data: {
    nama_sales: string
    nomor_telepon?: string | null
}): Promise<OptimisticSales> {
    const tempId = generateTempId()
    const now = getNow()

    const record: OptimisticSales = {
        id_sales: tempId,
        nama_sales: data.nama_sales,
        nomor_telepon: data.nomor_telepon || null,
        status_aktif: true,
        dibuat_pada: now,
        diperbarui_pada: now,
        _pending: true,
        _tempId: tempId
    }

    await db.sales.put(record as Sales)
    return record
}

export async function optimisticUpdateSales(
    id: number,
    data: Partial<Pick<Sales, 'nama_sales' | 'nomor_telepon' | 'status_aktif'>>
): Promise<void> {
    const existing = await db.sales.get(id)
    if (!existing) return

    const updated: OptimisticSales = {
        ...existing,
        ...data,
        diperbarui_pada: getNow(),
        _pending: true
    }

    await db.sales.put(updated as Sales)
}

export async function optimisticDeleteSales(id: number): Promise<void> {
    // Soft delete - set status_aktif to false
    await optimisticUpdateSales(id, { status_aktif: false })
}

// ============================================================
// PRODUK OPTIMISTIC OPERATIONS
// ============================================================

export interface OptimisticProduk extends Produk {
    _pending?: boolean
    _tempId?: number
    _deleted?: boolean
}

export async function optimisticInsertProduk(data: {
    nama_produk: string
    harga_satuan: number
    is_priority?: boolean
    priority_order?: number
}): Promise<OptimisticProduk> {
    const tempId = generateTempId()
    const now = getNow()

    const record: OptimisticProduk = {
        id_produk: tempId,
        nama_produk: data.nama_produk,
        harga_satuan: data.harga_satuan,
        status_produk: true,
        is_priority: data.is_priority || false,
        priority_order: data.priority_order || 0,
        dibuat_pada: now,
        diperbarui_pada: now,
        _pending: true,
        _tempId: tempId
    }

    await db.produk.put(record as Produk)
    return record
}

export async function optimisticUpdateProduk(
    id: number,
    data: Partial<Pick<Produk, 'nama_produk' | 'harga_satuan' | 'status_produk' | 'is_priority' | 'priority_order'>>
): Promise<void> {
    const existing = await db.produk.get(id)
    if (!existing) return

    const updated: OptimisticProduk = {
        ...existing,
        ...data,
        diperbarui_pada: getNow(),
        _pending: true
    }

    await db.produk.put(updated as Produk)
}

export async function optimisticDeleteProduk(id: number): Promise<void> {
    await optimisticUpdateProduk(id, { status_produk: false })
}

// ============================================================
// TOKO OPTIMISTIC OPERATIONS
// ============================================================

export interface OptimisticToko extends Toko {
    _pending?: boolean
    _tempId?: number
    _deleted?: boolean
}

export async function optimisticInsertToko(data: {
    id_sales: number
    nama_toko: string
    kecamatan?: string | null
    kabupaten?: string | null
    no_telepon?: string | null
    link_gmaps?: string | null
}): Promise<OptimisticToko> {
    const tempId = generateTempId()
    const now = getNow()

    const record: OptimisticToko = {
        id_toko: tempId,
        id_sales: data.id_sales,
        nama_toko: data.nama_toko,
        kecamatan: data.kecamatan || null,
        kabupaten: data.kabupaten || null,
        no_telepon: data.no_telepon || null,
        link_gmaps: data.link_gmaps || null,
        status_toko: true,
        dibuat_pada: now,
        diperbarui_pada: now,
        _pending: true,
        _tempId: tempId
    }

    await db.toko.put(record as Toko)
    return record
}

export async function optimisticUpdateToko(
    id: number,
    data: Partial<Pick<Toko, 'id_sales' | 'nama_toko' | 'kecamatan' | 'kabupaten' | 'no_telepon' | 'link_gmaps' | 'status_toko'>>
): Promise<void> {
    const existing = await db.toko.get(id)
    if (!existing) return

    const updated: OptimisticToko = {
        ...existing,
        ...data,
        diperbarui_pada: getNow(),
        _pending: true
    }

    await db.toko.put(updated as Toko)
}

export async function optimisticDeleteToko(id: number): Promise<void> {
    await optimisticUpdateToko(id, { status_toko: false })
}

// ============================================================
// SETORAN OPTIMISTIC OPERATIONS
// ============================================================

export interface OptimisticSetoran extends Setoran {
    _pending?: boolean
    _tempId?: number
    _deleted?: boolean
}

export async function optimisticInsertSetoran(data: {
    total_setoran: number
    penerima_setoran: string
    tanggal_setoran?: string
}): Promise<OptimisticSetoran> {
    const tempId = generateTempId()
    const now = getNow()
    const today = now.split('T')[0]

    const record: OptimisticSetoran = {
        id_setoran: tempId,
        total_setoran: data.total_setoran,
        penerima_setoran: data.penerima_setoran,
        tanggal_setoran: data.tanggal_setoran || today,
        dibuat_pada: now,
        diperbarui_pada: now,
        _pending: true,
        _tempId: tempId
    }

    await db.setoran.put(record as Setoran)
    return record
}

export async function optimisticUpdateSetoran(
    id: number,
    data: Partial<Pick<Setoran, 'total_setoran' | 'penerima_setoran' | 'tanggal_setoran'>>
): Promise<void> {
    const existing = await db.setoran.get(id)
    if (!existing) return

    const updated: OptimisticSetoran = {
        ...existing,
        ...data,
        diperbarui_pada: getNow(),
        _pending: true
    }

    await db.setoran.put(updated as Setoran)
}

export async function optimisticDeleteSetoran(id: number): Promise<void> {
    // Hard delete for setoran (mark as _deleted, will be removed on reconcile)
    const existing = await db.setoran.get(id)
    if (!existing) return

    const updated: OptimisticSetoran = {
        ...existing,
        _pending: true,
        _deleted: true
    }

    await db.setoran.put(updated as Setoran)
}

// ============================================================
// PENGELUARAN OPERASIONAL OPTIMISTIC OPERATIONS
// ============================================================

export interface OptimisticPengeluaran extends PengeluaranOperasional {
    _pending?: boolean
    _tempId?: number
    _deleted?: boolean
}

export async function optimisticInsertPengeluaran(data: {
    jumlah: number
    keterangan: string
    url_bukti_foto?: string | null
    tanggal_pengeluaran: string
}): Promise<OptimisticPengeluaran> {
    const tempId = generateTempId()
    const now = getNow()

    const record: OptimisticPengeluaran = {
        id_pengeluaran: tempId,
        jumlah: data.jumlah,
        keterangan: data.keterangan,
        url_bukti_foto: data.url_bukti_foto || null,
        tanggal_pengeluaran: data.tanggal_pengeluaran,
        dibuat_pada: now,
        diperbarui_pada: now,
        _pending: true,
        _tempId: tempId
    }

    await db.pengeluaran_operasional.put(record as PengeluaranOperasional)
    return record
}

export async function optimisticUpdatePengeluaran(
    id: number,
    data: Partial<Pick<PengeluaranOperasional, 'jumlah' | 'keterangan' | 'url_bukti_foto' | 'tanggal_pengeluaran'>>
): Promise<void> {
    const existing = await db.pengeluaran_operasional.get(id)
    if (!existing) return

    const updated: OptimisticPengeluaran = {
        ...existing,
        ...data,
        diperbarui_pada: getNow(),
        _pending: true
    }

    await db.pengeluaran_operasional.put(updated as PengeluaranOperasional)
}

export async function optimisticDeletePengeluaran(id: number): Promise<void> {
    const existing = await db.pengeluaran_operasional.get(id)
    if (!existing) return

    const updated: OptimisticPengeluaran = {
        ...existing,
        _pending: true,
        _deleted: true
    }

    await db.pengeluaran_operasional.put(updated as PengeluaranOperasional)
}

// ============================================================
// PENGIRIMAN (SHIPMENT) OPTIMISTIC OPERATIONS
// ============================================================

export interface OptimisticPengiriman extends Pengiriman {
    _pending?: boolean
    _tempId?: number
    _deleted?: boolean
}

export interface OptimisticDetailPengiriman extends DetailPengiriman {
    _pending?: boolean
    _tempId?: number
}

export async function optimisticInsertShipment(data: {
    id_toko: number
    tanggal_kirim: string
    is_autorestock?: boolean
    details: Array<{
        id_produk: number
        jumlah_kirim: number
    }>
}): Promise<{ pengiriman: OptimisticPengiriman; details: OptimisticDetailPengiriman[] }> {
    const tempId = generateTempId()
    const now = getNow()

    const pengiriman: OptimisticPengiriman = {
        id_pengiriman: tempId,
        id_toko: data.id_toko,
        tanggal_kirim: data.tanggal_kirim,
        is_autorestock: data.is_autorestock || false,
        dibuat_pada: now,
        diperbarui_pada: now,
        _pending: true,
        _tempId: tempId
    }

    await db.pengiriman.put(pengiriman as Pengiriman)

    const details: OptimisticDetailPengiriman[] = []
    for (const d of data.details) {
        const detailTempId = generateTempId()
        const detail: OptimisticDetailPengiriman = {
            id_detail_kirim: detailTempId,
            id_pengiriman: tempId,
            id_produk: d.id_produk,
            jumlah_kirim: d.jumlah_kirim,
            dibuat_pada: now,
            diperbarui_pada: now,
            _pending: true,
            _tempId: detailTempId
        }
        await db.detail_pengiriman.put(detail as DetailPengiriman)
        details.push(detail)
    }

    return { pengiriman, details }
}

export async function optimisticUpdateShipment(
    id: number,
    data: {
        tanggal_kirim: string
        details: Array<{
            id_produk: number
            jumlah_kirim: number
        }>
    }
): Promise<void> {
    const existing = await db.pengiriman.get(id)
    if (!existing) return

    const now = getNow()

    // Update pengiriman
    const updated: OptimisticPengiriman = {
        ...existing,
        tanggal_kirim: data.tanggal_kirim,
        diperbarui_pada: now,
        _pending: true
    }
    await db.pengiriman.put(updated as Pengiriman)

    // Delete old details and insert new ones
    await db.detail_pengiriman.where('id_pengiriman').equals(id).delete()

    for (const d of data.details) {
        const detailTempId = generateTempId()
        const detail: OptimisticDetailPengiriman = {
            id_detail_kirim: detailTempId,
            id_pengiriman: id,
            id_produk: d.id_produk,
            jumlah_kirim: d.jumlah_kirim,
            dibuat_pada: now,
            diperbarui_pada: now,
            _pending: true,
            _tempId: detailTempId
        }
        await db.detail_pengiriman.put(detail as DetailPengiriman)
    }
}

export async function optimisticDeleteShipment(id: number): Promise<void> {
    const existing = await db.pengiriman.get(id)
    if (!existing) return

    // Mark pengiriman as deleted
    const updated: OptimisticPengiriman = {
        ...existing,
        _pending: true,
        _deleted: true
    }
    await db.pengiriman.put(updated as Pengiriman)

    // Mark all details as deleted (or just delete them)
    await db.detail_pengiriman.where('id_pengiriman').equals(id).delete()
}

// ============================================================
// PENAGIHAN (BILLING) OPTIMISTIC OPERATIONS
// ============================================================

export interface OptimisticPenagihan extends Penagihan {
    _pending?: boolean
    _tempId?: number
    _deleted?: boolean
}

export interface OptimisticDetailPenagihan extends DetailPenagihan {
    _pending?: boolean
    _tempId?: number
}

export interface OptimisticPotongan extends PotonganPenagihan {
    _pending?: boolean
    _tempId?: number
}

export async function optimisticInsertBilling(data: {
    id_toko: number
    total_uang_diterima: number
    metode_pembayaran: 'Cash' | 'Transfer'
    ada_potongan?: boolean
    details: Array<{
        id_produk: number
        jumlah_terjual: number
        jumlah_kembali: number
    }>
    potongan?: {
        jumlah_potongan: number
        alasan?: string
    }
}): Promise<{ penagihan: OptimisticPenagihan; details: OptimisticDetailPenagihan[]; potongan?: OptimisticPotongan }> {
    const tempId = generateTempId()
    const now = getNow()

    const penagihan: OptimisticPenagihan = {
        id_penagihan: tempId,
        id_toko: data.id_toko,
        total_uang_diterima: data.total_uang_diterima,
        metode_pembayaran: data.metode_pembayaran,
        ada_potongan: data.ada_potongan || !!(data.potongan && data.potongan.jumlah_potongan > 0),
        dibuat_pada: now,
        diperbarui_pada: now,
        _pending: true,
        _tempId: tempId
    }

    await db.penagihan.put(penagihan as Penagihan)

    const details: OptimisticDetailPenagihan[] = []
    for (const d of data.details) {
        const detailTempId = generateTempId()
        const detail: OptimisticDetailPenagihan = {
            id_detail_tagih: detailTempId,
            id_penagihan: tempId,
            id_produk: d.id_produk,
            jumlah_terjual: d.jumlah_terjual,
            jumlah_kembali: d.jumlah_kembali,
            dibuat_pada: now,
            diperbarui_pada: now,
            _pending: true,
            _tempId: detailTempId
        }
        await db.detail_penagihan.put(detail as DetailPenagihan)
        details.push(detail)
    }

    let potongan: OptimisticPotongan | undefined
    if (data.potongan && data.potongan.jumlah_potongan > 0) {
        const potonganTempId = generateTempId()
        potongan = {
            id_potongan: potonganTempId,
            id_penagihan: tempId,
            jumlah_potongan: data.potongan.jumlah_potongan,
            alasan: data.potongan.alasan || null,
            dibuat_pada: now,
            diperbarui_pada: now,
            _pending: true,
            _tempId: potonganTempId
        }
        await db.potongan_penagihan.put(potongan as PotonganPenagihan)
    }

    return { penagihan, details, potongan }
}

export async function optimisticUpdateBilling(
    id: number,
    data: {
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
    }
): Promise<void> {
    const existing = await db.penagihan.get(id)
    if (!existing) return

    const now = getNow()

    // Update penagihan
    const updated: OptimisticPenagihan = {
        ...existing,
        total_uang_diterima: data.total_uang_diterima,
        metode_pembayaran: data.metode_pembayaran,
        ada_potongan: !!(data.potongan && data.potongan.jumlah_potongan > 0),
        diperbarui_pada: now,
        _pending: true
    }
    await db.penagihan.put(updated as Penagihan)

    // Delete old details and insert new ones
    await db.detail_penagihan.where('id_penagihan').equals(id).delete()

    for (const d of data.details) {
        const detailTempId = generateTempId()
        const detail: OptimisticDetailPenagihan = {
            id_detail_tagih: detailTempId,
            id_penagihan: id,
            id_produk: d.id_produk,
            jumlah_terjual: d.jumlah_terjual,
            jumlah_kembali: d.jumlah_kembali,
            dibuat_pada: now,
            diperbarui_pada: now,
            _pending: true,
            _tempId: detailTempId
        }
        await db.detail_penagihan.put(detail as DetailPenagihan)
    }

    // Delete old potongan and insert new one if exists
    await db.potongan_penagihan.where('id_penagihan').equals(id).delete()

    if (data.potongan && data.potongan.jumlah_potongan > 0) {
        const potonganTempId = generateTempId()
        const potongan: OptimisticPotongan = {
            id_potongan: potonganTempId,
            id_penagihan: id,
            jumlah_potongan: data.potongan.jumlah_potongan,
            alasan: data.potongan.alasan || null,
            dibuat_pada: now,
            diperbarui_pada: now,
            _pending: true,
            _tempId: potonganTempId
        }
        await db.potongan_penagihan.put(potongan as PotonganPenagihan)
    }
}

export async function optimisticDeleteBilling(id: number): Promise<void> {
    const existing = await db.penagihan.get(id)
    if (!existing) return

    // Mark penagihan as deleted
    const updated: OptimisticPenagihan = {
        ...existing,
        _pending: true,
        _deleted: true
    }
    await db.penagihan.put(updated as Penagihan)

    // Delete related records
    await db.detail_penagihan.where('id_penagihan').equals(id).delete()
    await db.potongan_penagihan.where('id_penagihan').equals(id).delete()
}

// ============================================================
// RECONCILIATION FUNCTIONS
// ============================================================

/**
 * Reconcile optimistic insert dengan real record dari Supabase.
 * Dipanggil saat Realtime INSERT event diterima.
 */
export async function reconcileInsert(
    tableName: string,
    realRecord: Record<string, any>,
    pkField: string
): Promise<void> {
    const table = (db as any)[tableName]
    if (!table) return

    // Find pending records with _tempId
    const pendingRecords = await table.filter((r: any) => r._pending === true && r._tempId !== undefined).toArray()

    // Try to find a matching pending record
    // For simplicity, we match by comparing non-ID fields
    for (const pending of pendingRecords) {
        const isMatch = matchRecords(tableName, pending, realRecord)
        if (isMatch) {
            // Delete the temp record
            await table.delete(pending[pkField])
            break
        }
    }

    // Put the real record (this will update if exists or insert if new)
    await table.put(realRecord)
}

/**
 * Reconcile optimistic update dengan real record dari Supabase.
 * Dipanggil saat Realtime UPDATE event diterima.
 */
export async function reconcileUpdate(
    tableName: string,
    realRecord: Record<string, any>,
    pkField: string
): Promise<void> {
    const table = (db as any)[tableName]
    if (!table) return

    // Simply put the real record, overwriting any pending state
    await table.put(realRecord)
}

/**
 * Reconcile optimistic delete dengan Supabase DELETE event.
 * Dipanggil saat Realtime DELETE event diterima.
 */
export async function reconcileDelete(
    tableName: string,
    deletedId: number | string,
    pkField: string
): Promise<void> {
    const table = (db as any)[tableName]
    if (!table) return

    await table.delete(deletedId)
}

/**
 * Rollback optimistic operation jika Supabase menolak.
 * Dipanggil saat outbox entry gagal.
 */
export async function rollbackOptimistic(
    tableName: string,
    pkField: string,
    tempId: number,
    operation: 'insert' | 'update' | 'delete',
    originalData?: Record<string, any>
): Promise<void> {
    const table = (db as any)[tableName]
    if (!table) return

    if (operation === 'insert') {
        // Remove the temp record
        await table.delete(tempId)
    } else if (operation === 'update' && originalData) {
        // Restore original data
        await table.put(originalData)
    } else if (operation === 'delete' && originalData) {
        // Restore deleted record
        await table.put(originalData)
    }
}

/**
 * Match records to determine if they represent the same entity.
 * Used during reconciliation to find the temp record that matches the real one.
 */
function matchRecords(tableName: string, pending: any, real: any): boolean {
    switch (tableName) {
        case 'sales':
            return pending.nama_sales === real.nama_sales
        case 'produk':
            return pending.nama_produk === real.nama_produk && pending.harga_satuan === real.harga_satuan
        case 'toko':
            return pending.nama_toko === real.nama_toko && pending.id_sales === real.id_sales
        case 'setoran':
            return pending.total_setoran === real.total_setoran && pending.penerima_setoran === real.penerima_setoran
        case 'pengeluaran_operasional':
            return pending.keterangan === real.keterangan && pending.jumlah === real.jumlah
        case 'pengiriman':
            return pending.id_toko === real.id_toko && pending.tanggal_kirim === real.tanggal_kirim
        case 'penagihan':
            return pending.id_toko === real.id_toko && pending.total_uang_diterima === real.total_uang_diterima
        default:
            return false
    }
}

/**
 * Clean up any _pending and _deleted flags from records.
 * This is called internally after reconciliation.
 */
export async function cleanupPendingFlags(tableName: string, pkField: string, id: number | string): Promise<void> {
    const table = (db as any)[tableName]
    if (!table) return

    const record = await table.get(id)
    if (record && (record._pending || record._deleted || record._tempId)) {
        const cleaned = { ...record }
        delete cleaned._pending
        delete cleaned._deleted
        delete cleaned._tempId
        await table.put(cleaned)
    }
}
