'use client'

import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { PengirimanEditForm } from './pengiriman-edit-form'

export default function EditPengirimanPage() {
  const params = useParams()
  const { navigate } = useNavigation()
  const id = parseInt(params.id as string)

  return (
    <div className="w-full bg-white min-h-screen">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Pengiriman #{id}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Perbarui detail pengiriman langsung dari halaman ini.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/dashboard/pengiriman/${id}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
        </div>

        <PengirimanEditForm
          id={id}
          variant="page"
          onSuccess={() => navigate(`/dashboard/pengiriman/${id}`)}
        />
      </div>
    </div>
  )
}
