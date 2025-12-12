"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useUpdateTokoMutation } from "@/lib/queries/toko"
import { cn } from "@/lib/utils"

const editSchema = z.object({
    nama_toko: z.string().min(2, "Nama toko minimal 2 karakter"),
    kabupaten: z.string().optional(),
    kecamatan: z.string().optional(),
    no_telepon: z.string().optional(),
    link_gmaps: z.string().optional(),
    sales_id: z.string().min(1, "Sales harus dipilih"),
    status_toko: z.boolean(),
})

type EditFormValues = z.infer<typeof editSchema>

interface TokoEditFormProps {
    id: number
    formId?: string
    initialData?: {
        nama_toko?: string | null
        kabupaten?: string | null
        kecamatan?: string | null
        no_telepon?: string | null
        link_gmaps?: string | null
        status_toko?: boolean | null
        id_sales?: number | null
        nama_sales?: string | null
    }
    salesOptions?: { id_sales: number; nama_sales: string }[]
    onSuccess?: () => void
    onSubmittingChange?: (submitting: boolean) => void
    className?: string
}

export function TokoEditForm({
    id,
    formId,
    initialData,
    salesOptions,
    onSuccess,
    onSubmittingChange,
    className,
}: TokoEditFormProps) {
    const updateMutation = useUpdateTokoMutation()
    const resolvedFormId = useMemo(
        () => formId || `toko-edit-form-${id}`,
        [formId, id],
    )

    const form = useForm<EditFormValues>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            nama_toko: initialData?.nama_toko || "",
            kabupaten: initialData?.kabupaten || "",
            kecamatan: initialData?.kecamatan || "",
            no_telepon: initialData?.no_telepon || "",
            link_gmaps: initialData?.link_gmaps || "",
            status_toko:
                initialData?.status_toko !== undefined
                    ? Boolean(initialData.status_toko)
                    : true,
            sales_id: initialData?.id_sales
                ? String(initialData.id_sales)
                : "",
        },
    })

    useEffect(() => {
        onSubmittingChange?.(updateMutation.isPending)
    }, [updateMutation.isPending, onSubmittingChange])

    useEffect(() => {
        form.reset({
            nama_toko: initialData?.nama_toko || "",
            kabupaten: initialData?.kabupaten || "",
            kecamatan: initialData?.kecamatan || "",
            no_telepon: initialData?.no_telepon || "",
            link_gmaps: initialData?.link_gmaps || "",
            status_toko:
                initialData?.status_toko !== undefined
                    ? Boolean(initialData.status_toko)
                    : true,
            sales_id: initialData?.id_sales
                ? String(initialData.id_sales)
                : "",
        })
    }, [initialData, form])

    const statusValue = form.watch("status_toko")
    const salesValue = form.watch("sales_id")

    const onSubmit = (values: EditFormValues) => {
        updateMutation.mutate(
            {
                id,
                data: {
                    nama_toko: values.nama_toko,
                    kabupaten: values.kabupaten || undefined,
                    kecamatan: values.kecamatan || undefined,
                    no_telepon: values.no_telepon || undefined,
                    link_gmaps: values.link_gmaps || undefined,
                    status_toko: values.status_toko,
                    id_sales: parseInt(values.sales_id, 10),
                },
            },
            {
                onSuccess: () => {
                    onSuccess?.()
                },
            },
        )
    }

    const salesList = salesOptions || []

    return (
        <form
            id={resolvedFormId}
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn("space-y-4", className)}
        >
            <div className="space-y-1.5">
                <Label htmlFor={`${resolvedFormId}-nama`}>Nama Toko</Label>
                <Input
                    id={`${resolvedFormId}-nama`}
                    {...form.register("nama_toko")}
                />
                {form.formState.errors.nama_toko && (
                    <p className="text-sm text-red-600">
                        {form.formState.errors.nama_toko.message}
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label>Sales Penanggung Jawab</Label>
                <Select
                    value={salesValue}
                    onValueChange={(val) => form.setValue("sales_id", val)}
                    disabled={salesList.length === 0}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih sales" />
                    </SelectTrigger>
                    <SelectContent>
                        {salesList.map((sales) => (
                            <SelectItem
                                key={sales.id_sales}
                                value={String(sales.id_sales)}
                            >
                                {sales.nama_sales}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {form.formState.errors.sales_id && (
                    <p className="text-sm text-red-600">
                        {form.formState.errors.sales_id.message}
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${resolvedFormId}-kabupaten`}>
                    Kabupaten
                </Label>
                <Input
                    id={`${resolvedFormId}-kabupaten`}
                    {...form.register("kabupaten")}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${resolvedFormId}-kecamatan`}>
                    Kecamatan
                </Label>
                <Input
                    id={`${resolvedFormId}-kecamatan`}
                    {...form.register("kecamatan")}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${resolvedFormId}-telepon`}>
                    Nomor Telepon
                </Label>
                <Input
                    id={`${resolvedFormId}-telepon`}
                    {...form.register("no_telepon")}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${resolvedFormId}-gmaps`}>
                    Link Google Maps
                </Label>
                <Input
                    id={`${resolvedFormId}-gmaps`}
                    {...form.register("link_gmaps")}
                />
            </div>

            <div className="space-y-2 rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor={`${resolvedFormId}-status`}>
                        Status Toko
                    </Label>
                    <Switch
                        id={`${resolvedFormId}-status`}
                        checked={statusValue}
                        onCheckedChange={(checked) =>
                            form.setValue("status_toko", checked)
                        }
                    />
                </div>
                <p className="text-xs text-gray-500">
                    Nonaktifkan jika toko tidak lagi aktif bertransaksi.
                </p>
            </div>
        </form>
    )
}
