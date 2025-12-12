"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DollarSign } from "lucide-react"
import { formatCurrency } from "@/lib/form-utils"
import { useCreateSetoranMutation, useUpdateSetoranMutation } from "@/lib/queries/setoran"
import { cn } from "@/lib/utils"

interface SetoranCreateFormProps {
    formId?: string
    mode?: 'create' | 'edit' | 'detail'
    initialData?: {
        id_setoran?: number
        total_setoran?: number
        penerima_setoran?: string
    }
    onSuccess?: () => void
    onSubmittingChange?: (submitting: boolean) => void
    className?: string
}

export function SetoranCreateForm({
    formId,
    mode = 'create',
    initialData,
    onSuccess,
    onSubmittingChange,
    className,
}: SetoranCreateFormProps) {
    const createMutation = useCreateSetoranMutation()
    const updateMutation = useUpdateSetoranMutation()
    const [formData, setFormData] = useState({
        total_setoran: initialData?.total_setoran || 0,
        penerima_setoran: initialData?.penerima_setoran || "",
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isReadonly = mode === 'detail'

    const resolvedFormId = useMemo(
        () => formId || `setoran-${mode}-form`,
        [formId, mode],
    )

    // Update form when initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData({
                total_setoran: initialData.total_setoran || 0,
                penerima_setoran: initialData.penerima_setoran || "",
            })
        }
    }, [initialData])

    useEffect(() => {
        onSubmittingChange?.(isSubmitting)
    }, [isSubmitting, onSubmittingChange])

    const validate = () => {
        const nextErrors: Record<string, string> = {}
        if (!formData.total_setoran || formData.total_setoran <= 0) {
            nextErrors.total_setoran = "Total setoran harus lebih dari 0"
        }
        if (!formData.penerima_setoran.trim()) {
            nextErrors.penerima_setoran = "Penerima setoran harus diisi"
        } else if (formData.penerima_setoran.trim().length < 2) {
            nextErrors.penerima_setoran =
                "Penerima setoran minimal 2 karakter"
        }
        setErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const handleChange = (
        field: "total_setoran" | "penerima_setoran",
        value: string,
    ) => {
        if (isReadonly) return

        setFormData(prev => ({
            ...prev,
            [field]:
                field === "total_setoran"
                    ? parseFloat(value) || 0
                    : value,
        }))
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: "" }))
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (isReadonly) return
        if (!validate()) return

        setIsSubmitting(true)

        const mutation = mode === 'edit' ? updateMutation : createMutation
        const data = mode === 'edit' && initialData?.id_setoran
            ? {
                id: initialData.id_setoran,
                total_setoran: formData.total_setoran,
                penerima_setoran: formData.penerima_setoran.trim(),
            }
            : {
                total_setoran: formData.total_setoran,
                penerima_setoran: formData.penerima_setoran.trim(),
            }

        mutation.mutate(data as any, {
            onSuccess: () => {
                if (mode === 'create') {
                    setFormData({ total_setoran: 0, penerima_setoran: "" })
                }
                onSuccess?.()
            },
            onSettled: () => {
                setIsSubmitting(false)
            },
        })
    }

    return (
        <form
            id={resolvedFormId}
            onSubmit={handleSubmit}
            className={cn("space-y-4", className)}
        >
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label
                        htmlFor="total_setoran"
                        className="flex items-center gap-2"
                    >
                        <DollarSign className="w-4 h-4 text-green-600" />
                        Total Setoran *
                    </Label>
                    <Input
                        id="total_setoran"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.total_setoran || ""}
                        onChange={(e) =>
                            handleChange("total_setoran", e.target.value)
                        }
                        className={cn(errors.total_setoran && "border-red-500")}
                        placeholder="Jumlah setoran"
                        readOnly={isReadonly}
                        disabled={isReadonly}
                    />
                    {errors.total_setoran && (
                        <p className="text-sm text-red-600">
                            {errors.total_setoran}
                        </p>
                    )}
                    {formData.total_setoran > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {formatCurrency(formData.total_setoran)}
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="penerima_setoran">Penerima Setoran *</Label>
                    <Input
                        id="penerima_setoran"
                        value={formData.penerima_setoran}
                        onChange={(e) =>
                            handleChange("penerima_setoran", e.target.value)
                        }
                        placeholder="Nama penerima setoran"
                        className={cn(
                            errors.penerima_setoran && "border-red-500",
                        )}
                        readOnly={isReadonly}
                        disabled={isReadonly}
                    />
                    {errors.penerima_setoran && (
                        <p className="text-sm text-red-600">
                            {errors.penerima_setoran}
                        </p>
                    )}
                </div>
                {formData.total_setoran > 0 && (
                    <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
                        Jumlah dalam Rupiah:{" "}
                        <span className="font-semibold text-gray-900">
                            {formatCurrency(formData.total_setoran)}
                        </span>
                    </div>
                )}
            </div>
        </form>
    )
}
