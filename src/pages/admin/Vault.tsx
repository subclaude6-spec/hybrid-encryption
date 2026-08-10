import { useMemo, useState } from 'react'
import { useApp } from '@/store/AppStore'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Badge, Select } from '@/components/ui/primitives'
import { VaultTable } from '@/components/VaultTable'
import { ShieldCheck } from 'lucide-react'

export default function AdminVault() {
  const { vaultFiles, users } = useApp()
  const [owner, setOwner] = useState('all')

  const options = useMemo(
    () => [
      { value: 'all', label: 'All employees' },
      ...users
        .filter((u) => u.role === 'employee')
        .map((u) => ({ value: u.id, label: u.name })),
    ],
    [users],
  )

  const files = useMemo(
    () => (owner === 'all' ? vaultFiles : vaultFiles.filter((f) => f.ownerId === owner)),
    [vaultFiles, owner],
  )

  return (
    <>
      <PageHeader
        title="All files"
        subtitle="Every encrypted envelope across the organisation, with its key reference."
        badge={
          <Badge tone="violet" icon={<ShieldCheck className="size-3" />}>
            Admin scope
          </Badge>
        }
      />
      <PageBody className="flex flex-col">
        <VaultTable
          files={files}
          showOwner
          filters={
            <Select value={owner} onChange={setOwner} options={options} className="w-52" />
          }
        />
      </PageBody>
    </>
  )
}
