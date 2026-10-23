const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const root = path.resolve(__dirname, '../..')
const outDir = path.join(root, 'output/playwright/v4-completion/regression')
fs.mkdirSync(outDir, { recursive: true })
const appUrl = process.env.MEMENTO_TEST_URL || 'http://127.0.0.1:1433/'
const v3Backup = path.join(root, 'src/data/fixtures/legacy/backup-v3.json')
const v4Backup = path.join(root, 'src/data/fixtures/legacy/backup-v4-import-transaction.json')
const results = {
  appUrl,
  browser: 'Microsoft Edge via isolated Playwright browser context',
  dataBoundary: 'Fresh in-memory browser context; synthetic repository fixtures only; no persistent browser profile or user database.',
  checks: [],
  screenshots: [],
}
const pageErrors = []

function record(name, detail) {
  results.checks.push({ name, detail })
  console.log(`PASS ${name}: ${detail}`)
}

async function waitForApp(page) {
  await page.waitForSelector('.app-shell', { timeout: 15000 })
  await page.waitForFunction(() => document.querySelector('.app-shell')?.getAttribute('data-page') === 'now', { timeout: 15000 })
}

async function openSettings(page) {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.app-shell')?.getAttribute('data-page') === 'settings', { timeout: 10000 })
}

async function replaceFromBackup(page, backupPath, fileName, expectedTitle) {
  await openSettings(page)
  await page.getByRole('button', { name: '导入备份', exact: true }).click()
  await page.locator('#backup-import-v31').setInputFiles(backupPath)
  const dialog = page.getByRole('dialog', { name: '带回一段时间' })
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByText(fileName, { exact: true }).waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: '替换本机数据' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 15000 })
  await page.waitForFunction((title) => {
    try {
      return JSON.parse(localStorage.getItem('memento:app-state:v4') ?? 'null')?.moments?.some((moment) => moment.title === title) ?? false
    } catch {
      return false
    }
  }, expectedTitle, { timeout: 15000 })
  const status = page.getByRole('status').filter({ hasText: '已恢复 1 条记录；替换前快照已保留。' })
  await status.waitFor({ state: 'visible', timeout: 15000 })
  return await page.evaluate(() => ({
    state: JSON.parse(localStorage.getItem('memento:app-state:v4') ?? 'null'),
    recovery: JSON.parse(localStorage.getItem('memento:recovery-snapshot:v4') ?? 'null'),
    assetIndex: JSON.parse(localStorage.getItem('memento:asset-index:v1') ?? '[]'),
    oldAsset: localStorage.getItem('memento:asset-data:v1:fixture-photo-v3'),
    newAsset: localStorage.getItem('memento:asset-data:v1:incoming_photo_v4'),
  }))
}

async function saveScreenshot(page, name) {
  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' })
  results.screenshots.push(path.relative(root, file).replaceAll('\\', '/'))
}

