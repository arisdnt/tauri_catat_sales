"use client"

import { MasterProduk } from "@/lib/queries/dashboard"
import { formatCurrency } from "@/lib/form-utils"

function formatNumber(value?: number | null) {
    return new Intl.NumberFormat("id-ID").format(value ?? 0)
}

interface ProdukDetailPanelProps {
    produk?: MasterProduk | null
    detailRecord?: {
        nama_produk?: string
        harga_satuan?: number
        status_produk?: boolean
        is_priority?: boolean
        priority_order?: number
        dibuat_pada?: string
        diperbarui_pada?: string
    } | null
}

function DetailRow({
    label,
    value,
    variant,
}: {
    label: string
    value?: string
    variant: "base" | "alt"
}) {
    return (
        <div
            className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                variant === "alt" ? "bg-gray-50" : "bg-white"
            }`}
        >
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900 text-right">
                {value ?? "-"}
            </span>
        </div>
    )
}

export function ProdukDetailPanel({
    produk,
    detailRecord,
}: ProdukDetailPanelProps) {
    if (!produk && !detailRecord) {
        return (
            <p className="text-sm text-gray-500">
                Data produk tidak tersedia.
            </p>
        )
    }

    const merged = {
        ...produk,
        ...detailRecord,
    }

    const basicRows = [
        { label: "Nama Produk", value: merged.nama_produk },
        { label: "ID Produk", value: merged.id_produk ? `#${merged.id_produk}` : "-" },
        { label: "Harga Satuan", value: formatCurrency(merged.harga_satuan || 0) },
        { label: "Status", value: merged.status_produk ? "Aktif" : "Tidak Aktif" },
        {
            label: "Priority",
            value: merged.is_priority
                ? `Ya (urutan ${merged.priority_order ?? 0})`
                : "Tidak",
        },
    ]

    const statsRows = [
        {
            label: "Total Dikirim",
            value: `${formatNumber(merged.total_dikirim)} unit`,
        },
        {
            label: "Nilai Dikirim",
            value: formatCurrency(merged.nilai_total_dikirim || 0),
        },
        {
            label: "Total Terjual",
            value: `${formatNumber(merged.total_terjual)} unit`,
        },
        {
            label: "Nilai Terjual",
            value: formatCurrency(merged.nilai_total_terjual || 0),
        },
        {
            label: "Sisa Stok",
            value: `${formatNumber(merged.stok_di_toko)} unit`,
        },
        {
            label: "Total Dikembalikan",
            value: `${formatNumber(merged.total_dikembalikan)} unit`,
        },
    ]

    const paymentRows = [
        {
            label: "Total Dibayar",
            value: formatCurrency(merged.total_dibayar || 0),
        },
        {
            label: "Cash",
            value: formatCurrency(merged.total_dibayar_cash || 0),
        },
        {
            label: "Transfer",
            value: formatCurrency(merged.total_dibayar_transfer || 0),
        },
    ]

    const allRows = [...basicRows, ...statsRows, ...paymentRows]

    return (
        <div className="space-y-1">
            {allRows.map((row, idx) => (
                <DetailRow
                    key={`${row.label}-${idx}`}
                    label={row.label}
                    value={row.value}
                    variant={idx % 2 === 0 ? "base" : "alt"}
                />
            ))}
        </div>
    )
}
