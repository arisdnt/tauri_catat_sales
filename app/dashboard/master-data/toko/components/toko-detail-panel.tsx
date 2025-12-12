"use client"

import { MasterToko } from "@/lib/queries/dashboard"
import { Toko } from "@/lib/queries/toko"
import { formatCurrency } from "@/lib/form-utils"

function formatNumber(value?: number | null) {
    return new Intl.NumberFormat("id-ID").format(value ?? 0)
}

interface TokoDetailPanelProps {
    toko?: MasterToko | null
    detailData?: Toko | null
}

function DetailRow({
    label,
    value,
    variant,
}: {
    label: string
    value?: string | null
    variant: "base" | "alt"
}) {
    return (
        <div
            className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                variant === "alt" ? "bg-gray-50" : "bg-white"
            }`}
        >
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900 text-right max-w-[55%] truncate">
                {value && value !== "" ? value : "-"}
            </span>
        </div>
    )
}

export function TokoDetailPanel({ toko, detailData }: TokoDetailPanelProps) {
    if (!toko && !detailData) {
        return (
            <p className="text-sm text-gray-500">
                Data toko tidak tersedia.
            </p>
        )
    }

    const merged: Partial<MasterToko & Toko> = {
        ...toko,
        ...detailData,
        nama_sales:
            toko?.nama_sales ||
            detailData?.sales?.nama_sales ||
            detailData?.nama_sales,
        telepon_sales:
            toko?.telepon_sales ||
            detailData?.sales?.nomor_telepon ||
            (detailData as any)?.telepon_sales,
    }

    const infoRows = [
        { label: "Nama Toko", value: merged.nama_toko },
        { label: "Kabupaten", value: merged.kabupaten },
        { label: "Kecamatan", value: merged.kecamatan },
        { label: "No. Telepon", value: merged.no_telepon },
        {
            label: "Link Maps",
            value: merged.link_gmaps,
        },
        { label: "Sales", value: merged.nama_sales },
        { label: "Telepon Sales", value: merged.telepon_sales },
        {
            label: "Status",
            value: merged.status_toko ? "Aktif" : "Tidak Aktif",
        },
    ]

    const statRows = [
        {
            label: "Barang Dikirim",
            value: `${formatNumber(
                (merged as any).quantity_shipped ??
                    merged.barang_terkirim ??
                    0,
            )} unit`,
        },
        {
            label: "Barang Terjual",
            value: `${formatNumber(
                (merged as any).quantity_sold ?? merged.barang_terbayar ?? 0,
            )} unit`,
        },
        {
            label: "Sisa Stok",
            value: `${formatNumber(
                (merged as any).remaining_stock ?? merged.sisa_stok ?? 0,
            )} unit`,
        },
        {
            label: "Total Pendapatan",
            value: formatCurrency(
                (merged as any).total_revenue ?? merged.total_uang_diterima ?? 0,
            ),
        },
    ]

    const rows = [...infoRows, ...statRows]

    return (
        <div className="space-y-1">
            {rows.map((row, idx) => (
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
