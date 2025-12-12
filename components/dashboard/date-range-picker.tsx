'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from 'lucide-react'
import { getCurrentDateIndonesia, INDONESIA_TIMEZONE } from '@/lib/utils'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onDateRangeChange: (startDate: string, endDate: string) => void
}

export function DateRangePicker({ startDate, endDate, onDateRangeChange }: DateRangePickerProps) {
  const [tempStartDate, setTempStartDate] = useState(startDate)
  const [tempEndDate, setTempEndDate] = useState(endDate)

  const applyDateRange = () => {
    onDateRangeChange(tempStartDate, tempEndDate)
  }

  const setQuickRange = (days: number) => {
    const today = getCurrentDateIndonesia()
    const endDate = new Date(today)
    const startDate = new Date(today)
    startDate.setDate(endDate.getDate() - days + 1)

    const endDateStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(endDate)

    const startDateStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(startDate)

    setTempStartDate(startDateStr)
    setTempEndDate(endDateStr)
    onDateRangeChange(startDateStr, endDateStr)
  }

  const setCurrentMonth = () => {
    const today = new Date(getCurrentDateIndonesia())
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const startDateStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(start)

    const endDateStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(end)

    setTempStartDate(startDateStr)
    setTempEndDate(endDateStr)
    onDateRangeChange(startDateStr, endDateStr)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Current Period Display - LEFT */}
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <Calendar className="h-4 w-4 text-blue-600" />
        <span className="font-medium">Periode:</span>
        <span className="bg-white px-2 py-1 rounded border text-xs">
          {new Date(startDate).toLocaleDateString('id-ID', {
            timeZone: INDONESIA_TIMEZONE,
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })} - {new Date(endDate).toLocaleDateString('id-ID', {
            timeZone: INDONESIA_TIMEZONE,
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick Range Buttons */}
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(1)}
          className="text-xs h-7 px-2"
        >
          Hari Ini
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(7)}
          className="text-xs h-7 px-2"
        >
          7 Hari
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(30)}
          className="text-xs h-7 px-2"
        >
          30 Hari
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={setCurrentMonth}
          className="text-xs h-7 px-2"
        >
          Bulan Ini
        </Button>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-300" />

      {/* Custom Date Range */}
      <div className="flex items-center gap-2">
        <Input
          id="startDate"
          type="date"
          value={tempStartDate}
          onChange={(e) => setTempStartDate(e.target.value)}
          className="w-32 h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <span className="text-gray-500 text-xs">—</span>
        <Input
          id="endDate"
          type="date"
          value={tempEndDate}
          onChange={(e) => setTempEndDate(e.target.value)}
          className="w-32 h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          onClick={applyDateRange}
          size="sm"
          className="h-7 px-3 text-xs"
          disabled={!tempStartDate || !tempEndDate}
        >
          Terapkan
        </Button>
      </div>
    </div>
  )
}