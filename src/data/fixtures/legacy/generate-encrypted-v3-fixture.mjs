import { webcrypto } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const sourceUrl = new URL('./backup-v3.json', import.meta.url)
const targetUrl = new URL('./encrypted-backup-v3-3.1.0.memento', import.meta.url)
const password = 'legacy-pass-3.1.0'
const salt = Uint8Array.from({ length: 16 }, (_, index) => index)
const iv = Uint8Array.from({ length: 12 }, (_, index) => 0x10 + index)
const payload = JSON.parse(await readFile(sourceUrl, 'utf8'))

if (payload.manifest?.schemaVersion !== 3 || payload.manifest?.appVersion !== '3.1.0') {
  throw new Error('Source must remain the synthetic Memento 3.1.0 schema v3 backup.')
}

const passwordKey = await webcrypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveKey'],
)
const key = await webcrypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
  passwordKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
)
const encrypted = await webcrypto.subtle.encrypt(
  { name: 'AES-GCM', iv, tagLength: 128 },
  key,
  new TextEncoder().encode(JSON.stringify(payload)),
)

const envelope = {
  format: 'memento-encrypted-backup-v1',
  version: 1,
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 210_000 },
  cipher: { name: 'AES-GCM', tagLength: 128 },
  salt: Buffer.from(salt).toString('base64'),
  iv: Buffer.from(iv).toString('base64'),
  ciphertext: Buffer.from(encrypted).toString('base64'),
}

await writeFile(targetUrl, `${JSON.stringify(envelope, null, 2)}\n`)
console.log(`Wrote ${targetUrl.pathname}`)
