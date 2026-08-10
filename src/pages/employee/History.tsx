import { Link } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import { useApp } from '@/store/AppStore'
import { PageBody, PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/primitives'
import { VaultTable } from '@/components/VaultTable'

export default function History() {
  const { visibleVaultFiles } = useApp()
  const files = visibleVaultFiles()

  return (
    <>
      <PageHeader
        title="My files"
        subtitle="Everything you have encrypted, and where each envelope is stored."
        actions={
          <Link to="/app/upload">
            <Button size="sm" icon={<UploadCloud className="size-3.5" />}>
              Encrypt new files
            </Button>
          </Link>
        }
      />
      <PageBody className="flex flex-col">
        <VaultTable files={files} />
      </PageBody>
    </>
  )
}
