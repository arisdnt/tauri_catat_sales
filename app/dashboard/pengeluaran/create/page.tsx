'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, X, Receipt, Calendar, DollarSign, FileText, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { useToast } from '@/components/ui/use-toast'
import { useCreatePengeluaran } from '@/lib/queries/pengeluaran'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatCurrency } from '@/lib/utils'

const pengeluaranSchema = z.object({
  jumlah: z.number().min(1, 'Jumlah harus lebih dari 0'),
  keterangan: z.string().min(1, 'Keterangan wajib diisi'),
  tanggal_pengeluaran: z.string().min(1, 'Tanggal wajib diisi'),
  bukti_foto: z.instanceof(File).optional()
})

type PengeluaranFormData = z.infer<typeof pengeluaranSchema>

export default function CreatePengeluaranPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const createMutation = useCreatePengeluaran()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch
  } = useForm<PengeluaranFormData>({
    resolver: zodResolver(pengeluaranSchema),
    defaultValues: {
      tanggal_pengeluaran: new Date().toISOString().split('T')[0]
    }
  })

  const bukti_foto = watch('bukti_foto')
  const jumlah = watch('jumlah')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Error',
          description: 'File harus berupa gambar',
          variant: 'destructive'
        })
        return
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Ukuran file maksimal 5MB',
          variant: 'destructive'
        })
        return
      }

      setValue('bukti_foto', file)

      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const removeFile = () => {
    setValue('bukti_foto', undefined)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const onSubmit = async (data: PengeluaranFormData) => {
    try {
      // Create FormData object
      const formData = new FormData()
      formData.append('jumlah', data.jumlah.toString())
      formData.append('keterangan', data.keterangan)
      formData.append('tanggal_pengeluaran', new Date(data.tanggal_pengeluaran).toISOString())

      if (data.bukti_foto) {
        formData.append('bukti_foto', data.bukti_foto)
      }

      await createMutation.mutateAsync(formData)

      toast({
        title: 'Berhasil',
        description: 'Pengeluaran berhasil ditambahkan'
      })

      router.push('/dashboard/pengeluaran')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menambahkan pengeluaran',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="w-full bg-white min-h-screen">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">

        {/* 2-Column Layout: 70% Form (Left) + 30% Upload (Right) */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            {/* Left Column - Form Inputs (70%) */}
            <div className="lg:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Informasi Pengeluaran
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tanggal */}
                  <div className="flex items-center gap-4">
                    <Label htmlFor="tanggal_pengeluaran" className="flex items-center gap-2 w-48 shrink-0">
                      <Calendar className="w-4 h-4" />
                      Tanggal Pengeluaran
                    </Label>
                    <div className="flex-1">
                      <Input
                        id="tanggal_pengeluaran"
                        type="date"
                        {...register('tanggal_pengeluaran')}
                        className={errors.tanggal_pengeluaran ? 'border-red-500' : ''}
                      />
                      {errors.tanggal_pengeluaran && (
                        <p className="text-sm text-red-500 mt-1">{errors.tanggal_pengeluaran.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Jumlah */}
                  <div className="flex items-center gap-4">
                    <Label htmlFor="jumlah" className="flex items-center gap-2 w-48 shrink-0">
                      <DollarSign className="w-4 h-4" />
                      Jumlah Pengeluaran
                    </Label>
                    <div className="flex-1">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                          Rp
                        </span>
                        <Input
                          id="jumlah"
                          type="number"
                          step="1000"
                          placeholder="0"
                          {...register('jumlah', { valueAsNumber: true })}
                          className={`pl-10 ${errors.jumlah ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {errors.jumlah && (
                        <p className="text-sm text-red-500 mt-1">{errors.jumlah.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div className="flex items-start gap-4">
                    <Label htmlFor="keterangan" className="flex items-center gap-2 w-48 shrink-0 pt-2">
                      <FileText className="w-4 h-4" />
                      Keterangan
                    </Label>
                    <div className="flex-1">
                      <Textarea
                        id="keterangan"
                        placeholder="Masukkan detail keterangan pengeluaran..."
                        rows={4}
                        {...register('keterangan')}
                        className={errors.keterangan ? 'border-red-500' : ''}
                      />
                      {errors.keterangan && (
                        <p className="text-sm text-red-500 mt-1">{errors.keterangan.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Bukti Foto Upload (30%) */}
            <div className="lg:col-span-3">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Bukti Foto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {!bukti_foto && (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                        <div className="mt-3">
                          <Label htmlFor="bukti_foto" className="cursor-pointer">
                            <span className="text-sm font-medium text-primary hover:text-primary/80">
                              Pilih file gambar
                            </span>
                            <Input
                              id="bukti_foto"
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </Label>
                          <p className="text-xs text-muted-foreground mt-2">
                            PNG, JPG, JPEG hingga 5MB
                          </p>
                        </div>
                      </div>
                    )}

                    {previewUrl && (
                      <div className="relative">
                        <img
                          src={previewUrl}
                          alt="Preview bukti pengeluaran"
                          className="w-full rounded-lg border shadow-sm"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={removeFile}
                          className="absolute -top-2 -right-2 h-8 w-8 rounded-full p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[140px]"
            >
              <Receipt className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}