async function verifyVisiblePhotoRecord(page, title) {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '时光', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.app-shell')?.getAttribute('data-page') === 'timeline', { timeout: 10000 })
  const recordButton = page.locator('.film29-index-record').filter({ hasText: title })
  await recordButton.waitFor({ state: 'visible' })
  const image = recordButton.locator('img')
  await image.waitFor({ state: 'visible' })
  const imageInfo = await image.evaluate(async (element) => {
    await element.decode()
    return { alt: element.alt, width: element.naturalWidth, height: element.naturalHeight, blobUrl: element.src.startsWith('blob:') }
  })
  assert.ok(imageInfo.width > 0 && imageInfo.height > 0, `${title}: hydrated photo did not render`)
  assert.equal(imageInfo.alt, title)
  assert.equal(imageInfo.blobUrl, true, `${title}: photo was not hydrated from an asset Blob URL`)
  return imageInfo
}

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--disable-gpu'],
  })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(appUrl, { waitUntil: 'networkidle' })
    await waitForApp(page)

    const legacyImport = await replaceFromBackup(page, v3Backup, 'backup-v3.json', '合成时刻 v3')
    assert.equal(legacyImport.state.schemaVersion, 4)
    assert.ok(legacyImport.state.moments.some((moment) => moment.id === 'fixture-moment-v3' && moment.title === '合成时刻 v3'))
    assert.deepEqual(legacyImport.state.moments.find((moment) => moment.id === 'fixture-moment-v3').photoIds, ['fixture-photo-v3'])
    assert.equal(Object.hasOwn(legacyImport.state, 'photos'), false, 'persisted v4 state embeds photo bytes')
    assert.equal(legacyImport.oldAsset !== null, true, 'v3 photo bytes were not stored in the asset adapter')
    await saveScreenshot(page, 'replace-restore-v3-before-next-replace')
    const oldImage = await verifyVisiblePhotoRecord(page, '合成时刻 v3')
    record('Replace imports a legacy v3 backup and hydrates its photo', `v4 state references fixture-photo-v3; its image rendered ${oldImage.width}×${oldImage.height} from a Blob URL`)

    const replaced = await replaceFromBackup(page, v4Backup, 'backup-v4-import-transaction.json', '导入事务合成记录')
    assert.equal(replaced.state.schemaVersion, 4)
    assert.ok(replaced.state.moments.some((moment) => moment.id === 'fixture-import-moment-v4' && moment.title === '导入事务合成记录'))
    assert.deepEqual(replaced.state.moments.find((moment) => moment.id === 'fixture-import-moment-v4').photoIds, ['incoming_photo_v4'])
    assert.ok(replaced.recovery?.state?.moments?.some((moment) => moment.id === 'fixture-moment-v3'), 'pre-replace state was not snapshotted')
    assert.deepEqual(replaced.recovery.state.moments.find((moment) => moment.id === 'fixture-moment-v3').photoIds, ['fixture-photo-v3'])
    assert.ok(replaced.oldAsset, 'pre-replace photo bytes were removed while the recovery snapshot referenced them')
    assert.equal(replaced.newAsset, 'CxYh', 'replacement photo bytes do not match the synthetic backup')
    const replacementMetadata = replaced.assetIndex.find((asset) => asset.id === 'incoming_photo_v4')
    assert.equal(replacementMetadata?.sizeBytes, 3)
    assert.equal(replacementMetadata?.sha256, '2e579a55e9461f8583d3df536b94e1aa011d0b9eca4702559ae6dd1c015acb37')
    await saveScreenshot(page, 'replace-restore-v4-replaced')
    record('Replace preserves the prior snapshot and both asset sets', 'active state is v4 import; recovery holds the v3 state/photo; new asset bytes and SHA-256 match the fixture')

    await openSettings(page)
    await page.getByRole('button', { name: '恢复快照', exact: true }).click()
    await page.getByRole('status').filter({ hasText: '已恢复替换前的时间册。' }).waitFor({ state: 'visible', timeout: 15000 })
    const restored = await page.evaluate(() => ({
      state: JSON.parse(localStorage.getItem('memento:app-state:v4') ?? 'null'),
      recovery: localStorage.getItem('memento:recovery-snapshot:v4'),
      assetIndex: JSON.parse(localStorage.getItem('memento:asset-index:v1') ?? '[]'),
      oldAsset: localStorage.getItem('memento:asset-data:v1:fixture-photo-v3'),
      newAsset: localStorage.getItem('memento:asset-data:v1:incoming_photo_v4'),
    }))
    assert.equal(restored.state.schemaVersion, 4)
    assert.ok(restored.state.moments.some((moment) => moment.id === 'fixture-moment-v3' && moment.title === '合成时刻 v3'))
    assert.deepEqual(restored.state.moments.find((moment) => moment.id === 'fixture-moment-v3').photoIds, ['fixture-photo-v3'])
    assert.equal(restored.recovery, null, 'recovery snapshot was not cleared after successful restore')
    assert.ok(restored.oldAsset, 'restored state photo bytes are missing')
    assert.equal(restored.newAsset, null, 'unreferenced replacement photo was not cleaned after recovery snapshot removal')
    assert.equal(restored.assetIndex.some((asset) => asset.id === 'fixture-photo-v3'), true)
    assert.equal(restored.assetIndex.some((asset) => asset.id === 'incoming_photo_v4'), false)
    const restoredImage = await verifyVisiblePhotoRecord(page, '合成时刻 v3')
    await saveScreenshot(page, 'replace-restore-v3-restored')
    record('Recovery restores prior state and photo, then clears the snapshot', `v3 record and photo are active again; replacement-only asset was removed; image rendered ${restoredImage.width}×${restoredImage.height}`)

    assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`)
    record('browser runtime', 'no uncaught page errors during Replace and recovery flow')
    results.pageErrors = pageErrors
    fs.writeFileSync(path.join(outDir, 'replace-restore-verification.json'), JSON.stringify(results, null, 2))
    console.log(`Wrote ${path.relative(root, path.join(outDir, 'replace-restore-verification.json'))}`)
    await context.close()
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
