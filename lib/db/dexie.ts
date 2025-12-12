/**
 * Dexie Database for Local Caching
 *
 * Architecture:
 * - Supabase is the source of truth
 * - Dexie (IndexedDB) is used for fast local reads
 * - Supabase Realtime keeps Dexie synced
 *
 * On app startup:
 * 1. Background fetch all data from Supabase
 * 2. Store in Dexie for instant access
 * 3. Subscribe to Realtime for live updates
 */

import Dexie, { type Table } from 'dexie'

// Types matching Supabase schema (base tables)
export interface Sales {
    id_sales: number
    nama_sales: string
    nomor_telepon: string | null
    status_aktif: boolean
    dibuat_pada: string
    diperbarui_pada: string
}

export interface Produk {
    id_produk: number
    nama_produk: string
    harga_satuan: number
    status_produk: boolean
    is_priority: boolean | null
    priority_order: number | null
    dibuat_pada: string
    diperbarui_pada: string
}

export interface Toko {
    id_toko: number
    id_sales: number
    nama_toko: string
    kecamatan: string | null
    kabupaten: string | null
    no_telepon: string | null
    link_gmaps: string | null
    status_toko: boolean
    dibuat_pada: string
    diperbarui_pada: string
}

export interface Pengiriman {
    id_pengiriman: number
    id_toko: number
    tanggal_kirim: string
    is_autorestock: boolean | null
    dibuat_pada: string
    diperbarui_pada: string
}

export interface DetailPengiriman {
    id_detail_kirim: number
    id_pengiriman: number
    id_produk: number
    jumlah_kirim: number
    dibuat_pada: string
    diperbarui_pada: string
}

export interface Penagihan {
    id_penagihan: number
    id_toko: number
    total_uang_diterima: number
    metode_pembayaran: 'Cash' | 'Transfer'
    ada_potongan: boolean
    dibuat_pada: string
    diperbarui_pada: string
}

export interface DetailPenagihan {
    id_detail_tagih: number
    id_penagihan: number
    id_produk: number
    jumlah_terjual: number
    jumlah_kembali: number
    dibuat_pada: string
    diperbarui_pada: string
}

export interface Setoran {
    id_setoran: number
    total_setoran: number
    penerima_setoran: string
    tanggal_setoran?: string
    dibuat_pada: string
    diperbarui_pada: string
}

export interface PengeluaranOperasional {
    id_pengeluaran: number
    jumlah: number
    keterangan: string
    url_bukti_foto: string | null
    tanggal_pengeluaran: string
    dibuat_pada: string
    diperbarui_pada: string
}

export interface PotonganPenagihan {
    id_potongan: number
    id_penagihan: number
    jumlah_potongan: number
    alasan: string | null
    dibuat_pada: string
    diperbarui_pada: string
}

export interface PublicToko {
    id_toko: number
    nama_toko: string
    kabupaten: string | null
    kecamatan: string | null
    link_gmaps: string | null
    latitude: number | null
    longitude: number | null
    alamat_gmaps: string | null
    alamat_fetched: boolean
    produk_tersedia: any | null
    diperbarui_pada: string
    fetch_attempts: number | null
    last_fetch_attempt: string | null
    fetch_disabled: boolean
    fetch_error_message: string | null
}

export interface SystemLog {
    id: number
    log_type: string
    message: string
    created_at: string
}

export interface SetoranDashboardBackup {
    id_setoran: number | null
    waktu_setoran: string | null
    tanggal_setoran: string | null
    total_setoran: number | null
    penerima_setoran: string | null
    pembayaran_cash_hari_ini: number | null
    pembayaran_transfer_hari_ini: number | null
    total_pembayaran_hari_ini: number | null
    selisih_cash_setoran: number | null
    status_setoran: string | null
    event_type: string | null
    description: string | null
    transaction_category: string | null
    nama_toko: string | null
    kecamatan: string | null
    kabupaten: string | null
    cash_balance_kumulatif: number | null
    jumlah_transaksi_cash: number | null
    jumlah_transaksi_transfer: number | null
    status_arus_kas: string | null
}

// Generic row type for Supabase views
export type ViewRow = Record<string, any>

// Sync metadata
export interface SyncMeta {
    id: string
    table_name: string
    last_synced: string
    record_count: number
}

// Outbox entries for offline-first CRUD
// insert/update/delete/rpc: generic operations untuk 1 tabel
// billing_*: bundled operations khusus penagihan + detail + potongan + shipment
export type OutboxOperation =
    | 'insert'
    | 'update'
    | 'delete'
    | 'rpc'
    | 'billing_create'
    | 'billing_update'
    | 'billing_delete'
    | 'shipment_create'
    | 'shipment_update'
    | 'shipment_delete'

