'use client'

import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { SetoranEditForm } from './setoran-edit-form'

export default function EditSetoranPage() {
  const params = useParams()
  const router = useRouter()
  const id = parseInt(params.id as string)

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full max-w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Edit Setoran #{id}
            </h1>
            <p className="text-sm text-gray-600">
              Perbarui informasi setoran dengan data terbaru.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
        </div>

        <SetoranEditForm
          id={id}
          variant="page"
          onSuccess={() => router.push(`/dashboard/setoran/${id}`)}
        />
      </div>
    </div>
  )
}
