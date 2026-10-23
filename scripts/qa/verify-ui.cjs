const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const root = path.resolve(__dirname, '../..')
const outDir = path.join(root, 'output/playwright/v4-completion/regression')
fs.mkdirSync(outDir, { recursive: true })
const appUrl = process.env.MEMENTO_TEST_URL || 'http://127.0.0.1:1433/'
const fixturePath = path.join(root, 'src/data/fixtures/legacy/local-v3.json')
const importPath = path.join(root, 'src/data/fixtures/legacy/backup-v4-import-transaction.json')
const legacyFixture = fs.readFileSync(fixturePath, 'utf8')
const importFixture = fs.readFileSync(importPath, 'utf8')
const results = { appUrl, checks: [], screenshots: [], dimensions: [] }

function record(name, detail) {
  results.checks.push({ name, detail })
  console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`)
}

async function waitForApp(page) {
  await page.waitForSelector('.app-shell', { timeout: 15000 })
  await page.waitForFunction(() => document.querySelector('.app-shell')?.getAttribute('data-page') === 'now', { timeout: 15000 })
  await page.waitForTimeout(250)
}

async function checkViewport(page, label, width, height, viewportResult) {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(200)
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    mainWidth: document.querySelector('#main-content')?.scrollWidth ?? 0,
    page: document.querySelector('.app-shell')?.getAttribute('data-page'),
  }))
  assert.ok(metrics.documentWidth <= width + 1, `${label} ${width}x${height}: document overflow ${metrics.documentWidth}px`)
  assert.ok(metrics.bodyWidth <= width + 1, `${label} ${width}x${height}: body overflow ${metrics.bodyWidth}px`)
  if (label === 'degrees') {
    const number = await page.locator('.degree29-reading strong').evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      text: element.textContent,
    }))
    assert.ok(number.height <= number.fontSize * 1.2, `degrees ${width}x${height}: main number wrapped (${number.height}px at ${number.fontSize}px)`)
    metrics.mainNumber = number
  }
  viewportResult.push(metrics)
  return metrics
}

async function saveScreenshot(page, name) {
  const file = path.join(outDir, 'screenshots', `${name}.png`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' })
  results.screenshots.push(path.relative(root, file).replaceAll('\\', '/'))
}

async function gotoPage(page, id, label) {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: label, exact: true }).click()
  await page.waitForFunction((expected) => document.querySelector('.app-shell')?.getAttribute('data-page') === expected, id)
  await page.waitForTimeout(150)
}

async function main() {
  fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true })
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--disable-gpu'],
  })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.on('pageerror', (error) => { throw error })
    await page.addInitScript((raw) => {
      if (!localStorage.getItem('memento:app-state:v4')) localStorage.setItem('memento:app-state:v2', raw)
    }, legacyFixture)
    await page.goto(appUrl, { waitUntil: 'networkidle' })
    await waitForApp(page)

    const migrated = await page.evaluate(() => ({
      current: localStorage.getItem('memento:app-state:v4'),
      legacy: localStorage.getItem('memento:app-state:v2'),
      recovery: localStorage.getItem('memento:recovery-snapshot:v4'),
      asset: localStorage.getItem('memento:asset-data:v1:fixture-photo-v3'),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }))
    assert.ok(migrated.current, 'v4 state was not persisted')
    assert.equal(migrated.legacy, null, 'legacy key remains after migration')
    assert.ok(migrated.recovery, 'migration recovery snapshot was not persisted')
    assert.ok(migrated.asset, 'legacy photo bytes were not migrated')
    const current = JSON.parse(migrated.current)
    assert.equal(current.schemaVersion, 4)
    assert.equal(Object.hasOwn(current, 'photos'), false, 'v4 state contains runtime photo views')
    assert.equal(current.moments[0].id, 'fixture-moment-v3')
    assert.deepEqual(current.moments[0].photoIds, ['fixture-photo-v3'])
    assert.equal(migrated.reducedMotion, true)
    record('v3 local state and photo migration', 'v4 persisted; legacy key removed after verified migration; recovery snapshot and photo bytes retained')
    record('reduced-motion preference', 'Edge reports prefers-reduced-motion: reduce')

    // Corrupt only the isolated browser fixture to verify the persistent integrity warning and reference retention.
    await page.evaluate(() => localStorage.setItem('memento:asset-data:v1:fixture-photo-v3', 'AAAA'))
    await page.reload({ waitUntil: 'networkidle' })
    await waitForApp(page)
    const integrityAlert = page.getByRole('alert').filter({ hasText: '照片需要检查' })
    await integrityAlert.waitFor({ state: 'visible' })
    const afterCorruption = await page.evaluate(() => JSON.parse(localStorage.getItem('memento:app-state:v4')))
    assert.deepEqual(afterCorruption.moments[0].photoIds, ['fixture-photo-v3'])
    assert.match(await integrityAlert.innerText(), /没有自动删除/)
    record('corrupt-photo recovery warning', 'persistent alert shown while record/photo reference remains in stored state')

    const dimensionRuns = []
    const pages = [['now', '此刻'], ['timeline', '时光'], ['degrees', '几度'], ['settings', '我的']]
    for (const [id, label] of pages) {
      await gotoPage(page, id, label)
      for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
        const metrics = await checkViewport(page, id, width, height, dimensionRuns)
        await saveScreenshot(page, `${id}-${width}x${height}`)
        record(`layout ${id} ${width}x${height}`, `document ${metrics.documentWidth}px, body ${metrics.bodyWidth}px`)
      }
    }
    results.dimensions = dimensionRuns

    await page.setViewportSize({ width: 1280, height: 720 })
    await gotoPage(page, 'now', '此刻')
    const recordTrigger = page.getByRole('button', { name: '记一笔', exact: true }).first()
    await recordTrigger.click()
    const drawer = page.getByRole('dialog', { name: '记录一个时刻' })
    await drawer.waitFor({ state: 'visible' })
    const titleInput = drawer.locator('input[name="title"]')
    await titleInput.waitFor({ state: 'visible' })
    assert.equal(await titleInput.evaluate((element) => document.activeElement === element), true, 'drawer did not focus title input')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await drawer.evaluate((element) => element.contains(document.activeElement)), true, 'focus escaped the modal on Shift+Tab')
    await drawer.getByRole('button', { name: '保存这段时间' }).click()
    assert.match(await drawer.getByRole('alert').innerText(), /先给这段时间写一个名字/)
    assert.equal(await titleInput.evaluate((element) => document.activeElement === element), true, 'validation did not return focus to title input')
    await page.keyboard.press('Escape')
    await drawer.waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '记一笔')
    record('record drawer keyboard flow', 'initial focus, trapped Shift+Tab, required-field error focus, Escape close, and trigger focus restoration')

    await gotoPage(page, 'timeline', '时光')
    const filterGroup = page.getByRole('group', { name: '时间轴筛选' })
    await filterGroup.waitFor({ state: 'visible' })
    assert.ok(await filterGroup.getByRole('button').count() >= 2)
    record('timeline filter semantics', 'record filters are exposed as a named button group')

    await gotoPage(page, 'settings', '我的')
    await page.getByRole('navigation', { name: '设置目录' }).getByRole('button', { name: /阅读/ }).click()
    await page.getByLabel('阅读光线').selectOption('high-contrast')
    assert.equal(await page.locator('.app-shell').getAttribute('data-theme'), 'high-contrast')
    await page.getByRole('navigation', { name: '设置目录' }).getByRole('button', { name: /关于/ }).click()
    assert.match(await page.locator('.registry29-about').innerText(), /4\.0\.0/)
    record('high-contrast and About version', 'high-contrast mode applies; About page shows 4.0.0')
    await context.close()

    // A fresh isolated context exercises a failed state commit and retry during merge import.
    const importContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const importPage = await importContext.newPage()
    importPage.on('pageerror', (error) => { throw error })
    await importPage.goto(appUrl, { waitUntil: 'networkidle' })
    await waitForApp(importPage)
    const before = await importPage.evaluate(() => localStorage.getItem('memento:app-state:v4'))
    await importPage.evaluate(() => {
      const original = Storage.prototype.setItem
      let shouldFail = true
      Storage.prototype.setItem = function (key, value) {
        if (shouldFail && key === 'memento:app-state:v4' && String(value).includes('导入事务合成记录')) {
          shouldFail = false
          throw new DOMException('synthetic state quota failure', 'QuotaExceededError')
        }
        return original.call(this, key, value)
      }
    })
    await importPage.getByRole('button', { name: '我的', exact: true }).click()
    await importPage.getByRole('button', { name: '导入备份', exact: true }).click()
    await importPage.locator('#backup-import-v31').setInputFiles({ name: 'backup-v4-import-transaction.json', mimeType: 'application/json', buffer: Buffer.from(importFixture) })
    const importDialog = importPage.getByRole('dialog', { name: '带回一段时间' })
    await importDialog.waitFor({ state: 'visible' })
    await importDialog.getByRole('button', { name: '合并导入' }).click()
    const importToast = importPage.getByRole('status').filter({ hasText: '备份导入未完成' })
    await importToast.waitFor({ state: 'visible' })
    const failedState = await importPage.evaluate(() => ({
      state: localStorage.getItem('memento:app-state:v4'),
      asset: localStorage.getItem('memento:asset-data:v1:incoming_photo_v4'),
      index: localStorage.getItem('memento:asset-index:v1'),
    }))
    assert.equal(failedState.state, before, 'failed import modified the current state')
    assert.equal(failedState.asset, null, 'failed import left staged photo bytes behind')
    assert.equal((JSON.parse(failedState.index ?? '[]')).some((item) => item.id === 'incoming_photo_v4'), false, 'failed import left staged metadata behind')
    assert.match(await importToast.innerText(), /synthetic state quota failure/)
    await importDialog.getByRole('button', { name: '合并导入' }).click()
    await importPage.getByRole('status').filter({ hasText: '已合并 1 条记录' }).waitFor({ state: 'visible' })
    const retried = await importPage.evaluate(() => ({ state: JSON.parse(localStorage.getItem('memento:app-state:v4')), asset: localStorage.getItem('memento:asset-data:v1:incoming_photo_v4') }))
    assert.ok(retried.state.moments.some((moment) => moment.title === '导入事务合成记录'))
    assert.ok(retried.asset, 'successful retry did not persist photo bytes')
    record('merge import failure and retry', 'quota failure left state and asset index unchanged; same staged backup succeeded on retry')
    await importContext.close()

    fs.writeFileSync(path.join(outDir, 'browser-verification.json'), JSON.stringify(results, null, 2))
    console.log(`Wrote ${path.relative(root, path.join(outDir, 'browser-verification.json'))}`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
