"use client"

import { ReactNode } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import {
    Dialog,
    DialogPortal,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ModalBoxMode = "detail" | "edit"

interface ModalBoxProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode?: ModalBoxMode
    title?: string
    description?: string
    children?: ReactNode
    footer?: ReactNode
    className?: string
}

export function ModalBox({
    open,
    onOpenChange,
    mode = "detail",
    title,
    description,
    children,
    footer,
    className,
}: ModalBoxProps) {
    const resolvedTitle =
        title || (mode === "detail" ? "Detail Data" : "Edit Data")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                {/* Overlay tanpa blur, hanya darkening */}
                <DialogPrimitive.Overlay
                    className="fixed inset-0 z-40 bg-slate-950/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                />

                {/* Konten modal */}
                <DialogPrimitive.Content
                    className={cn(
                        "fixed left-1/2 top-1/2 z-50 h-[80vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "flex flex-col",
                        className,
                    )}
                >
                    {/* Header */}
                    <div
                        className="flex items-center border-b border-slate-300 px-5 py-3"
                        style={{ backgroundColor: "#007E6E" }}
                    >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-white">
                            <DialogTitle className="text-base sm:text-lg font-semibold text-white truncate">
                                {resolvedTitle}
                            </DialogTitle>
                            {description && (
                                <>
                                    <span className="text-white/60">|</span>
                                    <DialogDescription className="text-sm text-white/80 truncate">
                                        {description}
                                    </DialogDescription>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 flex-1 min-h-0 overflow-auto bg-white">
                        {children}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                        {footer ? (
                            footer
                        ) : (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                className="h-8 px-3 bg-red-600 text-white hover:bg-red-700"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Tutup
                            </Button>
                        )}
                    </div>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    )
}
