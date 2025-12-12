"use client"

import { ReactNode } from "react"
import { Trash2, Loader2 } from "lucide-react"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

interface DeleteConfirmModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    title?: string
    description?: string
    itemName?: string
    loading?: boolean
    confirmLabel?: string
    cancelLabel?: string
    extraContent?: ReactNode
    className?: string
}

export function DeleteConfirmModal({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    itemName,
    loading = false,
    confirmLabel = "Hapus",
    cancelLabel = "Batal",
    extraContent,
    className,
}: DeleteConfirmModalProps) {
    const resolvedTitle = title || "Konfirmasi Hapus Data"
    const resolvedDescription =
        description ||
        "Data yang dihapus tidak dapat dipulihkan kembali. Pastikan Anda sudah yakin."

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className={cn("max-w-md", className)}>
                <AlertDialogHeader className="pb-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <AlertDialogTitle className="text-base font-semibold text-gray-900 truncate">
                                {resolvedTitle}
                            </AlertDialogTitle>
                            {itemName && (
                                <>
                                    <span className="text-slate-400">|</span>
                                    <p className="text-sm text-slate-600 truncate">
                                        {itemName}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </AlertDialogHeader>

                {resolvedDescription && (
                    <AlertDialogDescription className="mt-3 text-sm">
                        {resolvedDescription}
                    </AlertDialogDescription>
                )}

                {extraContent && (
                    <div className="mt-3 text-sm text-muted-foreground">
                        {extraContent}
                    </div>
                )}

                <AlertDialogFooter className="mt-4">
                    <AlertDialogCancel disabled={loading}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            onConfirm()
                        }}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Menghapus...
                            </>
                        ) : (
                            <>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {confirmLabel}
                            </>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
