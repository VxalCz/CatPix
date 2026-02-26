import { X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-[340px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-text-secondary">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-hover transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded text-xs text-white transition-colors cursor-pointer ${
              destructive
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
