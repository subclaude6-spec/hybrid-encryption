import { useRef, useState } from 'react'
import { FileLock2, FileText, Trash2, UploadCloud } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import { Button } from './ui/primitives'

export function LocalFileDrop({
  files,
  onChange,
  multiple = true,
  accept,
  title = 'Select files from this PC',
  hint = 'Drag files here, or browse. Each file is encrypted locally before it leaves your machine.',
}: {
  files: File[]
  onChange: (files: File[]) => void
  multiple?: boolean
  accept?: string
  title?: string
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function add(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return
    const next = Array.from(incoming)
    onChange(multiple ? [...files, ...next] : next.slice(0, 1))
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          add(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl2 border border-dashed px-6 py-10 text-center transition-all duration-200',
          dragging
            ? 'border-brand-500/60 bg-brand-500/[0.07]'
            : 'border-ink-600 bg-ink-900 hover:border-ink-600 hover:bg-ink-850',
        )}
      >
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl2 border border-ink-700 bg-ink-800 text-brand-400">
          <UploadCloud className="size-5" />
        </div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-fg-muted">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {files.length > 0 ? (
        <div className="overflow-hidden rounded-xl2 border border-ink-700 bg-ink-900">
          <div className="flex items-center justify-between border-b border-ink-700 bg-ink-850 px-4 py-2.5">
            <p className="text-xs font-medium text-fg">
              {files.length} file{files.length > 1 ? 's' : ''} queued ·{' '}
              <span className="text-fg-muted">{formatBytes(totalBytes)}</span>
            </p>
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Clear all
            </Button>
          </div>
          <ul className="max-h-56 divide-y divide-ink-800 overflow-y-auto">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                {file.name.endsWith('.hce') ? (
                  <FileLock2 className="size-4 shrink-0 text-brand-400" />
                ) : (
                  <FileText className="size-4 shrink-0 text-fg-subtle" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-fg-subtle">
                  {formatBytes(file.size)}
                </span>
                <button
                  onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
