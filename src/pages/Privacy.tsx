import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

const LAST_UPDATED = 'August 15, 2026'

export default function Privacy() {
  return (
    <div className="min-h-full overflow-y-auto bg-ink-950 px-6 py-12 text-fg">
      <div className="mx-auto max-w-2xl">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300">
          <ShieldCheck className="size-4" />
          Hybrid Cloud Encryption
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-fg">Privacy Policy</h1>
        <p className="mt-1 text-sm text-fg-subtle">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-fg-muted">
          <section>
            <h2 className="text-base font-medium text-fg">Overview</h2>
            <p className="mt-2">
              Hybrid Cloud Encryption ("the app", "we", "our") lets an organization's employees
              encrypt files on their own device before storing them in a cloud provider such as
              Google Drive. This page explains what data we collect, why, and how it's handled.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-fg">What we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <span className="text-fg">Account information</span> — name, work email,
                department, and role, provisioned by your organization's administrator or
                supplied via Google sign-in (name, email address, profile picture).
              </li>
              <li>
                <span className="text-fg">File metadata</span> — filename, size, upload time, and
                which cloud provider a file was sent to. File contents are encrypted on your
                device before upload; we do not retain unencrypted copies of your files.
              </li>
              <li>
                <span className="text-fg">Audit and security logs</span> — sign-ins, key usage,
                and decryption attempts, recorded so administrators can investigate suspicious
                activity on their organization's account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-fg">Google Drive access</h2>
            <p className="mt-2">
              When you connect a Google account, we request the{' '}
              <code className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-fg">drive.file</code>{' '}
              scope. This scope only grants access to files this app itself creates in your
              Drive — it cannot see, list, or modify any other file already in your Google
              Drive. We also request your basic profile (name, email) to identify your account.
              We never receive or store your Google account password.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-fg">How encryption works</h2>
            <p className="mt-2">
              Files are encrypted in your browser using AES-256-GCM before they ever leave your
              device. The encryption key is wrapped separately for each authorized recipient.
              We do not have the ability to read the contents of an encrypted file without a
              valid, individually issued decryption key.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-fg">Data sharing</h2>
            <p className="mt-2">
              We do not sell or share your personal data with third parties for advertising or
              marketing purposes. Data is only shared with the cloud storage provider you
              explicitly connect (e.g. Google Drive), solely to store the encrypted file you
              choose to upload.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-fg">Data retention and deletion</h2>
            <p className="mt-2">
              Account and file metadata are retained for as long as your organization's account
              is active, or as required for audit purposes. You can request deletion of your
              account and associated data by contacting your organization's administrator or the
              contact below.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-fg">Contact</h2>
            <p className="mt-2">
              Questions about this policy or your data can be sent to{' '}
              <a
                href="mailto:arjun.thirumurugan03@gmail.com"
                className="text-brand-400 hover:text-brand-300"
              >
                arjun.thirumurugan03@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
