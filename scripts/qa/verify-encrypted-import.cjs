const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const root = path.resolve(__dirname, '../..')
const outDir = path.join(root, 'output/playwright/v4-completion/regression')
fs.mkdirSync(outDir, { recursive: true })
const appUrl = process.env.MEMENTO_TEST_URL || 'http://127.0.0.1:1433/'
const fixturePath = path.join(root, 'src/data/fixtures/legacy/encrypted-backup-v3-3.1.0.memento')
const encryptedFixture = fs.readFileSync(fixturePath)
const results = { appUrl, checks: [], screenshots: [], pageErrors: [] }

function record(name, detail) {
  results.checks.push({ name, detail })
  console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`)
}

async function waitForApp(page, pageId = 'now') {
  await page.waitForSelector('.app-shell', { timeout: 15000 })
  await page.waitForFunction((expected) => document.querySelector('.app-shell')?.getAttribute('data-page') === expected, pageId, { timeout: 15000 })
}

async function screenshot(page, name) {
  const file = path.join(outDir, 'screenshots', `${name}.png`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' })
  results.screenshots.push(path.relative(root, file).replaceAll('\\', '/'))
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
    page.on('pageerror', (error) => results.pageErrors.push(error.message))
    await page.goto(appUrl, { waitUntil: 'networkidle' })
    await waitForApp(page)
    await page.waitForFunction(() => localStorage.getItem('memento:app-state:v4') !== null)
    const before = await page.evaluate(() => localStorage.getItem('memento:app-state:v4'))

    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的', exact: true }).click()
    await waitForApp(page, 'settings')
    await page.locator('input[name="backupPassword"]').fill('wrong-pass-2026')
    await page.getByRole('button', { name: '导入备份', exact: true }).click()
    await page.locator('#backup-import-v31').setInputFiles({
      name: 'encrypted-backup-v3-3.1.0.memento',
      mimeType: 'application/octet-stream',
      buffer: encryptedFixture,
    })
    const passwordError = page.getByRole('status').filter({ hasText: '密码错误或加密备份已损坏' })
    await passwordError.waitFor({ state: 'visible' })
    assert.equal(await page.evaluate(() => localStorage.getItem('memento:app-state:v4')), before)
    record('reject wrong encrypted-backup password', 'user sees a clear error and current v4 state remains byte-for-byte unchanged')

    await page.locator('input[name="backupPassword"]').fill('legacy-pass-3.1.0')
    await page.getByRole('button', { name: '导入备份', exact: true }).click()
    await page.locator('#backup-import-v31').setInputFiles({
      name: 'encrypted-backup-v3-3.1.0.memento',
      mimeType: 'application/octet-stream',
      buffer: encryptedFixture,
    })
    const preview = page.getByRole('dialog', { name: '带回一段时间' })
    await preview.waitFor({ state: 'visible' })
    assert.deepEqual(await preview.locator('.import-summary strong').allTextContents(), ['1', '1'])
    await screenshot(page, 'encrypted-v3-import-preview')
    record('preview encrypted v3 backup', 'correct password unlocks the 3.1.0 v3 sample and shows its actual record/photo counts')

    await preview.getByRole('button', { name: '替换本机数据' }).click()
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('memento:app-state:v4')
      if (!raw) return false
      const state = JSON.parse(raw)
      return state.moments.some((moment) => moment.id === 'fixture-moment-v3')
    }, { timeout: 15000 })
    const restored = await page.evaluate(() => ({
      state: JSON.parse(localStorage.getItem('memento:app-state:v4')),
      recovery: JSON.parse(localStorage.getItem('memento:recovery-snapshot:v4') ?? 'null'),
      bytes: localStorage.getItem('memento:asset-data:v1:fixture-photo-v3'),
    }))
    assert.equal(restored.state.schemaVersion, 4)
    assert.equal(Object.hasOwn(restored.state, 'photos'), false)
    assert.deepEqual(restored.state.moments[0].photoIds, ['fixture-photo-v3'])
    assert.ok(restored.bytes, 'v3 photo bytes were not persisted as a separate asset')
    assert.ok(restored.recovery, 'Replace did not preserve a pre-import recovery snapshot')
    record('replace from encrypted v3 backup', 'v4 state, independent photo bytes, and pre-import recovery snapshot are present')

    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '时光', exact: true }).click()
    await waitForApp(page, 'timeline')
    await page.locator('.film29-ruler').waitFor({ state: 'visible' })
    const importedRecord = page.locator('.film29-index-record').filter({ hasText: '合成时刻 v3' })
    await importedRecord.waitFor({ state: 'visible' })
    const photo = importedRecord.locator('img')
    await photo.waitFor({ state: 'visible' })
    await photo.evaluate((image) => new Promise((resolve, reject) => {
      if (image.complete && image.naturalWidth > 0) return resolve()
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => reject(new Error(`Imported photo failed to decode: ${image.src}`)), { once: true })
    }))
    const dimensions = await photo.evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }))
    assert.deepEqual(dimensions, { width: 1, height: 1 })
    await screenshot(page, 'encrypted-v3-imported-photo')
    record('render photo from encrypted backup', 'imported v3 photo decodes at 1×1 after replacement')

    assert.deepEqual(results.pageErrors, [], `page errors: ${results.pageErrors.join('; ')}`)
    await context.close()
    fs.writeFileSync(path.join(outDir, 'encrypted-import-verification.json'), JSON.stringify(results, null, 2))
    console.log(`Wrote ${path.relative(root, path.join(outDir, 'encrypted-import-verification.json'))}`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
