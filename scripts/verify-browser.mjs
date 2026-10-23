import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const out = join(root, 'output', 'playwright', 'v4-completion')
mkdirSync(out, { recursive: true })
const url = 'http://127.0.0.1:1433'
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '1433', '--strictPort'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let serverOutput = ''
server.stdout.on('data', (data) => { serverOutput += data })
server.stderr.on('data', (data) => { serverOutput += data })
const report = { status: 'running', checks: [], pageErrors: [], screenshots: [] }
let browser
const check = (name) => { report.checks.push(name); console.log(`PASS ${name}`) }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')

async function waitUntil(checkFn, label, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await checkFn()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
async function screenshot(page, name) {
  const file = join(out, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' })
  report.screenshots.push(file)
}
async function app(page) { await page.locator('.app-shell').waitFor(); await page.locator('.world-loading').waitFor({ state: 'hidden' }) }
async function nav(page, name) { await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click(); await app(page) }
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('memento:app-state:v4'))) }
async function saved(page, predicate) { await waitUntil(async () => predicate(await stored(page)), 'persisted state') }
async function openMoment(page, title) { await nav(page, '时光'); await page.getByRole('button', { name: '索引', exact: true }).click(); await page.locator('.film29-index-record').filter({ hasText: title }).click(); return page.getByRole('dialog', { name: `${title}详情` }) }