export type OutboxStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface OutboxEntry {
    id?: number
    table: string
    operation: OutboxOperation
    payload: any
    primary_key_field?: string | null
    local_temp_id?: string | number | null
    status: OutboxStatus
    error_message?: string | null
    created_at: string
    updated_at: string
}

/**
 * Dexie Database Class
 */
export class CatatSalesDB extends Dexie {
    // Base tables
    sales!: Table<Sales, number>
    produk!: Table<Produk, number>
    toko!: Table<Toko, number>
    pengiriman!: Table<Pengiriman, number>
    detail_pengiriman!: Table<DetailPengiriman, number>
    penagihan!: Table<Penagihan, number>
    detail_penagihan!: Table<DetailPenagihan, number>
    setoran!: Table<Setoran, number>
    pengeluaran_operasional!: Table<PengeluaranOperasional, number>
    potongan_penagihan!: Table<PotonganPenagihan, number>
    public_toko!: Table<PublicToko, number>
    system_logs!: Table<SystemLog, number>
    v_setoran_dashboard_backup_data!: Table<SetoranDashboardBackup, number>
    v_setoran_dashboard_backup_safe!: Table<SetoranDashboardBackup, number>

    // View mirrors (read-only projections)
    fetch_attention_needed!: Table<ViewRow, number>
    fetch_status_summary!: Table<ViewRow, number>
    v_cash_flow_dashboard!: Table<ViewRow, number>
    v_cash_flow_events!: Table<ViewRow, number>
    v_chart_produk_performance!: Table<ViewRow, number>
    v_chart_sales_performance!: Table<ViewRow, number>
    v_chart_toko_performance!: Table<ViewRow, number>
    v_chart_wilayah_performance!: Table<ViewRow, number>
    v_dashboard_all_transactions!: Table<ViewRow, number>
    v_dashboard_cards!: Table<ViewRow, number>
    v_dashboard_latest_transactions!: Table<ViewRow, number>
    v_dashboard_overview!: Table<ViewRow, number>
    v_kabupaten_options!: Table<ViewRow, number>
    v_kecamatan_options!: Table<ViewRow, number>
    v_master_produk!: Table<ViewRow, number>
    v_master_sales!: Table<ViewRow, number>
    v_master_toko!: Table<ViewRow, number>
    v_penagihan_dashboard!: Table<ViewRow, number>
    v_pengiriman_dashboard!: Table<ViewRow, number>
    v_produk_options!: Table<ViewRow, number>
    v_rekonsiliasi_setoran!: Table<ViewRow, number>
    v_sales_options!: Table<ViewRow, number>
    v_setoran_dashboard!: Table<ViewRow, number>
    v_setoran_dashboard_fixed!: Table<ViewRow, number>
    v_toko_options!: Table<ViewRow, number>

    // Internal sync meta
    sync_meta!: Table<SyncMeta, string>
    outbox!: Table<OutboxEntry, number>

