"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import {
    ArrowLeft,
    Save,
    Receipt,
    Store,
    User,
    MapPin,
    CreditCard,
    Package,
    Plus,
    Trash2,
    AlertTriangle,
    DollarSign,
} from "lucide-react"
import {
    usePenagihanDetailQuery,
    useUpdatePenagihanMutation,
    type UpdatePenagihanData,
} from "@/lib/queries/penagihan"
import { useProdukQuery } from "@/lib/queries/produk"
import { useNavigation } from "@/lib/hooks/use-navigation"
import { cn, formatCurrency } from "@/lib/utils"

interface ProductDetail {
    id_detail_tagih?: number
    id_produk: number
    jumlah_terjual: number
    jumlah_kembali: number
    produk?: {
        id_produk: number
        nama_produk: string
        harga_satuan: number
    }
}

interface FormData {
    total_uang_diterima: number
    metode_pembayaran: "Cash" | "Transfer"
    details: ProductDetail[]
    ada_potongan: boolean
    potongan?: {
        jumlah_potongan: number
        alasan?: string
    }
}

interface PenagihanEditFormProps {
    id: number
    variant?: "page" | "modal"
    onSuccess?: () => void
    onCancel?: () => void
    formId?: string
    onSubmittingChange?: (submitting: boolean) => void
    initialMetodePembayaran?: string | null
}

