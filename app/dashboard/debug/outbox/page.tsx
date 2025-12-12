'use client'

import { useCallback } from 'react'
import { useOutboxEntries } from '@/lib/db/hooks'
import { processOutboxBatch } from '@/lib/db/outbox'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    RefreshCw,
    Send,
    AlertCircle,
    CheckCircle2,
    Clock
} from 'lucide-react'

const COLUMN_WIDTHS = {
    id: '6%',
    table: '12%',
    operation: '10%',
    status: '10%',
    created_at: '13%',
    updated_at: '13%',
    local_id: '8%',
    payload: '14%',
    error: '14%',
} as const

function formatDateTime(value: string) {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('id-ID')
}

function formatPayload(payload: any) {
    if (payload === null || payload === undefined) return '-'
    try {
        const str =
            typeof payload === 'string'
                ? payload
                : JSON.stringify(payload)
        if (str.length > 140) {
            return str.slice(0, 137) + '...'
        }
        return str
    } catch {
        return String(payload)
    }
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'pending') {
        return (
            <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50">
                <Clock className="w-3 h-3 mr-1" />
                Pending
            </Badge>
        )
    }
    if (status === 'in_progress') {
        return (
            <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Sedang diproses
            </Badge>
        )
    }
    if (status === 'completed') {
        return (
            <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Selesai
            </Badge>
        )
    }
    if (status === 'failed') {
        return (
            <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50">
                <AlertCircle className="w-3 h-3 mr-1" />
                Gagal
            </Badge>
        )
    }

    return <Badge variant="outline">{status}</Badge>
}

export default function OutboxDebugPage() {
    const { entries, stats } = useOutboxEntries()
    const { toast } = useToast()

    const handleProcessNow = useCallback(async () => {
        try {
            await processOutboxBatch(50)
            toast({
                title: 'Outbox diproses',
                description: 'Batch outbox berhasil dijalankan.',
            })
        } catch (error: any) {
            toast({
                title: 'Gagal memproses outbox',
                description: error?.message || 'Terjadi kesalahan saat memproses outbox.',
                variant: 'destructive',
            })
        }
    }, [toast])

    return (
        <TooltipProvider delayDuration={0}>
        <div className="h-full flex flex-col overflow-hidden bg-white">
            {/* Top bar - pattern like penagihan */}
            <div className="flex-shrink-0 border-b bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Title & description */}
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                            Outbox
                        </span>
                        <span className="text-[11px] text-gray-500">
                            Antrean operasi offline (insert/update/delete/billing/shipment) yang dikirim ke Supabase.
                        </span>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Stats summary */}
                    <div className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span>Total:</span>
                        <Badge variant="outline">{stats.total}</Badge>
                        <span>Pending:</span>
                        <Badge variant="outline">{stats.pending}</Badge>
                        <span>In progress:</span>
                        <Badge variant="outline">{stats.in_progress}</Badge>
                        <span>Failed:</span>
                        <Badge variant="outline">{stats.failed}</Badge>
                    </div>

                    {/* Actions */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleProcessNow}
                        className="h-7 text-xs"
                    >
                        <Send className="w-3 h-3 mr-1" />
                        Proses Outbox
                    </Button>
                </div>
            </div>

            {/* Table container - follows dashboard layout pattern */}
            <div className="flex-1 flex flex-col min-h-0">
                <Card className="flex-1 flex flex-col rounded-none border-0 border-t">
                    <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden px-0 pb-0">
                        {entries.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                Tidak ada antrean outbox.
                            </div>
                        ) : (
                            <div className="h-full w-full overflow-auto scrollbar-thin">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead style={{ width: COLUMN_WIDTHS.id }}>ID</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.table }}>Tabel</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.operation }}>Operasi</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.status }}>Status</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.created_at }}>Dibuat</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.updated_at }}>Diupdate</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.local_id }}>Local ID</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.payload }}>Payload</TableHead>
                                            <TableHead style={{ width: COLUMN_WIDTHS.error }}>Error</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {entries.map((entry) => (
                                            <TableRow key={entry.id}>
                                                <TableCell style={{ width: COLUMN_WIDTHS.id }} className="font-mono text-xs">
                                                    {entry.id}
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.table }} className="text-xs">
                                                    {entry.table}
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.operation }} className="text-xs capitalize">
                                                    {entry.operation.replace(/_/g, ' ')}
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.status }}>
                                                    <StatusBadge status={entry.status} />
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.created_at }} className="text-xs whitespace-nowrap">
                                                    {formatDateTime(entry.created_at)}
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.updated_at }} className="text-xs whitespace-nowrap">
                                                    {formatDateTime(entry.updated_at)}
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.local_id }} className="text-xs">
                                                    {entry.local_temp_id ?? '-'}
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.payload }} className="text-xs max-w-[260px] whitespace-nowrap overflow-hidden text-ellipsis">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help">
                                                                {formatPayload(entry.payload)}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-[480px] max-h-[260px] overflow-auto">
                                                            <pre className="text-[11px] whitespace-pre-wrap break-all">
                                                                {JSON.stringify(entry.payload, null, 2)}
                                                            </pre>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell style={{ width: COLUMN_WIDTHS.error }} className="text-xs max-w-[260px]">
                                                    {entry.error_message ? (
                                                        <span className="text-red-600">
                                                            {entry.error_message}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            -
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        </TooltipProvider>
    )
}
