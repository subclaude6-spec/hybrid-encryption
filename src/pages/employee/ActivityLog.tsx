import { Lock } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/primitives'
import { LogTable } from '@/components/LogTable'

export default function ActivityLog() {
  const { visibleLogs } = useApp()
  const logs = visibleLogs()

  return (
    <>
      <PageHeader
        title="My activity"
        subtitle="Every action taken on your account. Your administrator sees the same rows."
        badge={
          <Badge tone="brand" icon={<Lock className="size-3" />}>
            Scoped to you
          </Badge>
        }
      />
      <PageBody className="flex flex-col">
        <LogTable logs={logs} />
      </PageBody>
    </>
  )
}
