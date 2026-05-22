import { AlertTriangle } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui'

interface DeleteConfirmDialogProps {
  confirmText: string
  description: string
  loading?: boolean
  open: boolean
  title: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function DeleteConfirmDialog({
  confirmText,
  description,
  loading = false,
  open,
  title,
  onConfirm,
  onOpenChange,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.98_0.018_93)] p-5 text-[oklch(0.22_0.06_240)] shadow-[0_8px_0_0_oklch(0.21_0.06_240_/_0.18)] sm:max-w-md">
        <DialogHeader className="gap-3 text-left">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.95_0.06_30)] sidequest-mini-shadow">
            <AlertTriangle className="h-7 w-7 text-[oklch(0.34_0.11_28)]" aria-hidden />
          </div>
          <DialogTitle className="sidequest-display text-3xl font-black leading-none text-[oklch(0.22_0.06_240)]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm font-bold leading-6 text-[oklch(0.34_0.055_240)]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0">
          <Button
            type="button"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="sidequest-button bg-[oklch(0.98_0.018_93)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.92_0.055_205)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={loading}
            onClick={onConfirm}
            className="sidequest-button bg-[oklch(0.95_0.06_30)] text-[oklch(0.34_0.11_28)] hover:bg-[oklch(0.91_0.08_30)]"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
