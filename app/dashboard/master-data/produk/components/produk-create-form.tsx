"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"

const createSchema = z.object({
    nama_produk: z.string().min(2, "Nama produk minimal 2 karakter"),
    harga_satuan: z
        .number({
            invalid_type_error: "Harga harus berupa angka",
        })
        .positive("Harga harus lebih dari 0"),
    is_priority: z.boolean(),
    priority_order: z
        .number({
            invalid_type_error: "Urutan harus berupa angka",
        })
        .min(0, "Urutan minimal 0")
        .optional(),
})

type CreateFormValues = z.infer<typeof createSchema>

interface ProdukCreateFormProps {
    formId?: string
    onSuccess?: () => void
    onSubmittingChange?: (submitting: boolean) => void
    className?: string
}

export function ProdukCreateForm({
    formId,
    onSuccess,
    onSubmittingChange,
    className,
}: ProdukCreateFormProps) {
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const resolvedFormId = useMemo(
        () => formId || "produk-create-form",
        [formId],
    )

    const form = useForm<CreateFormValues>({
        resolver: zodResolver(createSchema),
        defaultValues: {
            nama_produk: "",
            harga_satuan: 0,
            is_priority: false,
            priority_order: 0,
        },
    })

    useEffect(() => {
        onSubmittingChange?.(isSubmitting)
    }, [isSubmitting, onSubmittingChange])

    const watchPriority = form.watch("is_priority")

    const onSubmit = async (values: CreateFormValues) => {
        try {
            setIsSubmitting(true)
            const response = await fetch("/api/produk", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nama_produk: values.nama_produk.trim(),
                    harga_satuan: values.harga_satuan,
                    is_priority: values.is_priority,
                    priority_order: values.is_priority
                        ? values.priority_order || 0
                        : 0,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error?.error || "Gagal menambahkan produk")
            }

            toast({
                title: "Berhasil",
                description: "Produk baru berhasil ditambahkan",
            })
            form.reset({
                nama_produk: "",
                harga_satuan: 0,
                is_priority: false,
                priority_order: 0,
            })
            onSuccess?.()
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Gagal menambahkan produk",
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

            <div className="mt-4 space-y-4 rounded border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <Label
                        htmlFor={`${resolvedFormId}-priority-toggle`}
                        className="text-sm"
                    >
                        Produk Priority
                    </Label>
                    <Switch
                        id={`${resolvedFormId}-priority-toggle`}
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
                        <Label htmlFor={`${resolvedFormId}-priority-order`}>
                            Urutan Priority
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
        </form>
    )
}
