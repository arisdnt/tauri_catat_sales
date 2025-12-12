'use client'

import { AuthProvider } from '@/components/providers/auth-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { AuthGuard } from '@/components/layout/auth-guard'
import { Toaster } from '@/components/ui/toaster'
import { SyncProvider } from '@/lib/db'
import { Navbar } from '@/components/navigation/navbar'
import { Toolbar } from '@/components/navigation/toolbar'

function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50 flex flex-col">
      {/* Top Navbar - Fixed height */}
      <Navbar />

      {/* Main Content - Fills remaining space, internal scroll */}
      <main className="flex-1 pt-12 pb-6 overflow-hidden">
        <div className="h-full w-full overflow-auto scrollbar-thin px-4 py-2">
          {children}
        </div>
      </main>

      {/* Bottom Toolbar - Fixed height */}
      <Toolbar />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AuthProvider>
        <AuthGuard>
          <SyncProvider>
            <DashboardContent>{children}</DashboardContent>
            <Toaster />
          </SyncProvider>
        </AuthGuard>
      </AuthProvider>
    </QueryProvider>
  )
}
