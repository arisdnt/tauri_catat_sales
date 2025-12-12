import { db, type OutboxEntry, type OutboxOperation } from './dexie'
import { supabase } from '@/lib/supabase'

/**
 * Dexie Outbox Utilities
 *
 * Tujuan:
 * - Semua operasi CRUD dari frontend dicatat ke Dexie (outbox)
 * - Worker di background mengirim outbox ke Supabase
 * - Supabase Realtime meng-update Dexie sebagai sumber kebenaran
 *
 * Catatan penting:
 * - Tidak mengubah skema database Supabase
 * - Outbox hanya hidup di Dexie (IndexedDB lokal)
 */

export interface QueueOptions {
    primaryKeyField?: string
    localTempId?: string | number
}

export async function queueOutboxEntry(
    table: string,
    operation: OutboxOperation,
    payload: any,
    options: QueueOptions = {}
): Promise<OutboxEntry> {
    const now = new Date().toISOString()

    const entry: OutboxEntry = {
        table,
        operation,
        payload,
        primary_key_field: options.primaryKeyField ?? null,
        local_temp_id: options.localTempId ?? null,
        status: 'pending',
        error_message: null,
        created_at: now,
        updated_at: now
    }

    const id = await db.outbox.add(entry)
    return { ...entry, id }
}

/**
 * Proses satu entry outbox.
 * Mengirim ke Supabase sesuai operasi (insert / update / delete / rpc).
 */
