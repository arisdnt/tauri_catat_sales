"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
    Calendar,
    Package,
    Plus,
    Save,
    Trash2,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import {
    usePengirimanDetailQuery,
    useUpdatePengirimanMutation,
} from "@/lib/queries/pengiriman"
import { useProdukQuery } from "@/lib/queries/produk"

interface DetailItem {
    id_produk: number
    jumlah_kirim: number
    produk?: {
        id_produk: number
        nama_produk: string
        harga_satuan: number
    }
}

interface PengirimanEditFormProps {
    id: number
    variant?: "page" | "modal"
    onSuccess?: () => void
    onCancel?: () => void
    formId?: string
    onSubmittingChange?: (submitting: boolean) => void
}

export function PengirimanEditForm({
    id,
    variant = "page",
    onSuccess,
    onCancel,
    formId,
    onSubmittingChange,
}: PengirimanEditFormProps) {
    const { data: response, isLoading, error } = usePengirimanDetailQuery(id)
    const { data: productsResponse } = useProdukQuery("active")
    const updateMutation = useUpdatePengirimanMutation()
    const isModal = variant === "modal"

    const pengiriman = (response as { data: any })?.data
    const products = useMemo(() => {
        const list =
            ((productsResponse as any)?.data?.data as Array<{
                id_produk: number
                nama_produk: string
                harga_satuan: number
            }>) || []
        return list
    }, [productsResponse])

    const [tanggalKirim, setTanggalKirim] = useState("")
    const [details, setDetails] = useState<DetailItem[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const resolvedFormId = useMemo(
        () => formId || `pengiriman-edit-form-${id}`,
        [formId, id],
    )

    useEffect(() => {
        if (pengiriman) {
            const dateValue =
                pengiriman.tanggal_kirim?.split("T")[0] ||
                pengiriman.tanggal_kirim?.slice(0, 10) ||
                ""
            setTanggalKirim(dateValue)
            setDetails(
                pengiriman.detail_pengiriman?.map((detail: any) => ({
                    id_produk: detail.produk.id_produk,
                    jumlah_kirim: detail.jumlah_kirim,
                    produk: detail.produk,
                })) || [],
            )
        }
    }, [pengiriman])

    useEffect(() => {
        onSubmittingChange?.(isSubmitting)
    }, [isSubmitting, onSubmittingChange])

    const totals = useMemo(() => {
        const totalQuantity = details.reduce(
            (sum, detail) => sum + (detail.jumlah_kirim || 0),
            0,
        )
        const totalValue = details.reduce((sum, detail) => {
            const product =
                detail.produk ||
                products.find((p) => p.id_produk === detail.id_produk)
            return sum + (detail.jumlah_kirim || 0) * (product?.harga_satuan || 0)
        }, 0)

        return { totalQuantity, totalValue }
    }, [details, products])

    const handleAddDetail = () => {
        setDetails((prev) => [...prev, { id_produk: 0, jumlah_kirim: 1 }])
    }

    const handleRemoveDetail = (index: number) => {
        setDetails((prev) => prev.filter((_, i) => i !== index))
    }

    const handleDetailChange = (
        index: number,
        field: keyof DetailItem,
        value: any,
    ) => {
        setDetails((prev) => {
            const next = [...prev]
            if (field === "id_produk") {
                const selected = products.find(
                    (p) => p.id_produk === parseInt(value),
                )
                next[index] = {
                    ...next[index],
                    id_produk: parseInt(value),
                    produk: selected,
                }
            } else {
                next[index] = {
                    ...next[index],
                    [field]:
                        field === "jumlah_kirim" ? parseInt(value) || 0 : value,
                }
            }
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!tanggalKirim || details.length === 0) {
            alert("Harap lengkapi semua field")
            return
        }

        const invalidDetails = details.some(
            (detail) => !detail.id_produk || detail.jumlah_kirim <= 0,
        )
        if (invalidDetails) {
            alert(
                "Harap pilih produk dan masukkan jumlah yang valid untuk semua item",
            )
            return
        }

        setIsSubmitting(true)
        try {
            await updateMutation.mutateAsync({
                id,
                data: {
                    tanggal_kirim: tanggalKirim,
                    details: details.map((detail) => ({
                        id_produk: detail.id_produk,
                        jumlah_kirim: detail.jumlah_kirim,
                    })),
                },
            })
            onSuccess?.()
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                Memuat data pengiriman...
            </div>
        )
    }

    if (error || !pengiriman) {
        return (
            <div className="space-y-3 py-6 text-sm">
                <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-400" />
                    <p className="font-semibold text-gray-900">
                        Pengiriman Tidak Ditemukan
                    </p>
                </div>
                <p className="text-gray-600">
                    Pengiriman dengan ID {id} tidak dapat ditemukan atau terjadi
                    kesalahan.
                </p>
                {onCancel && (
                    <Button variant="outline" size="sm" onClick={onCancel}>
                        Tutup
                    </Button>
                )}
            </div>
        )
    }

    return (
        <form
            id={resolvedFormId}
            onSubmit={handleSubmit}
            className={cn(isModal ? "space-y-4" : "space-y-6")}
        >
            {/* Summary */}
            <div
                className={cn(
                    "border border-gray-200 bg-white rounded-md",
                    isModal ? "p-3" : "p-4",
                )}
            >
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span
                        className={cn(
                            "font-semibold uppercase tracking-wide text-gray-700",
                            isModal ? "text-[11px]" : "text-xs",
                        )}
                    >
                        Informasi Pengiriman
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="font-medium text-gray-900">
                        #{pengiriman.id_pengiriman}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-900">
                        {pengiriman.toko.nama_toko} — {pengiriman.toko.kecamatan},{" "}
                        {pengiriman.toko.kabupaten}
                    </span>
                </div>

                <div
                    className={cn(
                        "mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3",
                        isModal ? "text-xs" : "text-sm",
                    )}
                >
                    <div className="border border-gray-100 rounded-md p-3 bg-gray-50">
                        <p className="text-[11px] text-gray-500 uppercase">
                            Tanggal Kirim
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <Input
                                type="date"
                                value={tanggalKirim}
                                onChange={(e) => setTanggalKirim(e.target.value)}
                                className={cn(
                                    "h-8",
                                    isModal ? "text-xs" : "text-sm",
                                )}
                                required
                            />
                        </div>
                    </div>
                    <div className="border border-gray-100 rounded-md p-3 bg-white">
                        <p className="text-[11px] text-gray-500 uppercase">
                            Total Produk
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                            {totals.totalQuantity} pcs
                        </p>
                    </div>
                    <div className="border border-gray-100 rounded-md p-3 bg-white">
                        <p className="text-[11px] text-gray-500 uppercase">
                            Nilai Barang
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(totals.totalValue)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Detail Items */}
            <div className="border border-gray-200 rounded-md bg-white">
                <div
                    className={cn(
                        "flex items-center justify-between border-b border-gray-200",
                        isModal ? "px-3 py-2" : "px-4 py-3",
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                            Detail Produk
                        </h3>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddDetail}
                        className="flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Tambah Produk
                    </Button>
                </div>

                <div className={cn(isModal ? "p-3" : "p-4", "space-y-3")}>
                    {details.length === 0 && (
                        <div className="text-center py-6 text-sm text-gray-500">
                            Belum ada produk. Tambahkan minimal satu produk.
                        </div>
                    )}

                    {details.map((detail, index) => (
                        <div
                            key={`detail-${index}`}
                            className="border border-gray-100 rounded-md bg-gray-50 p-3 space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-800">
                                    Produk {index + 1}
                                </p>
                                {details.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveDetail(index)}
                                        className="text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-gray-600 uppercase">
                                        Produk
                                    </Label>
                                    <Select
                                        value={detail.id_produk.toString()}
                                        onValueChange={(value) =>
                                            handleDetailChange(
                                                index,
                                                "id_produk",
                                                value,
                                            )
                                        }
                                    >
                                        <SelectTrigger className="mt-1 h-9">
                                            <SelectValue placeholder="Pilih produk" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">
                                                Pilih produk
                                            </SelectItem>
                                            {products.map((product) => (
                                                <SelectItem
                                                    key={product.id_produk}
                                                    value={product.id_produk.toString()}
                                                >
                                                    {product.nama_produk} —{" "}
                                                    {formatCurrency(
                                                        product.harga_satuan,
                                                    )}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="text-xs text-gray-600 uppercase">
                                        Jumlah Kirim
                                    </Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={detail.jumlah_kirim}
                                        onChange={(e) =>
                                            handleDetailChange(
                                                index,
                                                "jumlah_kirim",
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1 h-9"
                                    />
                                </div>
                            </div>

                            <Separator />
                            <div className="text-xs text-gray-600">
                                {detail.produk && (
                                    <p>
                                        Harga Satuan:{" "}
                                        <span className="font-semibold text-gray-900">
                                            {formatCurrency(
                                                detail.produk.harga_satuan,
                                            )}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {variant === "page" && (
                <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-md transition-colors"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Menyimpan...
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Simpan Perubahan
                        </div>
                    )}
                </Button>
            )}
        </form>
    )
}
