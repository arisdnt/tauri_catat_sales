"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { DollarSign, Save } from "lucide-react"
import {
    useSetoranDetailQuery,
    useUpdateSetoranMutation,
    type SetoranDetail,
    type UpdateSetoranData,
} from "@/lib/queries/setoran"
import { formatCurrency } from "@/lib/form-utils"
import { cn } from "@/lib/utils"

interface SetoranEditFormProps {
    id: number
    variant?: "page" | "modal"
    onSuccess?: () => void
    onCancel?: () => void
    formId?: string
    initialData?: {
        total_setoran?: number
        penerima_setoran?: string
    }
    onSubmittingChange?: (submitting: boolean) => void
}

export function SetoranEditForm({
    id,
    variant = "page",
    onSuccess,
    onCancel,
    formId,
    initialData,
    onSubmittingChange,
}: SetoranEditFormProps) {
    const { toast } = useToast()
    const { data: response, isLoading, error } = useSetoranDetailQuery(id)
    const updateSetoranMutation = useUpdateSetoranMutation()
    const isModal = variant === "modal"

    const setoran = (response as any)?.data as SetoranDetail | undefined

    const [formData, setFormData] = useState<UpdateSetoranData>({
        total_setoran: initialData?.total_setoran || 0,
        penerima_setoran: initialData?.penerima_setoran || "",
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const resolvedFormId = useMemo(
        () => formId || `setoran-edit-form-${id}`,
        [formId, id],
    )

    useEffect(() => {
        onSubmittingChange?.(isSubmitting)
    }, [isSubmitting, onSubmittingChange])

    useEffect(() => {
        if (setoran) {
            setFormData({
                total_setoran: Number(setoran.total_setoran || 0),
                penerima_setoran: setoran.penerima_setoran || "",
            })
        } else if (initialData) {
            setFormData({
                total_setoran: initialData.total_setoran || 0,
                penerima_setoran: initialData.penerima_setoran || "",
            })
        }
    }, [setoran, initialData])

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {}

        if (!formData.total_setoran || formData.total_setoran <= 0) {
            newErrors.total_setoran = "Total setoran harus lebih dari 0"
        }

        if (!formData.penerima_setoran?.trim()) {
            newErrors.penerima_setoran = "Penerima setoran harus diisi"
        } else if (formData.penerima_setoran.trim().length < 2) {
            newErrors.penerima_setoran =
                "Penerima setoran minimal 2 karakter"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleInputChange = (field: keyof UpdateSetoranData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]:
                field === "total_setoran"
                    ? typeof value === "number"
                        ? value
                        : parseFloat(value) || 0
                    : value,
        }))

        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: "",
            }))
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) return

        setIsSubmitting(true)
        updateSetoranMutation.mutate(
            {
                id,
                data: {
                    total_setoran: formData.total_setoran,
                    penerima_setoran: formData.penerima_setoran.trim(),
                },
            },
            {
                onSuccess: () => {
                    onSuccess?.()
                },
                onError: err => {
                    toast({
                        title: "Error",
                        description:
                            err instanceof Error
                                ? err.message
                                : "Terjadi kesalahan saat memperbarui data",
                        variant: "destructive",
                    })
                },
                onSettled: () => {
                    setIsSubmitting(false)
                },
            },
        )
    }

    if (isLoading && !initialData) {
        return (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                Memuat data setoran...
            </div>
        )
    }

    if ((error && !initialData) || (!setoran && !initialData && !isLoading)) {
        return (
            <div className="space-y-3 py-6 text-sm">
                <p className="font-semibold text-gray-900">
                    Data setoran tidak ditemukan
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
            className={cn("space-y-6", isModal && "space-y-4")}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="total_setoran" className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        Total Setoran *
                    </Label>
                    <Input
                        id="total_setoran"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.total_setoran || ""}
                        onChange={e =>
                            handleInputChange(
                                "total_setoran",
                                parseFloat(e.target.value) || 0,
                            )
                        }
                        className={cn(errors.total_setoran && "border-red-500")}
                        placeholder="Masukkan total setoran"
                    />
                    {errors.total_setoran && (
                        <p className="text-sm text-red-600">
                            {errors.total_setoran}
                        </p>
                    )}
                    {formData.total_setoran > 0 && (
                        <p className="text-sm text-gray-600">
                            {formatCurrency(formData.total_setoran)}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="penerima_setoran">Penerima Setoran *</Label>
                    <Input
                        id="penerima_setoran"
                        value={formData.penerima_setoran}
                        onChange={e =>
                            handleInputChange("penerima_setoran", e.target.value)
                        }
                        placeholder="Nama penerima setoran"
                        className={cn(errors.penerima_setoran && "border-red-500")}
                    />
                    {errors.penerima_setoran && (
                        <p className="text-sm text-red-600">
                            {errors.penerima_setoran}
                        </p>
                    )}
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