export function PenagihanEditForm({
    id,
    variant = "page",
    onSuccess,
    onCancel,
    formId,
    onSubmittingChange,
    initialMetodePembayaran,
}: PenagihanEditFormProps) {
    const { navigate } = useNavigation()
    const { toast } = useToast()
    const { data: response, isLoading, error } = usePenagihanDetailQuery(id)
    const { data: productsResponse } = useProdukQuery()
    const updatePenagihan = useUpdatePenagihanMutation()
    const isModal = variant === "modal"
    const inputSizeClass = isModal ? "h-8 text-sm" : "h-9"
    const sectionPadding = isModal ? "p-3" : "p-4"
    const blockSpacing = isModal ? "space-y-3" : "space-y-4"
    const gridGap = isModal ? "gap-3" : "gap-4"

    const normalizePaymentMethod = (method?: string | null): "Cash" | "Transfer" => {
        if (!method) return "Cash"
        const normalized = method.trim().toLowerCase()
        return normalized.startsWith("transfer") ? "Transfer" : "Cash"
    }
    const penagihan = (response as { data: any })?.data
    const products = useMemo(() => {
        const data =
            ((productsResponse as any)?.data?.data as Array<{
                id_produk: number
                nama_produk: string
                harga_satuan: number
            }>) || []
        return data
    }, [productsResponse])

    const [formData, setFormData] = useState<FormData>({
        total_uang_diterima: 0,
        metode_pembayaran: normalizePaymentMethod(initialMetodePembayaran),
        details: [],
        ada_potongan: false,
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const resolvedFormId = useMemo(
        () => formId || `penagihan-edit-form-${id}`,
        [formId, id],
    )

    // Auto-update toggle
    const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false)

    // Initialize form data when penagihan data is loaded
    useEffect(() => {
        if (penagihan) {
            setFormData({
                total_uang_diterima: penagihan.total_uang_diterima,
                metode_pembayaran: normalizePaymentMethod(
                    penagihan.metode_pembayaran,
                ),
                details: penagihan.detail_penagihan.map((detail: any) => ({
                    id_detail_tagih: detail.id_detail_tagih,
                    id_produk: detail.produk.id_produk,
                    jumlah_terjual: detail.jumlah_terjual,
                    jumlah_kembali: detail.jumlah_kembali,
                    produk: detail.produk,
                })),
                ada_potongan: penagihan.ada_potongan,
                potongan: penagihan.potongan_penagihan?.[0]
                    ? {
                        jumlah_potongan:
                            penagihan.potongan_penagihan[0].jumlah_potongan,
                        alasan: penagihan.potongan_penagihan[0].alasan,
                    }
                    : undefined,
            })
        }
    }, [penagihan])

    useEffect(() => {
        if (!penagihan && initialMetodePembayaran) {
            setFormData(prev => ({
                ...prev,
                metode_pembayaran: normalizePaymentMethod(
                    initialMetodePembayaran,
                ),
            }))
        }
    }, [initialMetodePembayaran, penagihan])

    // Debug: Log formData.metode_pembayaran changes
    useEffect(() => {
        console.log('🔍 DEBUG: formData.metode_pembayaran changed to:', formData.metode_pembayaran)
    }, [formData.metode_pembayaran])

    const getProductData = (detail: ProductDetail) => {
        return (
            products.find((p) => p.id_produk === detail.id_produk) ||
            detail.produk
        )
    }

    const calculations = useMemo(() => {
        const subtotal = formData.details.reduce((sum, detail) => {
            const productData = getProductData(detail)
            const price = productData?.harga_satuan || 0
            return sum + detail.jumlah_terjual * price
        }, 0)

        const discount = formData.ada_potongan
            ? formData.potongan?.jumlah_potongan || 0
            : 0
        const calculatedTotal = subtotal - discount

        return {
            subtotal,
            discount,
            calculatedTotal,
        }
    }, [formData.details, formData.ada_potongan, formData.potongan, products])

    // Auto-fill total uang diterima based on calculated total
    const autoFillTotalUangDiterima = () => {
        setFormData((prev) => ({
            ...prev,
            total_uang_diterima: calculations.calculatedTotal,
        }))
    }

    // Check if current total differs from calculated total
    const isDifferentFromCalculated =
        Math.abs(
            formData.total_uang_diterima - calculations.calculatedTotal,
        ) > 0.01

    // Auto-update total uang diterima when details or discount changes (optional)
    useEffect(() => {
        if (autoUpdateEnabled && calculations.calculatedTotal > 0) {
            setFormData((prev) => ({
                ...prev,
                total_uang_diterima: calculations.calculatedTotal,
            }))
        }
    }, [calculations.calculatedTotal, autoUpdateEnabled])

    const addProductDetail = () => {
        setFormData((prev) => ({
            ...prev,
            details: [
                ...prev.details,
                {
                    id_produk: 0,
                    jumlah_terjual: 0,
                    jumlah_kembali: 0,
                },
            ],
        }))
    }

    const removeProductDetail = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            details: prev.details.filter((_, i) => i !== index),
        }))
    }

    const updateProductDetail = (
        index: number,
        field: keyof ProductDetail,
        value: string | number,
    ) => {
        setFormData((prev) => {
            const newDetails = [...prev.details]
            newDetails[index] = {
                ...newDetails[index],
                [field]: value,
            }

            // Update product info when product is selected
            if (field === "id_produk") {
                const product = products.find(
                    (p) => p.id_produk === value,
                )
                if (product) {
                    newDetails[index].produk = product
                }
            }

            return {
                ...prev,
                details: newDetails,
            }
        })
    }

    const validateForm = (): string | null => {
        if (formData.details.length === 0) {
            return "Minimal harus ada satu detail produk"
        }

        for (let i = 0; i < formData.details.length; i++) {
            const detail = formData.details[i]
            if (detail.id_produk === 0) {
                return `Produk pada baris ${i + 1} harus dipilih`
            }
            if (detail.jumlah_terjual < 0) {
                return `Jumlah terjual pada baris ${i + 1
                    } tidak boleh negatif`
            }
            if (detail.jumlah_kembali < 0) {
                return `Jumlah kembali pada baris ${i + 1
                    } tidak boleh negatif`
            }
        }

        if (formData.total_uang_diterima < 0) {
            return "Total uang diterima tidak boleh negatif"
        }

        if (
            formData.ada_potongan &&
            (!formData.potongan ||
                formData.potongan.jumlah_potongan < 0)
        ) {
            return "Jumlah potongan tidak boleh negatif"
        }

        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const validationError = validateForm()
        if (validationError) {
            toast({
                title: "Error",
                description: validationError,
                variant: "destructive",
            })
            return
        }

        setIsSubmitting(true)

        try {
            const updateData: UpdatePenagihanData = {
                total_uang_diterima: formData.total_uang_diterima,
                metode_pembayaran: formData.metode_pembayaran,
                details: formData.details.map((detail) => ({
                    id_produk: detail.id_produk,
                    jumlah_terjual: detail.jumlah_terjual,
                    jumlah_kembali: detail.jumlah_kembali,
                })),
                potongan:
                    formData.ada_potongan && formData.potongan
                        ? {
                            jumlah_potongan:
                                formData.potongan.jumlah_potongan,
                            alasan: formData.potongan.alasan,
                        }
                        : undefined,
            }

            await updatePenagihan.mutateAsync({ id, data: updateData })

            toast({
                title: "Berhasil",
                description: "Penagihan berhasil diperbarui",
            })

            if (variant === "page") {
                navigate("/dashboard/penagihan")
            } else if (onSuccess) {
                onSuccess()
            }
        } catch (err: unknown) {
            toast({
                title: "Error",
                description:
                    err instanceof Error
                        ? err.message
                        : "Terjadi kesalahan saat memperbarui penagihan",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    useEffect(() => {
        onSubmittingChange?.(isSubmitting)
    }, [isSubmitting, onSubmittingChange])

    if (isLoading) {
        if (variant === "modal") {
            return (
                <div className="flex h-full items-center justify-center py-6 text-sm text-gray-500">
                    Memuat data penagihan...
                </div>
            )
        }

        return (
            <div className="w-full bg-white min-h-screen">
                <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="animate-pulse space-y-6">
                        <div className="h-8 bg-gray-200 rounded w-1/3" />
                        <div className="h-64 bg-gray-200 rounded-lg" />
                        <div className="h-96 bg-gray-200 rounded-lg" />
                    </div>
                </div>
            </div>
        )
    }

    if (error || !penagihan) {
        if (variant === "modal") {
            return (
                <div className="space-y-3 py-6 text-sm">
                    <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-gray-400" />
                        <p className="font-semibold text-gray-900">
                            Penagihan Tidak Ditemukan
                        </p>
                    </div>
                    <p className="text-gray-600">
                        Penagihan dengan ID {id} tidak dapat ditemukan atau
                        terjadi kesalahan.
                    </p>
                    {onCancel && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                        >
                            Tutup
                        </Button>
                    )}
                </div>
            )
        }

        return (
            <div className="w-full bg-white min-h-screen">
                <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="text-center py-12">
                        <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                            Penagihan Tidak Ditemukan
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Penagihan dengan ID {id} tidak dapat ditemukan atau
                            terjadi kesalahan.
                        </p>
                        <Button
                            onClick={() =>
                                navigate("/dashboard/penagihan")
                            }
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Kembali ke Daftar Penagihan
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    const formBody = (
        <form
            id={resolvedFormId}
            onSubmit={handleSubmit}
            className={cn(isModal ? "space-y-4" : "space-y-6")}
        >
            {/* Store Information (Compact Read-only) */}
            <div
                className={cn(
                    "bg-white border border-gray-200 rounded-md",
                    isModal ? "p-3" : "p-4",
                    isModal ? "mb-0" : "mb-6",
                )}
            >
                <div
                    className={cn(
                        "flex flex-wrap items-center gap-2 text-sm text-gray-700",
                        isModal ? "text-[13px]" : "",
                    )}
                >
                    <span
                        className={cn(
                            "font-semibold uppercase tracking-wide text-gray-700",
                            isModal ? "text-[11px]" : "text-xs",
                        )}
                    >
                        Informasi Toko
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Store className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-500">Toko:</span>
                        <span className="font-medium text-gray-900">
                            {penagihan.toko.nama_toko}
                        </span>
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <User className="w-4 h-4 text-green-600" />
                        <span className="text-gray-500">Sales:</span>
                        <span className="font-medium text-gray-900">
                            {penagihan.toko.sales.nama_sales}
                        </span>
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <MapPin className="w-4 h-4 text-orange-600" />
                        <span className="text-gray-500">Lokasi:</span>
                        <span className="font-medium text-gray-900">
                            {penagihan.toko.kecamatan}, {penagihan.toko.kabupaten}
                        </span>
                    </span>
                </div>
            </div>

            <div
                className={cn(
                    "grid grid-cols-1 lg:grid-cols-3",
                    isModal ? "gap-4" : "gap-6",
                )}
            >
                {/* Main Content */}
                <div
                    className={cn(
                        "lg:col-span-2",
                        isModal ? "space-y-4" : "space-y-6",
                    )}
                >
                    {/* Product Details */}
                    <div className="bg-white border border-gray-200 rounded-md">
                        <div className={cn("border-b border-gray-200", sectionPadding)}>
                            <div
                                className={cn(
                                    "flex items-center justify-between",
                                    isModal && "gap-2",
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <Package className="w-5 h-5 text-blue-600" />
                                    <h3
                                        className={cn(
                                            "font-semibold text-gray-900",
                                            isModal ? "text-base" : "text-lg",
                                        )}
                                    >
                                        Detail Produk
                                    </h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addProductDetail}
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Tambah Produk
                                </Button>
                            </div>
                        </div>
                        <div className={sectionPadding}>
                            <div className={cn(blockSpacing)}>
                                {formData.details.map(
                                    (detail, index) => {
                                        const product = getProductData(detail)
                                        return (
                                            <div
                                                key={index}
                                                className={cn(
                                                    "bg-gray-50 border border-gray-100 rounded-md",
                                                    isModal ? "p-3" : "p-4",
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "flex items-center justify-between",
                                                        isModal ? "mb-3" : "mb-4",
                                                    )}
                                                >
                                                    <h4
                                                        className={cn(
                                                            "font-semibold text-gray-700",
                                                            isModal ? "text-xs" : "text-sm",
                                                        )}
                                                    >
                                                        Produk {index + 1}
                                                    </h4>
                                                    {formData.details
                                                        .length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    removeProductDetail(
                                                                        index,
                                                                    )
                                                                }
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                </div>

                                                <div
                                                    className={cn(
                                                        "grid grid-cols-1 md:grid-cols-4",
                                                        gridGap,
                                                    )}
                                                >
                                                    <div className="md:col-span-2">
                                                        <Label
                                                            htmlFor={`product-${index}`}
                                                            className={cn(
                                                                "font-medium text-gray-600 uppercase tracking-wide",
                                                                isModal ? "text-[11px]" : "text-xs",
                                                            )}
                                                        >
                                                            Produk
                                                        </Label>
                                                        <Select
                                                            value={detail.id_produk.toString()}
                                                            onValueChange={(
                                                                value,
                                                            ) =>
                                                                updateProductDetail(
                                                                    index,
                                                                    "id_produk",
                                                                    parseInt(
                                                                        value,
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                className={cn(
                                                                    "mt-1",
                                                                    inputSizeClass,
                                                                )}
                                                            >
                                                                <SelectValue placeholder="Pilih produk" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="0">
                                                                    Pilih
                                                                    produk
                                                                </SelectItem>
                                                                {products.map(
                                                                    (
                                                                        product,
                                                                    ) => (
                                                                        <SelectItem
                                                                            key={
                                                                                product.id_produk
                                                                            }
                                                                            value={product.id_produk.toString()}
                                                                        >
                                                                            {
                                                                                product.nama_produk
                                                                            }{" "}
                                                                            -{" "}
                                                                            {formatCurrency(
                                                                                product.harga_satuan,
                                                                            )}
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div>
                                                        <Label
                                                            htmlFor={`sold-${index}`}
                                                            className={cn(
                                                                "font-medium text-gray-600 uppercase tracking-wide",
                                                                isModal ? "text-[11px]" : "text-xs",
                                                            )}
                                                        >
                                                            Terjual
                                                        </Label>
                                                        <Input
                                                            id={`sold-${index}`}
                                                            type="number"
                                                            min="0"
                                                            value={
                                                                detail.jumlah_terjual
                                                            }
                                                            onChange={(
                                                                e,
                                                            ) => {
                                                                updateProductDetail(
                                                                    index,
                                                                    "jumlah_terjual",
                                                                    parseInt(
                                                                        e
                                                                            .target
                                                                            .value,
                                                                    ) || 0,
                                                                )
                                                            }}
                                                            className={cn("mt-1", inputSizeClass)}
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label
                                                            htmlFor={`returned-${index}`}
                                                            className={cn(
                                                                "font-medium text-gray-600 uppercase tracking-wide",
                                                                isModal ? "text-[11px]" : "text-xs",
                                                            )}
                                                        >
                                                            Kembali
                                                        </Label>
                                                        <Input
                                                            id={`returned-${index}`}
                                                            type="number"
                                                            min="0"
                                                            value={
                                                                detail.jumlah_kembali
                                                            }
                                                            onChange={(
                                                                e,
                                                            ) => {
                                                                updateProductDetail(
                                                                    index,
                                                                    "jumlah_kembali",
                                                                    parseInt(
                                                                        e
                                                                            .target
                                                                            .value,
                                                                    ) || 0,
                                                                )
                                                            }}
                                                            className={cn("mt-1", inputSizeClass)}
                                                        />
                                                    </div>
                                                </div>

                                                {product && (
                                                    <div
                                                        className={cn(
                                                            "border-t border-gray-200",
                                                            isModal ? "mt-3 pt-2" : "mt-4 pt-3",
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "grid grid-cols-3 text-xs",
                                                                gridGap,
                                                            )}
                                                        >
                                                            <div>
                                                                <span className="text-gray-500 block mb-1">
                                                                    Harga
                                                                    Satuan
                                                                </span>
                                                                <p className="font-medium text-gray-900">
                                                                    {formatCurrency(
                                                                        product.harga_satuan,
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block mb-1">
                                                                    Net
                                                                    Terjual
                                                                </span>
                                                                <p className="font-medium text-blue-600">
                                                                    {detail.jumlah_terjual -
                                                                        detail.jumlah_kembali}{" "}
                                                                    unit
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block mb-1">
                                                                    Subtotal
                                                                </span>
                                                                <p className="font-semibold text-green-600">
                                                                    {formatCurrency(
                                                                        detail.jumlah_terjual *
                                                                        product.harga_satuan,
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {autoUpdateEnabled && (
                                                            <div
                                                                className={cn(
                                                                    "flex items-center text-green-600 gap-1",
                                                                    isModal ? "mt-1 text-[11px]" : "mt-2 text-xs",
                                                                )}
                                                            >
                                                                <DollarSign className="w-3 h-3" />
                                                                <span>
                                                                    Berkontribusi
                                                                    ke total
                                                                    otomatis
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    },
                                )}

                                {formData.details.length === 0 && (
                                    <div
                                        className={cn(
                                            "text-center text-gray-500",
                                            isModal ? "py-5" : "py-8",
                                        )}
                                    >
                                        <Package
                                            className={cn(
                                                "text-gray-400 mx-auto mb-3",
                                                isModal ? "w-10 h-10" : "w-12 h-12",
                                            )}
                                        />
                                        <p
                                            className={cn(
                                                "font-medium text-gray-600 mb-1",
                                                isModal ? "text-xs" : "text-sm",
                                            )}
                                        >
                                            Belum ada produk ditambahkan
                                        </p>
                                        <p
                                            className={cn(
                                                "text-gray-500",
                                                isModal ? "text-[11px] mb-3" : "text-xs mb-4",
                                            )}
                                        >
                                            Tambahkan produk untuk melanjutkan
                                            penagihan
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addProductDetail}
                                        >
                                            Tambah Produk Pertama
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className={cn(isModal ? "space-y-4" : "space-y-6")}>
                    {/* Payment Information */}
                    <div className="bg-white border border-gray-200 rounded-md">
                        <div className={cn("border-b border-gray-200", sectionPadding)}>
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-blue-600" />
                                <h3
                                    className={cn(
                                        "font-semibold text-gray-900",
                                        isModal ? "text-base" : "text-lg",
                                    )}
                                >
                                    Pembayaran
                                </h3>
                            </div>
                        </div>
                        <div className={cn(sectionPadding, blockSpacing)}>
                            <div>
                                <Label
                                    htmlFor="payment-method"
                                    className={cn(
                                        "font-medium text-gray-600 uppercase tracking-wide",
                                        isModal ? "text-[11px]" : "text-xs",
                                    )}
                                >
                                    Metode Pembayaran
                                </Label>
                                <Select
                                    value={formData.metode_pembayaran}
                                    onValueChange={(
                                        value: "Cash" | "Transfer",
                                    ) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            metode_pembayaran: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger
                                        className={cn("mt-1", inputSizeClass)}
                                    >
                                        <SelectValue placeholder="Pilih metode pembayaran" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">
                                            Cash
                                        </SelectItem>
                                        <SelectItem value="Transfer">
                                            Transfer
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label
                                    htmlFor="total-amount"
                                    className={cn(
                                        "font-medium text-gray-600 uppercase tracking-wide",
                                        isModal ? "text-[11px]" : "text-xs",
                                    )}
                                >
                                    Total Uang Diterima
                                </Label>
                                <div
                                    className={cn(
                                        "flex items-center",
                                        isModal ? "mt-0.5 gap-1.5" : "mt-1 gap-2",
                                    )}
                                >
                                    <Input
                                        id="total-amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                            formData.total_uang_diterima
                                        }
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                total_uang_diterima:
                                                    parseFloat(
                                                        e.target.value,
                                                    ) || 0,
                                            }))
                                        }
                                        className={inputSizeClass}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={autoFillTotalUangDiterima}
                                        className="whitespace-nowrap"
                                    >
                                        Isi Otomatis
                                    </Button>
                                </div>
                            </div>

                            <div
                                className={cn(
                                    "flex items-center justify-between",
                                    isModal && "text-[13px]",
                                )}
                            >
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="auto-update"
                                        checked={autoUpdateEnabled}
                                        onCheckedChange={(checked) =>
                                            setAutoUpdateEnabled(!!checked)
                                        }
                                    />
                                    <Label
                                        htmlFor="auto-update"
                                        className="text-xs text-gray-700"
                                    >
                                        Update otomatis saat detail berubah
                                    </Label>
                                </div>
                            </div>

                            <Separator />

                            <div
                                className={cn(
                                    "space-y-2 text-sm",
                                    isModal && "text-[13px]",
                                )}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">
                                        Subtotal
                                    </span>
                                    <span className="font-medium">
                                        {formatCurrency(
                                            calculations.subtotal,
                                        )}
                                    </span>
                                </div>

                                {formData.ada_potongan &&
                                    calculations.discount > 0 && (
                                        <div className="flex justify-between items-center text-red-600">
                                            <span>Potongan</span>
                                            <span className="font-medium">
                                                -
                                                {formatCurrency(
                                                    calculations.discount,
                                                )}
                                            </span>
                                        </div>
                                    )}

                                <Separator className={cn("my-2", isModal && "my-1.5")} />

                                <div
                                    className={cn(
                                        "flex justify-between items-center bg-green-50 rounded-md",
                                        isModal ? "p-2" : "p-3",
                                    )}
                                >
                                    <span className="font-semibold text-gray-900">
                                        Total Kalkulasi
                                    </span>
                                    <span className="font-bold text-green-600">
                                        {formatCurrency(
                                            calculations.calculatedTotal,
                                        )}
                                    </span>
                                </div>

                                {isDifferentFromCalculated &&
                                    calculations.calculatedTotal > 0 && (
                                        <div
                                            className={cn(
                                                "flex justify-between items-center bg-orange-50 rounded-md border border-orange-200",
                                                isModal ? "p-2" : "p-3",
                                            )}
                                        >
                                            <span className="font-semibold text-gray-900">
                                                Selisih
                                            </span>
                                            <span
                                                className={`font-bold ${formData.total_uang_diterima >
                                                    calculations.calculatedTotal
                                                    ? "text-green-600"
                                                    : "text-red-600"
                                                    }`}
                                            >
                                                {formData.total_uang_diterima >
                                                    calculations.calculatedTotal
                                                    ? "+"
                                                    : ""}
                                                {formatCurrency(
                                                    formData.total_uang_diterima -
                                                    calculations.calculatedTotal,
                                                )}
                                            </span>
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>

                    {/* Discount Information */}
                    <div className="bg-white border border-gray-200 rounded-md">
                        <div className={cn("border-b border-gray-200", sectionPadding)}>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                                <h3
                                    className={cn(
                                        "font-semibold text-gray-900",
                                        isModal ? "text-base" : "text-lg",
                                    )}
                                >
                                    Potongan
                                </h3>
                            </div>
                        </div>
                        <div className={cn(sectionPadding, blockSpacing)}>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="has-discount"
                                    checked={formData.ada_potongan}
                                    onCheckedChange={(checked) => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            ada_potongan: !!checked,
                                            potongan: checked
                                                ? prev.potongan || {
                                                    jumlah_potongan: 0,
                                                }
                                                : undefined,
                                        }))
                                    }}
                                />
                                <Label
                                    htmlFor="has-discount"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Ada potongan
                                </Label>
                            </div>

                            {formData.ada_potongan && (
                                <div className={blockSpacing}>
                                    <div>
                                        <Label
                                            htmlFor="discount-amount"
                                            className={cn(
                                                "font-medium text-gray-600 uppercase tracking-wide",
                                                isModal ? "text-[11px]" : "text-xs",
                                            )}
                                        >
                                            Jumlah Potongan
                                        </Label>
                                        <Input
                                            id="discount-amount"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                                formData.potongan
                                                    ?.jumlah_potongan || 0
                                            }
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    potongan: {
                                                        ...prev.potongan,
                                                        jumlah_potongan:
                                                            parseFloat(
                                                                e.target
                                                                    .value,
                                                            ) || 0,
                                                        alasan:
                                                            prev.potongan
                                                                ?.alasan,
                                                    },
                                                }))
                                            }
                                            className={cn("mt-1", inputSizeClass)}
                                        />
                                    </div>

                                    <div>
                                        <Label
                                            htmlFor="discount-reason"
                                            className={cn(
                                                "font-medium text-gray-600 uppercase tracking-wide",
                                                isModal ? "text-[11px]" : "text-xs",
                                            )}
                                        >
                                            Alasan Potongan
                                        </Label>
                                        <Textarea
                                            id="discount-reason"
                                            placeholder="Masukkan alasan potongan (opsional)"
                                            value={
                                                formData.potongan?.alasan || ""
                                            }
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    potongan: {
                                                        ...prev.potongan,
                                                        jumlah_potongan:
                                                            prev.potongan
                                                                ?.jumlah_potongan ||
                                                            0,
                                                        alasan: e.target.value,
                                                    },
                                                }))
                                            }
                                            className={cn(
                                                "mt-1 resize-none",
                                                isModal ? "min-h-[48px] text-sm" : "min-h-[60px]",
                                            )}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit Button */}
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
                </div>
            </div>
        </form>
    )

    if (variant === "page") {
        return (
            <div className="w-full bg-white min-h-screen">
                <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Edit Penagihan #{penagihan.id_penagihan}
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Toko: {penagihan.toko.nama_toko} •{" "}
                                {penagihan.toko.kecamatan},{" "}
                                {penagihan.toko.kabupaten}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/dashboard/penagihan")}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Kembali
                        </Button>
                    </div>

                    {formBody}
                </div>
            </div>
        )
    }

    // Modal variant layout (header info already provided by ModalBox)
    return <div className="w-full">{formBody}</div>
}
