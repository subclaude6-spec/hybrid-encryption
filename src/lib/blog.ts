/**
 * Blog content lives here as plain data so the pages stay presentational and a
 * post can be added without touching any component.
 */

export interface PostSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface Post {
  slug: string
  title: string
  excerpt: string
  /** ISO date; formatted for display by `formatPostDate`. */
  date: string
  readingMinutes: number
  tag: string
  /** Standfirst shown under the title on the post page. */
  lede: string
  sections: PostSection[]
}

export const POSTS: Post[] = [
  {
    slug: 'why-hybrid-encryption',
    title: 'Why we encrypt with AES and RSA instead of picking one',
    excerpt:
      'RSA is too slow to encrypt a 200 MB file and AES has no answer for "who else should be able to open this". Using both solves each problem with the algorithm suited to it.',
    date: '2026-08-04',
    readingMinutes: 6,
    tag: 'Cryptography',
    lede: 'The two-algorithm design is not belt-and-braces paranoia. Each algorithm covers a gap the other one cannot.',
    sections: [
      {
        heading: 'The problem with using RSA alone',
        paragraphs: [
          'RSA encrypts data smaller than its key. With a 2048-bit key and OAEP padding you get roughly 190 bytes of room. Encrypting a real document means splitting it into hundreds of thousands of blocks and running a modular exponentiation over every one, which is orders of magnitude slower than a symmetric cipher.',
          'Benchmarked in a browser, RSA-OAEP moves data at a rate measured in kilobytes per second. A 200 MB file would take long enough that the tab would be considered hung.',
        ],
      },
      {
        heading: 'The problem with using AES alone',
        paragraphs: [
          'AES-256-GCM encrypts that same file in under a second. What it cannot do is answer the distribution question: the sender and every recipient need the identical key, so you are back to the original problem of moving a secret between people who have no secure channel yet.',
          'Any scheme where the server holds that key to hand out later is a scheme where the server can read the file. That defeats the point.',
        ],
      },
      {
        heading: 'Using each for what it is good at',
        paragraphs: [
          'The hybrid construction gives each algorithm the job it suits. A fresh AES-256-GCM key is generated per file and encrypts the content. That key — 32 bytes, comfortably inside the RSA block limit — is then encrypted once per recipient under that recipient\'s public key.',
          'The stored artifact is the ciphertext plus a small header holding one wrapped key per authorized recipient. Adding a recipient re-wraps 32 bytes; it never re-encrypts the file.',
        ],
        bullets: [
          'Bulk speed comes from AES, which is hardware-accelerated on every modern CPU.',
          'Key distribution comes from RSA, where only the holder of the private key can unwrap.',
          'The server stores wrapped keys it has no private key for, so it cannot decrypt.',
          'Revoking a recipient means dropping their wrapped key from the header.',
        ],
      },
      {
        heading: 'What this does not protect against',
        paragraphs: [
          'Hybrid encryption protects the file at rest and in transit. It does not protect a recipient who is entitled to open the file and then leaks it, and it does not protect a device whose private key has been extracted. Those are handled by the audit trail and by key revocation, not by the cipher.',
        ],
      },
    ],
  },
  {
    slug: 'encryption-in-the-browser',
    title: 'Doing the encryption in the browser, and why that constraint matters',
    excerpt:
      'If plaintext reaches the server even briefly, the security claim becomes a promise rather than a property. Keeping the crypto client-side turns it into something structural.',
    date: '2026-07-22',
    readingMinutes: 5,
    tag: 'Architecture',
    lede: 'There is a meaningful difference between "we do not look at your files" and "we are not able to look at your files".',
    sections: [
      {
        heading: 'Trust you assert versus trust you do not need',
        paragraphs: [
          'A conventional upload sends plaintext to a server that encrypts it before writing to disk. The data is protected at rest, but there is a window where the server holds readable content. Everyone with production access, every crash dump, and every logging middleware sits inside that window.',
          'Moving encryption to the client closes the window. The server receives bytes it has no key for. This is a weaker requirement on operators, which is exactly what makes it a stronger guarantee for users.',
        ],
      },
      {
        heading: 'What the Web Crypto API gives you',
        paragraphs: [
          'All of this runs on primitives built into the browser. There is no third-party crypto library shipped in the bundle, which keeps the trusted surface small and avoids a class of supply-chain risk.',
          'Keys are generated as non-extractable where possible, meaning the JavaScript that created a key cannot read its raw bytes back out — it can only ask the browser to perform operations with it.',
        ],
        bullets: [
          'Content keys are generated with crypto.subtle.generateKey and never leave the page in raw form.',
          'Large files stream through chunked encryption so memory stays flat rather than scaling with file size.',
          'The initialization vector is random per file and stored alongside the ciphertext.',
          'GCM authentication tags mean a tampered file fails to decrypt rather than decrypting to garbage.',
        ],
      },
      {
        heading: 'The costs, stated plainly',
        paragraphs: [
          'Client-side encryption gives up conveniences that server-side systems get for free. The server cannot generate thumbnails, cannot index file contents for search, and cannot scan for malware, because it cannot read anything. Search is therefore limited to metadata.',
          'Recovery also changes shape. A lost private key means files wrapped only for that key are unrecoverable — no administrator can reset their way into the content. This is the honest consequence of the design rather than a bug to be patched later.',
        ],
      },
    ],
  },
  {
    slug: 'audit-logs-that-hold-up',
    title: 'Designing an audit trail that is useful after an incident',
    excerpt:
      'Most audit logs record that something happened without recording enough to reconstruct what happened. The difference only becomes visible when you actually need them.',
    date: '2026-07-09',
    readingMinutes: 4,
    tag: 'Security',
    lede: 'An audit log is written continuously and read almost never — usually at the worst possible moment.',
    sections: [
      {
        heading: 'Log the attempt, not just the success',
        paragraphs: [
          'A log containing only successful operations describes a system where nothing ever goes wrong. The interesting events during an investigation are the failures: decryption attempts by someone with no wrapped key, sign-ins from an unexpected location, repeated access to files outside a user\'s normal working set.',
          'Every decrypt attempt is recorded with its outcome. A denied attempt is a stronger signal than a permitted one, and dropping it discards precisely the evidence an investigation needs.',
        ],
      },
      {
        heading: 'Record enough to answer a question',
        paragraphs: [
          'An entry reading "file accessed" cannot answer any question worth asking. Each record carries the actor, the file, the operation, the outcome, and the timestamp, so a reviewer can reconstruct a sequence rather than infer one.',
        ],
        bullets: [
          'Actor — which account, resolved to a person rather than a session id.',
          'Object — which file, by stable identifier rather than by name, since names change.',
          'Operation — encrypt, decrypt, download, share, or revoke.',
          'Outcome — permitted or denied, with the reason for a denial.',
          'Time — server-assigned, because client clocks are attacker-controlled.',
        ],
      },
      {
        heading: 'Make the log readable by the person on call',
        paragraphs: [
          'Audit data that only a database query can reach will not be consulted during an incident. The admin view surfaces the same records as a filterable table with the security-relevant events called out, so the first question after an alert can be answered in the interface rather than in a psql session.',
        ],
      },
    ],
  },
  {
    slug: 'bring-your-own-storage',
    title: 'Bring your own storage: Drive, GitHub, or wherever else',
    excerpt:
      'Once files are encrypted before upload, the storage backend stops being a security decision and becomes a logistics one. That opens up options.',
    date: '2026-06-28',
    readingMinutes: 4,
    tag: 'Product',
    lede: 'When the provider cannot read what you store, choosing a provider stops being a question about trust.',
    sections: [
      {
        heading: 'The provider becomes interchangeable',
        paragraphs: [
          'In a conventional system, picking a storage provider means extending trust to them, and switching means re-evaluating that trust. When the artifact is already encrypted, the provider holds an opaque blob and the choice reduces to cost, quota, retention, and where the organization already has accounts.',
          'That is a much easier decision to make, and a much easier one to reverse.',
        ],
      },
      {
        heading: 'Scoping the Google Drive integration narrowly',
        paragraphs: [
          'The Drive integration requests the drive.file scope rather than full Drive access. That scope only grants access to files this application itself created; it cannot enumerate, read, or modify anything else in the account.',
          'It is the narrowest scope that still does the job, and it means connecting an account carries no implication for documents the app has nothing to do with.',
        ],
      },
      {
        heading: 'Using a repository as a vault',
        paragraphs: [
          'The GitHub destination treats a repository as storage, which is a reasonable fit for teams already living there — encrypted artifacts get version history and the existing access controls for free.',
          'Because what lands in the repository is ciphertext, a repository being more visible than intended does not expose file contents. Users pick or create the target repository during setup rather than having one imposed.',
        ],
      },
    ],
  },
]

export function getPost(slug: string | undefined): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}

export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