try {
  await waitUntil(async () => {
    if (server.exitCode !== null) throw new Error(`Preview failed: ${serverOutput}`)
    try { return (await fetch(url)).ok } catch { return false }
  }, 'preview server')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', (error) => report.pageErrors.push(error.message))
  await page.goto(url)
  await app(page)
  await page.getByRole('button', { name: '记一笔', exact: true }).first().click()
  let drawer = page.getByRole('dialog', { name: '记录一个时刻' })
  await drawer.locator('input[name=title]').fill('三张照片的时刻')
  for (let i = 0; i < 3; i++) await drawer.locator('input[type=file]').setInputFiles({ name: `photo-${i}.png`, mimeType: 'image/png', buffer: png })
  assert.equal(await drawer.locator('.photo-thumb img').count(), 3)
  await drawer.getByRole('button', { name: '保存这段时间' }).click()
  await saved(page, (state) => state?.moments.some((item) => item.title === '三张照片的时刻'))
  const photoIds = (await stored(page)).moments.find((item) => item.title === '三张照片的时刻').photoIds
  assert.equal(photoIds.length, 3)
  await page.reload(); await app(page)
  let detail = await openMoment(page, '三张照片的时刻')
  assert.equal(await detail.locator('img.detail-photo').count(), 3)
  await detail.locator('img.detail-photo').evaluateAll(async (images) => { await Promise.all(images.map((image) => image.decode())) })
  await screenshot(page, 'three-photos')
  check('three uploaded photos survive reload and all decode in normal detail')
  await detail.getByRole('button', { name: '关闭', exact: true }).click()
  await page.evaluate((ids) => {
    localStorage.removeItem(`memento:asset-data:v1:${ids[0]}`)
    localStorage.setItem(`memento:asset-data:v1:${ids[1]}`, btoa('corrupt'))
  }, photoIds)
  await page.reload(); await app(page)
  detail = await openMoment(page, '三张照片的时刻')
  await detail.getByRole('button', { name: '编辑', exact: true }).click()
  drawer = page.getByRole('dialog', { name: '编辑这段时光' })
  assert.equal(await drawer.locator('.unavailable-photo').count(), 2)
  await drawer.locator('textarea[name=note]').fill('仅修改文字，不移除照片')
  await drawer.getByRole('button', { name: '保存修改' }).click()
  await saved(page, (state) => state?.moments[0]?.note === '仅修改文字，不移除照片')
  await page.reload(); await app(page)
  assert.deepEqual((await stored(page)).moments[0].photoIds, photoIds)
  check('real UI text edit preserves both missing and corrupt photo references after reload')
  detail = await openMoment(page, '三张照片的时刻')
  await detail.getByRole('button', { name: '编辑', exact: true }).click()
  drawer = page.getByRole('dialog', { name: '编辑这段时光' })
  await screenshot(page, 'unavailable-photo-edit')
  await drawer.getByRole('button', { name: '移除第 1 张暂不可用照片', exact: true }).click()
  await drawer.getByRole('button', { name: '保存修改' }).click()
  await saved(page, (state) => state?.moments[0]?.photoIds.length === 2)
  assert.deepEqual((await stored(page)).moments[0].photoIds, photoIds.slice(1))
  check('only an explicit photo removal changes the reference set')
  await context.close()

  const second = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const p = await second.newPage()
  p.on('pageerror', (error) => report.pageErrors.push(error.message))
  await p.goto(url); await app(p)
  for (const [tab, kind] of [['经年', 'elapsed'], ['余下', 'remaining'], ['刻度', 'stage']]) {
    await nav(p, '几度')
    await p.getByRole('tab', { name: new RegExp(tab) }).click()
    await p.locator('.degree29-new').click()
    drawer = p.getByRole('dialog')
    await drawer.locator('input[name=title]').fill(`测试${tab}`)
    await drawer.getByRole('button', { name: '保存这段时间' }).click()
    const key = kind === 'stage' ? 'stages' : kind
    await saved(p, (state) => state?.[key].some((item) => item.title === `测试${tab}`))
    if (kind === 'stage') await p.getByRole('button', { name: /查看测试刻度阶段详情/ }).click()
    await p.getByRole('button', { name: `编辑测试${tab}`, exact: true }).click()
    drawer = p.getByRole('dialog')
    assert.equal(await drawer.locator('input[name=title]').inputValue(), `测试${tab}`)
    await drawer.locator('input[name=title]').fill(`已改${tab}`)
    await drawer.getByRole('button', { name: '保存修改' }).click()
    await saved(p, (state) => state?.[key].some((item) => item.title === `已改${tab}`))
    check(`${tab} edit prepopulates name and saves the existing record`)
  }
  await p.getByRole('button', { name: /查看已改刻度阶段详情/ }).click()
  await p.getByRole('button', { name: '暂停展示', exact: true }).click()
  await p.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
  const paused = p.getByRole('button', { name: /查看已改刻度阶段详情；已暂停/ })
  await paused.waitFor()
  assert.ok(!(await p.locator('.degree29-measurement').innerText()).includes('已改刻度'))
  await p.reload(); await app(p); await nav(p, '几度'); await p.getByRole('tab', { name: /刻度/ }).click()
  await paused.click()
  await p.getByRole('button', { name: '重新启用', exact: true }).click()
  await p.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
  assert.ok((await p.locator('.degree29-measurement').innerText()).includes('已改刻度'))
  check('paused stage remains manageable after reload and is excluded from the main reading')
  for (const [tab, key, pin] of [['经年', 'elapsed', 'pinnedElapsedId'], ['余下', 'remaining', 'pinnedRemainingId']]) {
    await p.getByRole('tab', { name: new RegExp(tab) }).click()
    await p.getByRole('tabpanel', { name: new RegExp(tab) }).getByRole('button', { name: '置顶', exact: true }).click()
    p.once('dialog', (dialog) => dialog.accept())
    await p.getByRole('button', { name: `删除已改${tab}`, exact: true }).click()
    await saved(p, (state) => state?.[key].length === 0 && !state.settings[pin])
    check(`${tab} single deletion also clears its pin`)
  }

  // Seed only this isolated context with past days, then exercise actual history UI.
  await p.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('memento:app-state:v4'))
    state.dailyEntries = ['2026-09-01', '2026-10-01'].map((date) => ({ id: `daily-${date}`, date, text: `${date} 留下的一行`, createdAt: `${date}T00:00:00.000Z`, updatedAt: `${date}T00:00:00.000Z` }))
    localStorage.setItem('memento:app-state:v4', JSON.stringify(state))
  })
  await p.reload(); await app(p); await nav(p, '时光')
  await p.getByRole('button', { name: '每日一行', exact: true }).click()
  assert.equal(await p.locator('.daily-history-list li').count(), 2)
  await p.getByLabel('按月份查找每日一行').fill('2026-09')
  assert.equal(await p.locator('.daily-history-list li').count(), 1)
  await p.getByRole('button', { name: '编辑 2026-09-01 的一行', exact: true }).click()
  await p.getByLabel('修改 2026-09-01 的一行').fill('旧日的文字已补全')
  await p.getByRole('button', { name: '保存这一行', exact: true }).click()
  await saved(p, (state) => state?.dailyEntries.some((entry) => entry.date === '2026-09-01' && entry.text === '旧日的文字已补全'))
  await p.reload(); await app(p); await nav(p, '时光'); await p.getByRole('button', { name: '每日一行', exact: true }).click()
  assert.ok((await p.locator('.daily-history').innerText()).includes('旧日的文字已补全'))
  for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
    await p.setViewportSize({ width, height })
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await screenshot(p, `daily-history-${width}`)
  }
  p.once('dialog', (dialog) => dialog.accept())
  await p.getByRole('button', { name: '删除 2026-09-01 的一行', exact: true }).click()
  await saved(p, (state) => state?.dailyEntries.length === 1 && state.dailyEntries[0].date === '2026-10-01')
  check('history supports month filtering, editing with original date, reload and single deletion')
  assert.deepEqual(report.pageErrors, [])
  await second.close()
  for (const script of ['verify-ui.cjs', 'verify-encrypted-import.cjs', 'verify-replace-restore.cjs']) {
    await new Promise((resolve, reject) => {
      const process = spawn(globalThis.process.execPath, [join(root, 'scripts', 'qa', script)], { cwd: root, env: { ...globalThis.process.env, MEMENTO_TEST_URL: url }, windowsHide: true, stdio: 'inherit' })
      process.on('error', reject)
      process.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${script} failed: ${code}`)))
    })
    check(`existing regression: ${script}`)
  }
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = error.stack
  throw error
} finally {
  writeFileSync(join(out, 'verification.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  server.kill()
}
