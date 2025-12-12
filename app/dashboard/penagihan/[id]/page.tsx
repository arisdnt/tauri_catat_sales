// Server component wrapper to support generateStaticParams and render client UI
import PenagihanDetailClient from './penagihan-detail-client'

// Required for Next.js static export with dynamic routes
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PenagihanDetailClient id={parseInt(id)} />
}
