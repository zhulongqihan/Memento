import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { chromium } from 'playwright'

// Never redirect the local user's profile. The actual production resolver must
// resolve to the independent hosted VM's Known Folder, verified before launch.
if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') {
  throw new Error('Native verification requires a disposable GitHub hosted Windows runner; local execution is refused.')
}
const root = resolve(import.meta.dirname, '..')
const out = join(root, 'output', 'native-verification')
mkdirSync(out, { recursive: true })
const profile = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-File', join(root, 'scripts/windows-test-profile.ps1')], { encoding: 'utf8' }).trim())
const dataDir = join(profile.knownFolder, 'com.zhulongqihan.memento')
assert.equal(existsSync(dataDir), false, 'Refusing to use an existing application data directory')
const dbPath = join(dataDir, 'memento.db')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const release = join(root, 'output', 'releases', version)
const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'), 'utf8'))
assert.equal(manifest.sourceDirty, false, `Final verification requires committed source: ${JSON.stringify(manifest.sourceChanges ?? [])}`)
assert.equal(manifest.sourceCommit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim())
const portable = join(release, 'portable', `Memento-${version}-portable.exe`)
const installer = join(release, manifest.artifacts.find((item) => item.path.startsWith('installer/')).path)
const baseline = join(root, 'output', 'baseline-3.1.0', 'Memento-3.1.0.exe')
assert.ok(existsSync(baseline), 'Actual old-version executable is required for upgrade testing')
const installDir = join(process.env.RUNNER_TEMP, `memento-qa-install-${process.env.GITHUB_RUN_ID}`)
assert.equal(existsSync(installDir), false, 'Refusing an existing install test directory')
const fixture = JSON.parse(readFileSync(join(root, 'src/data/fixtures/legacy/local-v3.json'), 'utf8'))
let legacyState = fixture
const originalPhoto = Buffer.from(fixture.photos[0].dataUrl.split(',')[1], 'base64')
const photoPath = join(dataDir, 'assets', fixture.photos[0].id)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase()
const report = { status: 'running', profile, sourceCommit: manifest.sourceCommit, artifacts: manifest.artifacts, expectedInstalledExecutable: manifest.expectedInstalledExecutable, snapshots: [], viewports: [], checks: [], pageErrors: [] }
const webViewPolicyScript = join(root, 'scripts/windows-webview-test-policy.ps1')
const webViewPolicySnapshot = join(out, 'webview-policy-before.json')
let running
const check = (name, evidence = {}) => { report.checks.push({ name, ...evidence }); console.log(`PASS ${name}`) }

