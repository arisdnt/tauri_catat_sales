import SalesDetailClient from './sales-detail-client'

// Required for static export with dynamic routes
export const dynamicParams = true

export function generateStaticParams() {
  // Return empty array - pages will be generated on-demand client-side
  return []
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SalesDetailPage({ params }: PageProps) {
  const { id } = await params
  return <SalesDetailClient id={id} />
}