async function processSingleEntry(entry: OutboxEntry) {
    if (!entry.id) return

    await db.outbox.update(entry.id, {
        status: 'in_progress',
        updated_at: new Date().toISOString(),
        error_message: null
    })

    try {
        let error: any = null

        if (entry.operation === 'insert') {
            const { error: insertError } = await supabase
                .from(entry.table)
                .insert(entry.payload as any)

            error = insertError
        } else if (entry.operation === 'update') {
            const pkField = entry.primary_key_field
            const pkValue = pkField ? (entry.payload as any)[pkField] : undefined

            if (!pkField || pkValue === undefined || pkValue === null) {
                throw new Error(`Missing primary key for update on ${entry.table}`)
            }

            const { error: updateError } = await supabase
                .from(entry.table)
                .update(entry.payload as any)
                .eq(pkField, pkValue)

            error = updateError
        } else if (entry.operation === 'delete') {
            const pkField = entry.primary_key_field
            const pkValue = pkField ? (entry.payload as any)[pkField] : undefined

            if (!pkField || pkValue === undefined || pkValue === null) {
                throw new Error(`Missing primary key for delete on ${entry.table}`)
            }

            const { error: deleteError } = await supabase
                .from(entry.table)
                .delete()
                .eq(pkField, pkValue)

            error = deleteError
        } else if (entry.operation === 'rpc') {
            const { functionName, args } = (entry.payload || {}) as {
                functionName?: string
                args?: Record<string, any>
            }
            if (!functionName) {
                throw new Error('RPC operation requires functionName')
            }
            const { error: rpcError } = await supabase.rpc(functionName, args || {})
            error = rpcError
        } else if (entry.operation === 'billing_create') {
            const payload = entry.payload as {
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
            }

            // 1) Insert penagihan
            const { data: penagihan, error: penagihanError } = await supabase
                .from('penagihan')
                .insert([{
                    id_toko: payload.id_toko,
                    total_uang_diterima: payload.total_uang_diterima,
                    metode_pembayaran: payload.metode_pembayaran
                }])
                .select()
                .single()

            if (penagihanError) {
                error = penagihanError
            } else {
                // 2) Insert detail_penagihan
                const detailData = (payload.details || []).map(d => ({
                    id_penagihan: (penagihan as any).id_penagihan,
                    id_produk: d.id_produk,
                    jumlah_terjual: d.jumlah_terjual,
                    jumlah_kembali: d.jumlah_kembali
                }))

                if (detailData.length > 0) {
                    const { error: detailError } = await supabase
                        .from('detail_penagihan')
                        .insert(detailData)
                    if (detailError) {
                        error = detailError
                    }
                }

                // 3) Insert potongan jika ada
                if (!error && payload.potongan && payload.potongan.jumlah_potongan > 0) {
                    const { error: potonganError } = await supabase
                        .from('potongan')
                        .insert([{
                            id_penagihan: (penagihan as any).id_penagihan,
                            jumlah_potongan: payload.potongan.jumlah_potongan,
                            alasan: payload.potongan.alasan || null
                        }])
                    if (potonganError) {
                        error = potonganError
                    }
                }

                // 4) Auto-restock shipment (berdasarkan jumlah_kembali)
                if (!error && payload.auto_restock) {
                    const returnedItems = (payload.details || []).filter(d => d.jumlah_kembali > 0)
                    if (returnedItems.length > 0) {
                        const today = new Date()
                        const tanggal = today.toISOString().split('T')[0]

                        const { data: pengiriman, error: pengirimanError } = await supabase
                            .from('pengiriman')
                            .insert([{
                                id_toko: payload.id_toko,
                                tanggal_kirim: tanggal,
                                is_autorestock: true
                            }])
                            .select()
                            .single()

                        if (pengirimanError) {
                            error = pengirimanError
                        } else if (pengiriman) {
                            const restockDetails = returnedItems.map(d => ({
                                id_pengiriman: (pengiriman as any).id_pengiriman,
                                id_produk: d.id_produk,
                                jumlah_kirim: d.jumlah_kembali
                            }))

                            const { error: restockError } = await supabase
                                .from('detail_pengiriman')
                                .insert(restockDetails)
                            if (restockError) {
                                error = restockError
                            }
                        }
                    }
                }

                // 5) Additional shipment
                if (!error && payload.additional_shipment?.enabled && payload.additional_shipment.details.length > 0) {
                    const today = new Date()
                    const tanggal = today.toISOString().split('T')[0]

                    const { data: pengiriman, error: pengirimanError } = await supabase
                        .from('pengiriman')
                        .insert([{
                            id_toko: payload.id_toko,
                            tanggal_kirim: tanggal
                        }])
                        .select()
                        .single()

                    if (pengirimanError) {
                        error = pengirimanError
                    } else if (pengiriman) {
                        const shipmentDetails = payload.additional_shipment.details.map(d => ({
                            id_pengiriman: (pengiriman as any).id_pengiriman,
                            id_produk: d.id_produk,
                            jumlah_kirim: d.jumlah_kirim
                        }))

                        const { error: shipmentError } = await supabase
                            .from('detail_pengiriman')
                            .insert(shipmentDetails)
                        if (shipmentError) {
                            error = shipmentError
                        }
                    }
                }
            }
        } else if (entry.operation === 'billing_update') {
            const payload = entry.payload as {
                id_penagihan: number
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

            // Update penagihan
            const { error: updateError } = await supabase
                .from('penagihan')
                .update({
                    total_uang_diterima: payload.total_uang_diterima,
                    metode_pembayaran: payload.metode_pembayaran
                })
                .eq('id_penagihan', payload.id_penagihan)

            if (updateError) {
                error = updateError
            } else {
                // Hapus detail & potongan lama
                const { error: delDetailErr } = await supabase
                    .from('detail_penagihan')
                    .delete()
                    .eq('id_penagihan', payload.id_penagihan)
                if (delDetailErr) {
                    error = delDetailErr
                }

                const { error: delPotErr } = await supabase
                    .from('potongan')
                    .delete()
                    .eq('id_penagihan', payload.id_penagihan)
                if (delPotErr) {
                    error = delPotErr
                }

                // Insert detail baru
                if (!error) {
                    const detailData = (payload.details || []).map(d => ({
                        id_penagihan: payload.id_penagihan,
                        id_produk: d.id_produk,
                        jumlah_terjual: d.jumlah_terjual,
                        jumlah_kembali: d.jumlah_kembali
                    }))

                    if (detailData.length > 0) {
                        const { error: detailError } = await supabase
                            .from('detail_penagihan')
                            .insert(detailData)
                        if (detailError) {
                            error = detailError
                        }
                    }
                }

                // Insert potongan baru jika ada
                if (!error && payload.potongan && payload.potongan.jumlah_potongan > 0) {
                    const { error: potonganError } = await supabase
                        .from('potongan')
                        .insert([{
                            id_penagihan: payload.id_penagihan,
                            jumlah_potongan: payload.potongan.jumlah_potongan,
                            alasan: payload.potongan.alasan || null
                        }])
                    if (potonganError) {
                        error = potonganError
                    }
                }
            }
        } else if (entry.operation === 'billing_delete') {
            const payload = entry.payload as { id_penagihan: number }

            // Hapus potongan dan detail terlebih dahulu
            const { error: delPotErr } = await supabase
                .from('potongan')
                .delete()
                .eq('id_penagihan', payload.id_penagihan)
            if (delPotErr) {
                error = delPotErr
            }

            const { error: delDetailErr } = await supabase
                .from('detail_penagihan')
                .delete()
                .eq('id_penagihan', payload.id_penagihan)
            if (delDetailErr) {
                error = delDetailErr
            }

            if (!error) {
                const { error: delMainErr } = await supabase
                    .from('penagihan')
                    .delete()
                    .eq('id_penagihan', payload.id_penagihan)
                if (delMainErr) {
                    error = delMainErr
                }
            }
        } else if (entry.operation === 'shipment_create') {
            const payload = entry.payload as {
                id_toko: number
                tanggal_kirim: string
                details: Array<{
                    id_produk: number
                    jumlah_kirim: number
                }>
            }

            const { data: pengiriman, error: pengirimanError } = await supabase
                .from('pengiriman')
                .insert([{
                    id_toko: payload.id_toko,
                    tanggal_kirim: payload.tanggal_kirim
                }])
                .select()
                .single()

            if (pengirimanError) {
                error = pengirimanError
            } else if (pengiriman && payload.details && payload.details.length > 0) {
                const detailData = payload.details.map(d => ({
                    id_pengiriman: (pengiriman as any).id_pengiriman,
                    id_produk: d.id_produk,
                    jumlah_kirim: d.jumlah_kirim
                }))

                const { error: detailError } = await supabase
                    .from('detail_pengiriman')
                    .insert(detailData)

                if (detailError) {
                    error = detailError
                }
            }
        } else if (entry.operation === 'shipment_update') {
            const payload = entry.payload as {
                id_pengiriman: number
                tanggal_kirim: string
                details: Array<{
                    id_produk: number
                    jumlah_kirim: number
                }>
            }

            // Update pengiriman
            const { error: updateError } = await supabase
                .from('pengiriman')
                .update({ tanggal_kirim: payload.tanggal_kirim })
                .eq('id_pengiriman', payload.id_pengiriman)

            if (updateError) {
                error = updateError
            } else {
                // Hapus detail lama
                const { error: delDetailErr } = await supabase
                    .from('detail_pengiriman')
                    .delete()
                    .eq('id_pengiriman', payload.id_pengiriman)

                if (delDetailErr) {
                    error = delDetailErr
                } else if (payload.details && payload.details.length > 0) {
                    const detailData = payload.details.map(d => ({
                        id_pengiriman: payload.id_pengiriman,
                        id_produk: d.id_produk,
                        jumlah_kirim: d.jumlah_kirim
                    }))

                    const { error: detailError } = await supabase
                        .from('detail_pengiriman')
                        .insert(detailData)

                    if (detailError) {
                        error = detailError
                    }
                }
            }
        } else if (entry.operation === 'shipment_delete') {
            const payload = entry.payload as { id_pengiriman: number }

            const { error: delDetailErr } = await supabase
                .from('detail_pengiriman')
                .delete()
                .eq('id_pengiriman', payload.id_pengiriman)

            if (delDetailErr) {
                error = delDetailErr
            } else {
                const { error: delMainErr } = await supabase
                    .from('pengiriman')
                    .delete()
                    .eq('id_pengiriman', payload.id_pengiriman)

                if (delMainErr) {
                    error = delMainErr
                }
            }
        }

        if (error) {
            throw error
        }

        // Berhasil
        await db.outbox.update(entry.id, {
            status: 'completed',
            updated_at: new Date().toISOString(),
            error_message: null
        })
    } catch (err: any) {
        await db.outbox.update(entry.id, {
            status: 'failed',
            updated_at: new Date().toISOString(),
            error_message: err?.message ?? String(err)
        })
        throw err
    }
}

/**
 * Proses semua entry outbox berstatus pending/failed (simple retry).
 * Dipanggil dari SyncProvider atau event lain (misal tombol "Sync").
 */
export async function processOutboxBatch(limit = 20) {
    const pending = await db.outbox
        .where('status')
        .anyOf(['pending', 'failed'])
        .limit(limit)
        .toArray()

    for (const entry of pending) {
        try {
            await processSingleEntry(entry)
        } catch {
            // Jangan lempar error ke atas; biarkan iterasi lanjut
        }
    }
}

/**
 * Mulai worker periodic yang memproses outbox secara berkala.
 * Dipanggil sekali dari SyncProvider.
 */
let outboxInterval: number | null = null

export function startOutboxWorker(intervalMs = 3000) {
    if (typeof window === 'undefined') return
    if (outboxInterval !== null) return

    outboxInterval = window.setInterval(() => {
        processOutboxBatch().catch(err => {
            console.error('[Outbox] batch error:', err)
        })
    }, intervalMs)
}

export function stopOutboxWorker() {
    if (typeof window === 'undefined') return
    if (outboxInterval !== null) {
        window.clearInterval(outboxInterval)
        outboxInterval = null
    }
}