async function until(predicate, label, timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Timed out waiting for ${label}`)
}
function withDb(fn) {
  assert.ok(existsSync(dbPath), 'Synthetic DB must exist before opening')
  const database = new DatabaseSync(dbPath)
  try { database.exec('PRAGMA busy_timeout=10000'); return fn(database) } finally { database.close() }
}
function row(id = 'current') {
  return withDb((database) => {
    const item = database.prepare('SELECT payload FROM app_state WHERE id=?').get(id)
    return item ? JSON.parse(item.payload) : null
  })
}
function migration() { return withDb((database) => database.prepare('SELECT status, phase FROM asset_migration_log ORDER BY updated_at DESC LIMIT 1').get()) }
function snapshotDatabase(file, expectedSchema, expectedStatus) {
  const destination = join(out, file)
  assert.equal(existsSync(destination), false, 'Refusing to replace an evidence snapshot')
  const tables = ['app_state', 'photo_assets', 'asset_migration_log']
  const source = withDb((database) => {
    const rows = tables.map((table) => database.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
    // A raw copy of a WAL database can omit committed transactions. SQLite's
    // transactional export includes the live logical contents and leaves the
    // original database unchanged: https://www.sqlite.org/lang_vacuum.html
    database.prepare('VACUUM INTO ?').run(destination)
    return rows
  })
  const exported = new DatabaseSync(destination, { readOnly: true })
  try {
    assert.equal(exported.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
    tables.forEach((table, index) => assert.deepEqual(exported.prepare(`SELECT * FROM ${table} ORDER BY id`).all(), source[index]))
    assert.equal(JSON.parse(exported.prepare("SELECT payload FROM app_state WHERE id='current'").get().payload).schemaVersion, expectedSchema)
    assert.equal(exported.prepare('SELECT status FROM asset_migration_log ORDER BY updated_at DESC LIMIT 1').get().status, expectedStatus)
  } finally { exported.close() }
  report.snapshots.push({ file, sha256: hash(readFileSync(destination)), currentSchema: expectedSchema, migrationStatus: expectedStatus, integrity: 'ok', completeRowsMatchSource: true })
}
function inspectMigration(failed) {
  const current = row()
  const recovery = row('recovery')
  const log = migration()
  if (failed) assert.deepEqual(current, legacyState)
  else {
    assert.equal(current.schemaVersion, 4)
    assert.equal(Object.hasOwn(current, 'photos'), false)
    for (const field of ['moments', 'elapsed', 'remaining', 'stages', 'dailyEntries', 'savedNarrations']) assert.deepEqual(current[field], legacyState[field], `Migration changed legacy ${field}`)
    for (const use of legacyState.narrationUses) assert.deepEqual(current.narrationUses.find((item) => item.id === use.id), use)
    for (const [key, value] of Object.entries(legacyState.settings)) assert.deepEqual(current.settings[key], value, `Migration changed setting ${key}`)
  }
  assert.equal(recovery.state.schemaVersion, 4)
  assert.equal(log.status, failed ? 'failed' : 'committed')
  assert.equal(log.phase, failed ? 'committing_state' : 'completed')
  assert.deepEqual(readFileSync(photoPath), originalPhoto)
  const asset = withDb((database) => database.prepare('SELECT size_bytes, sha256 FROM photo_assets WHERE id=?').get(fixture.photos[0].id))
  assert.equal(asset.size_bytes, originalPhoto.length)
  assert.equal(asset.sha256.toUpperCase(), hash(originalPhoto))
  return { currentSchema: current.schemaVersion, recoverySchema: recovery.state.schemaVersion, migration: log, photoBytes: originalPhoto.length, photoSha256: hash(originalPhoto) }
}
function runInstaller() {
  const result = spawnSync(installer, ['/S', `/D=${installDir}`], { windowsHide: true, timeout: 180000, encoding: 'utf8' })
  assert.equal(result.status, 0, `Installer failed: ${result.error ?? result.stderr}`)
  const installed = join(installDir, 'memento.exe')
  assert.ok(existsSync(installed))
  const installedBytes = readFileSync(installed)
  assert.equal(installedBytes.length, manifest.expectedInstalledExecutable.bytes)
  assert.equal(hash(installedBytes), manifest.expectedInstalledExecutable.sha256, 'Installed exe differs beyond the exact Tauri NSIS bundle marker')
  return installed
}
async function stop() {
  if (!running) return
  const owned = running
  running = null
  if (owned.process.exitCode === null) spawnSync('taskkill.exe', ['/PID', String(owned.process.pid), '/T', '/F'], { windowsHide: true })
  await owned.browser?.close().catch(() => {})
  await until(() => owned.process.exitCode !== null || owned.process.signalCode !== null, 'owned app exit', 15000)
}
async function start(exe, label, expectApp = true) {
  await stop()
  const userDataFolder = join(process.env.RUNNER_TEMP, `memento-webview-${label}`)
  execFileSync('powershell.exe', ['-NoProfile', '-File', webViewPolicyScript, '-Mode', 'Configure', '-Executable', exe, '-UserDataFolder', userDataFolder, '-StateFile', webViewPolicySnapshot], { stdio: 'pipe' })
  const child = spawn(exe, [], { windowsHide: true, env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9225', WEBVIEW2_USER_DATA_FOLDER: userDataFolder }, stdio: ['ignore', 'pipe', 'pipe'] })
  running = { process: child, browser: null }
  let logs = ''
  child.stdout.on('data', (data) => { logs += data; writeFileSync(join(out, `${label}.log`), logs) })
  child.stderr.on('data', (data) => { logs += data; writeFileSync(join(out, `${label}.log`), logs) })
  await until(async () => {
    if (child.exitCode !== null) throw new Error(`Application exited before WebView: ${child.exitCode}\n${logs}`)
    try { return (await fetch('http://127.0.0.1:9225/json/version')).ok } catch { return false }
  }, `${label} WebView CDP`)
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9225')
  running.browser = browser
  let page
  await until(() => { page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('tauri.localhost')); return Boolean(page) }, 'actual Tauri page')
  page.on('pageerror', (error) => report.pageErrors.push({ label, message: error.message }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (expectApp) {
    await page.locator('.app-shell').waitFor({ timeout: 30000 })
    await page.locator('.world-loading').waitFor({ state: 'hidden' })
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth }))
    assert.equal(viewport.width, 1440)
    assert.equal(viewport.height, 900)
    assert.ok(viewport.documentWidth <= viewport.width, 'Native layout overflowed its desktop viewport')
    report.viewports.push({ label, ...viewport })
    await page.screenshot({ path: join(out, `${label}.png`) })
  }
  return page
}
async function nav(page, name) { await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click(); await page.locator('.world-loading').waitFor({ state: 'hidden' }) }
async function uninstall() {
  const file = readdirSync(installDir).find((name) => /uninstall.*\.exe$/i.test(name))
  assert.ok(file, 'Uninstaller missing')
  const result = spawnSync(join(installDir, file), ['/S'], { windowsHide: true, timeout: 60000 })
  assert.equal(result.status, 0)
  await until(() => !existsSync(join(installDir, 'memento.exe')), 'uninstall removal')
  assert.ok(existsSync(dbPath), 'Uninstall removed user database')
}

try {
  for (const item of manifest.artifacts) assert.equal(hash(readFileSync(join(release, item.path))), item.sha256)
  let installed = runInstaller()
  await start(installed, 'fresh-installed')
  await until(() => { try { return row()?.schemaVersion === 4 } catch { return false } }, 'fresh SQLite state')
  await stop()
  const freshState = row()
  await uninstall()
  assert.deepEqual(row(), freshState)
  check('fresh final installer launches real UI and uninstall preserves SQLite', { installedSha256: manifest.expectedInstalledExecutable.sha256, portableSha256: hash(readFileSync(portable)) })

  mkdirSync(installDir, { recursive: true })
  copyFileSync(baseline, join(installDir, 'memento.exe'))
  withDb((database) => {
    database.exec('DROP TABLE photo_assets; DROP TABLE asset_migration_log; DELETE FROM app_state;')
    database.prepare('INSERT INTO app_state (id, payload, updated_at) VALUES (?, ?, ?)').run('current', JSON.stringify(fixture), new Date().toISOString())
  })
  const legacyTables = withDb((database) => database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((item) => item.name))
  assert.deepEqual(legacyTables, ['app_state'], 'Upgrade must start with the actual legacy table layout')
  await start(join(installDir, 'memento.exe'), 'actual-3.1.0-baseline')
  await stop()
  legacyState = row()
  assert.equal(legacyState.schemaVersion, 3)
  assert.equal(legacyState.photos[0].dataUrl, fixture.photos[0].dataUrl)
  check('actual 3.1.0 runs with a synthetic legacy-only database', { sourceCommit: '6d4bf8a35c99ceaf459a0851dc4fc10cf89940f4', version: '3.1.0', baselineSha256: hash(readFileSync(baseline)), tables: legacyTables })
  withDb((database) => database.exec("CREATE TRIGGER fail_current_update BEFORE UPDATE ON app_state WHEN NEW.id = 'current' BEGIN SELECT RAISE(ABORT, 'synthetic current-row failure'); END;"))
  installed = runInstaller()
  assert.deepEqual(row(), legacyState, 'Installer modified legacy data before startup')
  check('final installer replaces actual 3.1.0 executable without changing legacy database', { baselineSha256: hash(readFileSync(baseline)) })

  await start(portable, 'portable-commit-failure', false)
  await until(() => { try { return migration()?.status === 'failed' } catch { return false } }, 'migration failure journal')
  await stop()
  check('production portable preserves v3 state, v4 recovery and photos on commit failure', inspectMigration(true))
  snapshotDatabase('failure-state.db', 3, 'failed')
  withDb((database) => database.exec('DROP TRIGGER fail_current_update'))
  let page = await start(portable, 'portable-retry')
  await until(() => { try { return migration()?.status === 'committed' } catch { return false } }, 'successful migration retry')
  check('same production portable retries migration successfully', inspectMigration(false))
  await nav(page, '时光')
  await page.locator('.film29-index-record').filter({ hasText: '合成时刻 v3' }).click()
  await page.locator('img.detail-photo').evaluate((image) => image.decode())
  await page.screenshot({ path: join(out, 'migrated-photo.png') })
  await stop()
  snapshotDatabase('migrated-state.db', 4, 'committed')
  mkdirSync(join(out, 'assets'), { recursive: true })
  copyFileSync(photoPath, join(out, 'assets', fixture.photos[0].id))
  assert.deepEqual(readFileSync(join(out, 'assets', fixture.photos[0].id)), originalPhoto)

  writeFileSync(photoPath, Buffer.from('synthetic damage'))
  page = await start(installed, 'installed-damaged-photo')
  await nav(page, '时光')
  await page.locator('.film29-index-record').filter({ hasText: '合成时刻 v3' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '编辑', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: '编辑这段时光' })
  assert.equal(await drawer.locator('.unavailable-photo').count(), 1)
  await drawer.locator('textarea[name=note]').fill('原生文字编辑保留损坏照片关联')
  await drawer.getByRole('button', { name: '保存修改' }).click()
  await until(() => row().moments[0].note === '原生文字编辑保留损坏照片关联', 'native edit commit')
  await stop()
  assert.deepEqual(row().moments[0].photoIds, [fixture.photos[0].id])
  assert.equal(readFileSync(photoPath, 'utf8'), 'synthetic damage')
  check('final installed UI preserves damaged photo references during a text edit in SQLite')
  writeFileSync(photoPath, originalPhoto)

  page = await start(installed, 'installed-recovery')
  const beforeReplace = row()
  await nav(page, '我的')
  await page.locator('input[type=file]').setInputFiles(join(root, 'src/data/fixtures/legacy/backup-v4-import-transaction.json'))
  await page.getByRole('button', { name: '替换本机数据', exact: true }).click()
  await until(() => row().moments[0]?.id === 'fixture-import-moment-v4', 'native replace commit')
  assert.deepEqual(row('recovery').state.moments, beforeReplace.moments)
  assert.deepEqual(readFileSync(photoPath), originalPhoto)
  await page.getByRole('button', { name: '恢复快照', exact: true }).click()
  await until(() => row().moments[0]?.id === 'fixture-moment-v3' && row('recovery') === null, 'native recovery restore')
  assert.deepEqual(row().moments, beforeReplace.moments)
  await nav(page, '时光')
  await page.locator('.film29-index-record').filter({ hasText: '合成时刻 v3' }).click()
  await page.locator('img.detail-photo').evaluate((image) => image.decode())
  await page.screenshot({ path: join(out, 'restored-photo.png') })
  await stop()
  assert.equal(existsSync(join(dataDir, 'assets', 'incoming_photo_v4')), false)
  check('production replace and recovery preserve old state/photos and clean replacement-only assets')
  const beforeUninstall = row()
  await uninstall()
  assert.deepEqual(row(), beforeUninstall)
  assert.deepEqual(readFileSync(photoPath), originalPhoto)
  check('final uninstall retains migrated user state and photo bytes')
  assert.deepEqual(report.pageErrors, [])
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = error.stack
  try {
    const processes = execFileSync('powershell.exe', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*memento*.exe' -or $_.Name -eq 'msedgewebview2.exe' } | Select-Object Name,ProcessId,ParentProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Depth 3"], { encoding: 'utf8' })
    writeFileSync(join(out, 'failure-processes.json'), processes)
  } catch (diagnosticError) { report.diagnosticError = diagnosticError.message }
  throw error
} finally {
  try { await stop() } catch (error) { report.status = 'failed'; report.cleanupError = error.stack; throw error }
  finally {
    try { execFileSync('powershell.exe', ['-NoProfile', '-File', webViewPolicyScript, '-Mode', 'Restore', '-StateFile', webViewPolicySnapshot], { stdio: 'pipe' }) }
    catch (error) { report.status = 'failed'; report.policyCleanupError = error.stack; throw error }
    finally { writeFileSync(join(out, 'result.json'), JSON.stringify(report, null, 2)) }
  }
}
