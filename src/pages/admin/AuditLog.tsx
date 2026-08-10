import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Badge, Select } from '@/components/ui/primitives'
import { LogTable } from '@/components/LogTable'

export default function AuditLog() {
  const { logs, users } = useApp()
  const [userId, setUserId] = useState('all')

  const options = useMemo(
    () => [
      { value: 'all', label: 'All employees' },
      ...users.map((u) => ({
        value: u.id,
        label: u.role === 'admin' ? `${u.name} (admin)` : u.name,
      })),
    ],
    [users],
  )

  const rows = useMemo(
    () => (userId === 'all' ? logs : logs.filter((l) => l.userId === userId)),
    [logs, userId],
  )

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every event from every account. Select one employee or review them all."
        badge={
          <Badge tone="violet" icon={<Users className="size-3" />}>
            Organisation-wide
          </Badge>
        }
      />
      <PageBody className="flex flex-col">
        <LogTable
          logs={rows}
          showUser
          userFilter={
            <Select value={userId} onChange={setUserId} options={options} className="w-52" />
          }
        />
      </PageBody>
    </>
  )
}
