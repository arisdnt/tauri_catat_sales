'use client'

import { useState } from 'react'

import { AnalyticsKPICards } from '@/components/dashboard/analytics-kpi-cards'
import { DateRangePicker } from '@/components/dashboard/date-range-picker'
import { PerformanceCharts } from '@/components/dashboard/performance-charts'
import { getCurrentDateIndonesia, INDONESIA_TIMEZONE } from '@/lib/utils'

export default function DashboardPage() {
  // Default to current month (from 1st to end of month) using Indonesia timezone
  const [startDate, setStartDate] = useState(() => {
    const today = getCurrentDateIndonesia()
    const date = new Date(today)
    date.setDate(1) // Set to first day of current month
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date)
  })

  const [endDate, setEndDate] = useState(() => {
    const today = getCurrentDateIndonesia()
    const date = new Date(today)
    // Set to last day of current month
    date.setMonth(date.getMonth() + 1, 0)
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date)
  })

  const handleDateRangeChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Filter Bar - Fixed at top, flush with navbar like penagihan page */}
      <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={handleDateRangeChange}
        />
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* KPI Cards */}
          <AnalyticsKPICards startDate={startDate} endDate={endDate} />

          {/* Performance Charts */}
          <PerformanceCharts startDate={startDate} endDate={endDate} />
        </div>
      </div>
    </div>
  )
}