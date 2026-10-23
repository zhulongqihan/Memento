import assert from 'node:assert/strict'

// Tauri CLI 2.11.4 patches this exact token for NSIS and then restores the
// unpatched build output. All remaining executable bytes must stay identical.
// https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle.rs
export function expectedNsisExecutable(portableBytes) {
  const token = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_UNK')
  const replacement = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_NSS')
  const offset = portableBytes.indexOf(token)
  assert.ok(offset >= 0, 'Expected Tauri bundle marker is missing; review the bundler identity contract')
  const expected = Buffer.from(portableBytes)
  replacement.copy(expected, offset)
  return expected
}