    constructor() {
        super('CatatSalesDB')

        // Version 1: base tables only (existing clients)
        this.version(1).stores({
            // Primary key first, then indexed fields
            sales: 'id_sales, nama_sales, status_aktif, diperbarui_pada',
            produk: 'id_produk, nama_produk, status_produk, is_priority, diperbarui_pada',
            toko: 'id_toko, id_sales, nama_toko, kabupaten, kecamatan, status_toko, diperbarui_pada',
            pengiriman: 'id_pengiriman, id_toko, tanggal_kirim, is_autorestock, diperbarui_pada',
            detail_pengiriman: 'id_detail_kirim, id_pengiriman, id_produk',
            penagihan: 'id_penagihan, id_toko, metode_pembayaran, dibuat_pada, diperbarui_pada',
            detail_penagihan: 'id_detail_tagih, id_penagihan, id_produk',
            setoran: 'id_setoran, penerima_setoran, dibuat_pada, diperbarui_pada',
            pengeluaran_operasional: 'id_pengeluaran, tanggal_pengeluaran, diperbarui_pada',
            potongan_penagihan: 'id_potongan, id_penagihan, dibuat_pada, diperbarui_pada',
            public_toko: 'id_toko, nama_toko, kabupaten, kecamatan, diperbarui_pada',
            system_logs: 'id, created_at',
            v_setoran_dashboard_backup_data: 'id_setoran, tanggal_setoran',
            v_setoran_dashboard_backup_safe: 'id_setoran, tanggal_setoran',
            sync_meta: 'id, table_name, last_synced',
            outbox: '++id, table, operation, status, created_at'
        })

        // Version 2: add full Supabase view mirrors
        this.version(2).stores({
            sales: 'id_sales, nama_sales, status_aktif, diperbarui_pada',
            produk: 'id_produk, nama_produk, status_produk, is_priority, diperbarui_pada',
            toko: 'id_toko, id_sales, nama_toko, kabupaten, kecamatan, status_toko, diperbarui_pada',
            pengiriman: 'id_pengiriman, id_toko, tanggal_kirim, is_autorestock, diperbarui_pada',
            detail_pengiriman: 'id_detail_kirim, id_pengiriman, id_produk',
            penagihan: 'id_penagihan, id_toko, metode_pembayaran, dibuat_pada, diperbarui_pada',
            detail_penagihan: 'id_detail_tagih, id_penagihan, id_produk',
            setoran: 'id_setoran, penerima_setoran, dibuat_pada, diperbarui_pada',
            pengeluaran_operasional: 'id_pengeluaran, tanggal_pengeluaran, diperbarui_pada',
            potongan_penagihan: 'id_potongan, id_penagihan, dibuat_pada, diperbarui_pada',
            public_toko: 'id_toko, nama_toko, kabupaten, kecamatan, diperbarui_pada',
            system_logs: 'id, created_at',
            v_setoran_dashboard_backup_data: 'id_setoran, tanggal_setoran',
            v_setoran_dashboard_backup_safe: 'id_setoran, tanggal_setoran',

            // View mirrors use an auto-incremented local key
            fetch_attention_needed: '++_id',
            fetch_status_summary: '++_id',
            v_cash_flow_dashboard: '++_id',
            v_cash_flow_events: '++_id',
            v_chart_produk_performance: '++_id',
            v_chart_sales_performance: '++_id',
            v_chart_toko_performance: '++_id',
            v_chart_wilayah_performance: '++_id',
            v_dashboard_all_transactions: '++_id',
            v_dashboard_cards: '++_id',
            v_dashboard_latest_transactions: '++_id',
            v_dashboard_overview: '++_id',
            v_kabupaten_options: '++_id',
            v_kecamatan_options: '++_id',
            v_master_produk: '++_id',
            v_master_sales: '++_id',
            v_master_toko: '++_id',
            v_penagihan_dashboard: '++_id',
            v_pengiriman_dashboard: '++_id',
            v_produk_options: '++_id',
            v_rekonsiliasi_setoran: '++_id',
            v_sales_options: '++_id',
            v_setoran_dashboard: '++_id',
            v_setoran_dashboard_fixed: '++_id',
            v_toko_options: '++_id',

            sync_meta: 'id, table_name, last_synced',
            outbox: '++id, table, operation, status, created_at'
        })
    }

    /**
     * Clear all data (for testing/reset)
     */
    async clearAll() {
        await Promise.all([
            // Base tables
            this.sales.clear(),
            this.produk.clear(),
            this.toko.clear(),
            this.pengiriman.clear(),
            this.detail_pengiriman.clear(),
            this.penagihan.clear(),
            this.detail_penagihan.clear(),
            this.setoran.clear(),
            this.pengeluaran_operasional.clear(),
            this.potongan_penagihan.clear(),
            this.public_toko.clear(),
            this.system_logs.clear(),
            this.v_setoran_dashboard_backup_data.clear(),
            this.v_setoran_dashboard_backup_safe.clear(),

            // Views
            this.fetch_attention_needed.clear(),
            this.fetch_status_summary.clear(),
            this.v_cash_flow_dashboard.clear(),
            this.v_cash_flow_events.clear(),
            this.v_chart_produk_performance.clear(),
            this.v_chart_sales_performance.clear(),
            this.v_chart_toko_performance.clear(),
            this.v_chart_wilayah_performance.clear(),
            this.v_dashboard_all_transactions.clear(),
            this.v_dashboard_cards.clear(),
            this.v_dashboard_latest_transactions.clear(),
            this.v_dashboard_overview.clear(),
            this.v_kabupaten_options.clear(),
            this.v_kecamatan_options.clear(),
            this.v_master_produk.clear(),
            this.v_master_sales.clear(),
            this.v_master_toko.clear(),
            this.v_penagihan_dashboard.clear(),
            this.v_pengiriman_dashboard.clear(),
            this.v_produk_options.clear(),
            this.v_rekonsiliasi_setoran.clear(),
            this.v_sales_options.clear(),
            this.v_setoran_dashboard.clear(),
            this.v_setoran_dashboard_fixed.clear(),
            this.v_toko_options.clear(),

            // Sync metadata
            this.sync_meta.clear(),
            this.outbox.clear()
        ])
    }

    /**
     * Get sync status for a table or view
     */
    async getSyncMeta(tableName: string): Promise<SyncMeta | undefined> {
        return this.sync_meta.get(tableName)
    }

    /**
     * Update sync status for a table or view
     */
    async updateSyncMeta(tableName: string, recordCount: number) {
        await this.sync_meta.put({
            id: tableName,
            table_name: tableName,
            last_synced: new Date().toISOString(),
            record_count: recordCount
        })
    }
}

// Singleton instance
export const db = new CatatSalesDB()
