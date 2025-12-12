import EditSalesClient from './edit-sales-client'

// Required for static export with dynamic routes
export const dynamicParams = true

export function generateStaticParams() {
  // Return empty array - pages will be generated on-demand client-side
  return []
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditSalesPage({ params }: PageProps) {
  const { id } = await params
  return <EditSalesClient id={id} />
}