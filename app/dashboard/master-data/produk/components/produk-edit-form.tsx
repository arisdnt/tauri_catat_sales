"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"

const formSchema = z.object({
    nama_produk: z.string().min(2, "Nama produk minimal 2 karakter"),
    harga_satuan: z
        .number({
            invalid_type_error: "Harga harus berupa angka",
        })
        .positive("Harga harus lebih dari 0"),
    status_produk: z.boolean(),
    is_priority: z.boolean(),
    priority_order: z
        .number({
            invalid_type_error: "Urutan prioritas harus berupa angka",
        })
        .min(0, "Urutan minimal 0")
        .optional(),
})

type FormValues = z.infer<typeof formSchema>

interface ProdukEditFormProps {
    id: number
    formId?: string
    initialData?: Partial<FormValues> & {
        priority_order?: number | null
    } & Record<string, any>
    onSuccess?: () => void
    onSubmittingChange?: (submitting: boolean) => void
    className?: string
}

export function ProdukEditForm({
    id,
    formId,
    initialData,
    onSuccess,
    onSubmittingChange,
    className,
}: ProdukEditFormProps) {
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const resolvedFormId = useMemo(
        () => formId || `produk-edit-form-${id}`,
        [formId, id],
    )

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            nama_produk: initialData?.nama_produk || "",
            harga_satuan: initialData?.harga_satuan || 0,
            status_produk:
                initialData?.status_produk !== undefined
                    ? Boolean(initialData.status_produk)
                    : true,
            is_priority: Boolean(initialData?.is_priority),
            priority_order: initialData?.priority_order ?? 0,
        },
    })

    useEffect(() => {
        onSubmittingChange?.(isSubmitting)
    }, [isSubmitting, onSubmittingChange])

    useEffect(() => {
        form.reset({
            nama_produk: initialData?.nama_produk || "",
            harga_satuan: initialData?.harga_satuan || 0,
            status_produk:
                initialData?.status_produk !== undefined
                    ? Boolean(initialData.status_produk)
                    : true,
            is_priority: Boolean(initialData?.is_priority),
            priority_order: initialData?.priority_order ?? 0,
        })
    }, [initialData, form])

    const watchPriority = form.watch("is_priority")

    const onSubmit = async (values: FormValues) => {
        try {
            setIsSubmitting(true)
            const response = await fetch(`/api/produk/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nama_produk: values.nama_produk.trim(),
                    harga_satuan: values.harga_satuan,
                    status_produk: values.status_produk,
                    is_priority: values.is_priority,
                    priority_order: values.is_priority
                        ? values.priority_order || 0
                        : 0,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(
                    error?.error || "Gagal memperbarui data produk",
                )
            }

            toast({
                title: "Berhasil",
                description: "Data produk berhasil diperbarui",
            })
            onSuccess?.()
        } catch (error: any) {
            toast({
                title: "Error",
                description:
                    error?.message || "Terjadi kesalahan saat menyimpan",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form
            id={resolvedFormId}
            onSubmit={form.handleSubmit(onSubmit)}
            className={className}
        >
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor={`${resolvedFormId}-nama`}>
                        Nama Produk
                    </Label>
                    <Input
                        id={`${resolvedFormId}-nama`}
                        {...form.register("nama_produk")}
                    />
                    {form.formState.errors.nama_produk && (
                        <p className="text-sm text-red-600">
                            {form.formState.errors.nama_produk.message}
                        </p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`${resolvedFormId}-harga`}>
                        Harga Satuan
                    </Label>
                    <Input
                        id={`${resolvedFormId}-harga`}
                        type="number"
                        min="0"
                        step="0.01"
                        {...form.register("harga_satuan", {
                            valueAsNumber: true,
                        })}
                    />
                    {form.formState.errors.harga_satuan && (
                        <p className="text-sm text-red-600">
                            {form.formState.errors.harga_satuan.message}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-4 mt-4">
                <div className="space-y-2 rounded border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                        <Label htmlFor={`${resolvedFormId}-status`}>
                            Status Produk
                        </Label>
                        <Switch
                            id={`${resolvedFormId}-status`}
                            checked={form.watch("status_produk")}
                            onCheckedChange={(checked) =>
                                form.setValue("status_produk", checked)
                            }
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        Nonaktifkan jika produk sudah tidak dijual.
                    </p>
                </div>
                <div className="space-y-2 rounded border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                        <Label htmlFor={`${resolvedFormId}-priority`}>
                            Produk Prioritas
                        </Label>
                        <Switch
                            id={`${resolvedFormId}-priority`}
                            checked={watchPriority}
                            onCheckedChange={(checked) => {
                                form.setValue("is_priority", checked)
                                if (!checked) {
                                    form.setValue("priority_order", 0)
                                }
                            }}
                        />
                    </div>
                    {watchPriority && (
                        <div className="space-y-1.5">
                            <Label
                                htmlFor={`${resolvedFormId}-priority-order`}
                                className="text-xs text-gray-600"
                            >
                                Urutan Prioritas
                            </Label>
                            <Input
                                id={`${resolvedFormId}-priority-order`}
                                type="number"
                                min="0"
                                {...form.register("priority_order", {
                                    valueAsNumber: true,
                                })}
                            />
                            {form.formState.errors.priority_order && (
                                <p className="text-sm text-red-600">
                                    {
                                        form.formState.errors.priority_order
                                            .message
                                    }
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </form>
    )
}
