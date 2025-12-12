'use client'

/**
 * Virtual Table Component
 * 
 * Uses TanStack Virtual for efficient rendering of large datasets.
 * Only renders visible rows + a small buffer for smooth scrolling.
 */

import React, { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

export interface VirtualTableColumn<T> {
    id: string
    header: string
    accessor: keyof T | ((row: T) => React.ReactNode)
    width?: string | number
    className?: string
    headerClassName?: string
}

export interface VirtualTableProps<T> {
    data: T[]
    columns: VirtualTableColumn<T>[]
    rowHeight?: number
    className?: string
    containerClassName?: string
    maxHeight?: string | number
    onRowClick?: (row: T, index: number) => void
    rowClassName?: string | ((row: T, index: number) => string)
    emptyMessage?: string
    isLoading?: boolean
}

export function VirtualTable<T extends Record<string, any>>({
    data,
    columns,
    rowHeight = 48,
    className,
    containerClassName,
    maxHeight = '600px',
    onRowClick,
    rowClassName,
    emptyMessage = 'Tidak ada data',
    isLoading = false
}: VirtualTableProps<T>) {
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: 10, // Render 10 extra rows outside viewport
    })

    const virtualRows = virtualizer.getVirtualItems()

    // Calculate cell value
    const getCellValue = (row: T, column: VirtualTableColumn<T>) => {
        if (typeof column.accessor === 'function') {
            return column.accessor(row)
        }
        return row[column.accessor]
    }

    // Loading skeleton
    if (isLoading) {
        return (
            <div className={cn('rounded-lg border bg-card', containerClassName)}>
                <div className="animate-pulse">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="flex border-b last:border-0">
                            {columns.map((col, j) => (
                                <div
                                    key={j}
                                    className="p-4"
                                    style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
                                >
                                    <div className="h-4 bg-muted rounded" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // Empty state
    if (data.length === 0) {
        return (
            <div className={cn('rounded-lg border bg-card p-12 text-center', containerClassName)}>
                <p className="text-muted-foreground">{emptyMessage}</p>
            </div>
        )
    }

    return (
        <div className={cn('rounded-lg border bg-card overflow-hidden', containerClassName)}>
            {/* Header */}
            <div className="flex bg-muted/50 border-b sticky top-0 z-10">
                {columns.map((column) => (
                    <div
                        key={column.id}
                        className={cn(
                            'px-4 py-3 font-medium text-sm text-muted-foreground',
                            column.headerClassName
                        )}
                        style={{
                            width: column.width || 'auto',
                            flex: column.width ? 'none' : 1,
                            minWidth: column.width || undefined
                        }}
                    >
                        {column.header}
                    </div>
                ))}
            </div>

            {/* Virtualized Body */}
            <div
                ref={parentRef}
                className={cn('overflow-auto scrollbar-thin', className)}
                style={{ maxHeight }}
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {virtualRows.map((virtualRow) => {
                        const row = data[virtualRow.index]
                        const rowClass = typeof rowClassName === 'function'
                            ? rowClassName(row, virtualRow.index)
                            : rowClassName

                        return (
                            <div
                                key={virtualRow.key}
                                className={cn(
                                    'flex border-b last:border-0 hover:bg-muted/30 transition-colors',
                                    onRowClick && 'cursor-pointer',
                                    rowClass
                                )}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                onClick={() => onRowClick?.(row, virtualRow.index)}
                            >
                                {columns.map((column) => (
                                    <div
                                        key={column.id}
                                        className={cn(
                                            'px-4 py-3 text-sm flex items-center',
                                            column.className
                                        )}
                                        style={{
                                            width: column.width || 'auto',
                                            flex: column.width ? 'none' : 1,
                                            minWidth: column.width || undefined
                                        }}
                                    >
                                        {getCellValue(row, column)}
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer with count */}
            <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                Total: {data.length.toLocaleString('id-ID')} data
            </div>
        </div>
    )
}

/**
 * Virtual List Component (for simpler lists)
 */
export interface VirtualListProps<T> {
    data: T[]
    renderItem: (item: T, index: number) => React.ReactNode
    itemHeight?: number
    className?: string
    maxHeight?: string | number
}

export function VirtualList<T>({
    data,
    renderItem,
    itemHeight = 40,
    className,
    maxHeight = '400px'
}: VirtualListProps<T>) {
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemHeight,
        overscan: 5,
    })

    const virtualItems = virtualizer.getVirtualItems()

    if (data.length === 0) {
        return null
    }

    return (
        <div
            ref={parentRef}
            className={cn('overflow-auto scrollbar-thin', className)}
            style={{ maxHeight }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualItems.map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        {renderItem(data[virtualItem.index], virtualItem.index)}
                    </div>
                ))}
            </div>
        </div>
    )
}
