"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Upload, X, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
    useUpdatePengeluaranMutation,
    formatDateForInput,
} from "@/lib/queries/pengeluaran"
import { cn } from "@/lib/utils"

const editSchema = z.object({
    tanggal_pengeluaran: z.string().min(1, "Tanggal wajib diisi"),
    jumlah: z
        .number({
            invalid_type_error: "Jumlah harus angka",
        })
        .positive("Jumlah harus lebih dari 0"),
    keterangan: z.string().min(1, "Keterangan wajib diisi"),
})

type EditFormValues = z.infer<typeof editSchema>

interface PengeluaranEditFormProps {
    id: number
    formId?: string
    initialData?: {
        tanggal_pengeluaran?: string | null
        jumlah?: number | null
        keterangan?: string | null
        url_bukti_foto?: string | null
    }
    onSuccess?: () => void
    onSubmittingChange?: (submitting: boolean) => void
    className?: string
}

export function PengeluaranEditForm({
    id,
    formId,
    initialData,
    onSuccess,
    onSubmittingChange,
    className,
}: PengeluaranEditFormProps) {
    const { toast } = useToast()
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [existingUrl, setExistingUrl] = useState<string | null>(
        initialData?.url_bukti_foto || null,
    )
    const [displayExistingUrl, setDisplayExistingUrl] = useState<string | null>(
        initialData?.url_bukti_foto || null,
    )
    const [removeExisting, setRemoveExisting] = useState(false)

    const updateMutation = useUpdatePengeluaranMutation()

    const resolvedFormId = useMemo(
        () => formId || `pengeluaran-edit-form-${id}`,
        [formId, id],
    )

    const form = useForm<EditFormValues>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            tanggal_pengeluaran: initialData?.tanggal_pengeluaran
                ? formatDateForInput(initialData.tanggal_pengeluaran)
                : new Date().toISOString().slice(0, 16),
            jumlah: initialData?.jumlah ? Number(initialData.jumlah) : 0,
            keterangan: initialData?.keterangan || "",
        },
    })

    useEffect(() => {
        onSubmittingChange?.(updateMutation.isPending)
    }, [updateMutation.isPending, onSubmittingChange])

    useEffect(() => {
        if (!initialData) return
        form.reset({
            tanggal_pengeluaran: initialData.tanggal_pengeluaran
                ? formatDateForInput(initialData.tanggal_pengeluaran)
                : new Date().toISOString().slice(0, 16),
            jumlah: initialData.jumlah ? Number(initialData.jumlah) : 0,
            keterangan: initialData.keterangan || "",
        })
        setExistingUrl(initialData.url_bukti_foto || null)
        setDisplayExistingUrl(initialData.url_bukti_foto || null)
        setRemoveExisting(false)
        setSelectedFile(null)
        setPreviewUrl(prev => {
            if (prev) {
                URL.revokeObjectURL(prev)
            }
            return null
        })
    }, [initialData, form])

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl)
            }
        }
    }, [previewUrl])

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"]
        if (!allowedTypes.includes(file.type)) {
            toast({
                title: "Format tidak didukung",
                description: "Gunakan file JPEG atau PNG",
                variant: "destructive",
            })
            return
        }
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            toast({
                title: "File terlalu besar",
                description: "Ukuran maksimal 5MB",
                variant: "destructive",
            })
            return
        }
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        setSelectedFile(file)
        setRemoveExisting(false)
    }

    const handleRemovePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
        }
        setSelectedFile(null)
    }

    const handleRemoveExisting = () => {
        setDisplayExistingUrl(null)
        setRemoveExisting(true)
    }

    const onSubmit = async (values: EditFormValues) => {
        try {
            await updateMutation.mutateAsync({
                id,
                jumlah: values.jumlah,
                keterangan: values.keterangan,
                tanggal_pengeluaran: new Date(
                    values.tanggal_pengeluaran,
                ).toISOString(),
                newFile: selectedFile || undefined,
                removeExisting,
                existingUrl,
            })
            toast({
                title: "Berhasil",
                description: "Pengeluaran berhasil diperbarui",
            })
            onSuccess?.()
        } catch (error: any) {
            toast({
                title: "Gagal menyimpan",
                description: error?.message || "Terjadi kesalahan",
                variant: "destructive",
            })
        }
    }

    return (
        <form
            id={resolvedFormId}
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn("space-y-4", className)}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor={`${resolvedFormId}-tanggal`}>
                        Tanggal Pengeluaran
                    </Label>
                    <Input
                        id={`${resolvedFormId}-tanggal`}
                        type="datetime-local"
                        {...form.register("tanggal_pengeluaran")}
                    />
                    {form.formState.errors.tanggal_pengeluaran && (
                        <p className="text-sm text-red-600">
                            {
                                form.formState.errors.tanggal_pengeluaran
                                    .message
                            }
                        </p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`${resolvedFormId}-jumlah`}>
                        Jumlah (Rp)
                    </Label>
                    <Input
                        id={`${resolvedFormId}-jumlah`}
                        type="number"
                        step="0.01"
                        {...form.register("jumlah", {
                            valueAsNumber: true,
                        })}
                    />
                    {form.formState.errors.jumlah && (
                        <p className="text-sm text-red-600">
                            {form.formState.errors.jumlah.message}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${resolvedFormId}-keterangan`}>
                    Keterangan
                </Label>
                <Textarea
                    id={`${resolvedFormId}-keterangan`}
                    rows={3}
                    className="resize-none"
                    {...form.register("keterangan")}
                />
                {form.formState.errors.keterangan && (
                    <p className="text-sm text-red-600">
                        {form.formState.errors.keterangan.message}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label>Bukti Foto (Opsional)</Label>
                {!selectedFile && !displayExistingUrl && (
                    <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                            Klik untuk upload atau drag & drop
                        </p>
                        <p className="text-xs text-gray-500">
                            PNG, JPG hingga 5MB
                        </p>
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                )}

                {displayExistingUrl && !selectedFile && (
                    <div className="rounded-md border p-3 flex items-center justify-between bg-gray-50">
                        <div>
                            <p className="text-sm font-medium text-gray-800">
                                Bukti tersimpan
                            </p>
                            <a
                                href={displayExistingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Lihat bukti
                            </a>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={handleRemoveExisting}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Hapus
                        </Button>
                    </div>
                )}

                {selectedFile && (
                    <div className="rounded-md border p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-800">
                                File baru dipilih
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleRemovePreview}
                                className="text-red-500 hover:text-red-600"
                            >
                                <X className="h-4 w-4 mr-1" />
                                Batalkan
                            </Button>
                        </div>
                        {previewUrl && (
                            <img
                                src={previewUrl}
                                alt="Preview bukti"
                                className="h-48 w-full rounded object-cover border"
                            />
                        )}
                    </div>
                )}

                {(selectedFile || displayExistingUrl) && (
                    <div className="pt-2">
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                )}
            </div>
        </form>
    )
}
