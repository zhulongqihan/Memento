import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.match(version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/)
const out = join(root, 'output', 'playwright', `release-${version}`, 'state-flows')
mkdirSync(out, { recursive: true })
const url = 'http://127.0.0.1:1446'
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), ...(process.argv.includes('--preview') ? ['preview'] : []), '--host', '127.0.0.1', '--port', '1446', '--strictPort'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let serverOutput = ''
server.stdout.on('data', data => { serverOutput += data })
server.stderr.on('data', data => { serverOutput += data })
const report = { status: 'running', version, syntheticOnly: true, checks: [], errors: [] }
const stamp = { createdAt: '2026-10-30T00:00:00.000Z', updatedAt: '2026-10-30T00:00:00.000Z' }
const fixture = {
  schemaVersion: 4,
  moments: [{ id: 'one', title: '独立测试一', kind: 'first', date: '2026-10-29', note: '原始笔记', photoIds: [], ...stamp }, { id: 'two', title: '独立测试二', kind: 'milestone', date: '2025-01-02', photoIds: [], ...stamp }],
  elapsed: [{ id: 'elapsed', title: '已有经年', startDate: '2000-01-01', ...stamp }],
  remaining: [{ id: 'remaining', title: '已有余下', endDate: '2026-11-30', unit: 'custom', weekdays: [0, 1, 2, 3, 4, 5, 6], ...stamp }],
  stages: [{ id: 'stage', title: '已有刻度', kind: 'custom', startDate: '2026-01-01', endDate: '2026-12-31', enabled: true, ...stamp }],
  dailyEntries: [{ id: 'today', date: '2026-10-30', text: '今天已保存的一行', ...stamp }, { id: 'yesterday', date: '2026-10-29', text: '昨天已保存的一行', ...stamp }],
  narrationUses: [], savedNarrations: [],
  settings: { displayName: '合成工程验证', displayLifeProgress: false, theme: 'light', displayDensity: 'comfortable', numberFormat: 'plain', timelineFilter: 'all', dailyNarrationEnabled: false },
}
let browser
async function until(fn, label, timeout = 15_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await fn()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
async function ready(page) { await page.locator('.app-shell').waitFor(); await page.locator('.world-loading').waitFor({ state: 'hidden' }) }
async function nav(page, name) { await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click(); await ready(page) }
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('memento:app-state:v4'))) }
async function setup(time = '2026-10-30T12:00:00+08:00', state = fixture) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  await page.clock.install({ time: new Date(time) })
  await page.addInitScript(state => { if (!localStorage.getItem('memento:app-state:v4')) localStorage.setItem('memento:app-state:v4', JSON.stringify(state)) }, state)
  await page.goto(url); await ready(page)
  return { context, page }
}
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }

try {
  await until(async () => {
    if (server.exitCode !== null) throw new Error(serverOutput)
    try { return (await fetch(url)).ok } catch { return false }
  }, 'state flow server')
  browser = await chromium.launch({ channel: 'msedge', headless: true })

  {
    const { context, page } = await setup()
    let dialogs = 0
    let accept = false
    page.on('dialog', async dialog => { dialogs += 1; await (accept ? dialog.accept() : dialog.dismiss()) })
    await page.locator('.record-button').click()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(dialogs, 0)
    await page.locator('.record-button').click()
    await page.locator('input[name=title]').fill('不能静默丢弃的草稿')
    await page.keyboard.press('Escape')
    assert.equal(dialogs, 1); assert.equal(await page.locator('input[name=title]').inputValue(), '不能静默丢弃的草稿')
    await page.getByRole('button', { name: '关闭记录面板', exact: true }).click()
    assert.equal(dialogs, 2); assert.equal(await page.getByRole('dialog').count(), 1)
    assert.equal(await page.getByRole('dialog').evaluate(element => element.contains(document.activeElement)), true)
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
    assert.equal(dialogs, 3); assert.equal(await page.getByRole('dialog').count(), 1)
    await page.locator('.drawer-type-row').getByRole('button', { name: '经年', exact: true }).click()
    assert.equal(dialogs, 4); assert.equal(await page.getByRole('dialog').getAttribute('aria-label'), '记录一个时刻')
    accept = true
    await page.locator('.drawer-type-row').getByRole('button', { name: '经年', exact: true }).click()
    assert.equal(dialogs, 5); assert.equal(await page.getByRole('dialog').getAttribute('aria-label'), '创建一段经年')
    await page.keyboard.press('Escape')
    assert.equal(dialogs, 6); assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal((await stored(page)).elapsed.length, 1)
    accept = false
    await page.locator('.record-button').click()
    await page.locator('.photo-upload input').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') })
    await page.keyboard.press('Escape')
    assert.equal(dialogs, 7); assert.equal(await page.getByRole('dialog').count(), 1)
    await page.getByRole('button', { name: '移除synthetic.png', exact: true }).click()
    await page.keyboard.press('Escape')
    assert.equal(dialogs, 7); assert.equal(await page.getByRole('dialog').count(), 0)
    await context.close()
    check('Escape, close, backdrop and new-type changes guard dirty drafts; photo additions count, reverting to the initial draft closes without confirmation')
  }

  {
    const { context, page } = await setup()
    await nav(page, '几度')
    await page.getByRole('button', { name: '编辑已有经年', exact: true }).click()
    const drawer = page.getByRole('dialog')
    await drawer.locator('.drawer-type-row').getByRole('button', { name: '经年', exact: true }).click()
    assert.equal(await drawer.getAttribute('aria-label'), '编辑这段经年')
    for (const name of ['时刻', '余下', '刻度']) assert.equal(await drawer.locator('.drawer-type-row').getByRole('button', { name, exact: true }).isDisabled(), true)
    await drawer.locator('input[name=title]').fill('修改原有经年')
    await drawer.getByRole('button', { name: '保存修改', exact: true }).click()
    await until(async () => (await stored(page)).elapsed[0].title === '修改原有经年', 'edited elapsed persisted')
    const elapsed = (await stored(page)).elapsed
    assert.equal(elapsed.length, 1); assert.equal(elapsed[0].id, 'elapsed')
    await page.getByRole('button', { name: '编辑修改原有经年', exact: true }).click()
    await page.locator('input[name=title]').fill('取消的草稿')
    page.once('dialog', dialog => dialog.accept())
    await page.keyboard.press('Escape')
    assert.equal((await stored(page)).elapsed[0].title, '修改原有经年')
    await context.close()
    check('editing retains its identity when selecting the active type; other types cannot silently turn an edit into creation; Escape preserves saved data')
  }

  {
    const { context, page } = await setup()
    await nav(page, '时光')
    await page.getByRole('searchbox').fill('独立测试一')
    await page.getByRole('button', { name: '胶片', exact: true }).click()
    await nav(page, '几度'); await nav(page, '时光')
    assert.equal(await page.getByRole('searchbox').inputValue(), '独立测试一')
    assert.equal(await page.locator('.world-timeline-v29').getAttribute('data-timeline-view'), 'film')
    assert.equal(await page.locator('.film29-record').count(), 1)
    await page.getByRole('button', { name: '每日一行', exact: true }).click()
    await nav(page, '我的'); await nav(page, '时光')
    assert.equal(await page.locator('.world-timeline-v29').getAttribute('data-timeline-view'), 'daily')
    await context.close()
    check('timeline search and selected view survive navigation away and back')
  }

  {
    const { context, page } = await setup()
    const daily = page.getByRole('region', { name: '今日一行', exact: true })
    page.once('dialog', dialog => dialog.dismiss())
    await daily.getByRole('button', { name: '删除', exact: true }).click()
    assert.equal((await stored(page)).dailyEntries.length, 2)
    await daily.getByRole('button', { name: '编辑', exact: true }).click()
    await daily.getByRole('textbox').fill('   ')
    await daily.getByRole('button', { name: '保存', exact: true }).click()
    assert.equal(await daily.getByRole('textbox').count(), 1)
    assert.equal((await stored(page)).dailyEntries.find(entry => entry.id === 'today').text, '今天已保存的一行')
    assert.match(await page.locator('.toast').innerText(), /请写下一行文字/)
    await daily.getByRole('button', { name: '取消', exact: true }).click()
    let dialogs = 0
    page.once('dialog', async dialog => { dialogs += 1; await dialog.accept() })
    await daily.getByRole('button', { name: '删除', exact: true }).click()
    await until(async () => (await stored(page)).dailyEntries.length === 1, 'confirmed daily deletion')
    assert.equal(dialogs, 1)
    assert.equal((await stored(page)).dailyEntries[0].id, 'yesterday')
    await nav(page, '时光'); await page.getByRole('button', { name: '每日一行', exact: true }).click()
    page.once('dialog', async dialog => { dialogs += 1; await dialog.dismiss() })
    await page.getByRole('button', { name: '删除 2026-10-29 的一行', exact: true }).click()
    assert.equal(dialogs, 2); assert.equal((await stored(page)).dailyEntries.length, 1)
    await context.close()
    check('today and historical daily deletion use one confirmation; cancel and empty save preserve data')
  }

  {
    const state = structuredClone(fixture)
    state.settings.dailyNarrationEnabled = true
    const { context, page } = await setup('2026-10-30T23:59:55+08:00', state)
    await page.clock.runFor(6_000)
    assert.match(await page.locator('.now29-breadcrumb time').innerText(), /10 月 31 日/)
    assert.match(await page.locator('.now29-daily-copy').innerText(), /今天还没有留下文字/)
    await until(async () => (await stored(page)).narrationUses.some(use => use.date === '2026-10-31'), 'new day narration')
    assert.equal((await stored(page)).dailyEntries.find(entry => entry.id === 'today').text, '今天已保存的一行')
    await page.screenshot({ path: join(out, 'midnight-today.png'), animations: 'disabled' })
    await context.close()
    check('local midnight updates today daily selection and narration without changing earlier entries')
  }

  {
    const { context, page } = await setup('2026-10-30T23:59:55+08:00')
    const daily = page.getByRole('region', { name: '今日一行', exact: true })
    await daily.getByRole('button', { name: '编辑', exact: true }).click()
    await daily.getByRole('textbox').fill('午夜前开始的修改')
    await page.clock.runFor(6_000)
    assert.match(await daily.locator('.now29-daily-label strong').innerText(), /2026 年 10 月 30 日/)
    assert.equal(await daily.getByRole('textbox').inputValue(), '午夜前开始的修改')
    await page.screenshot({ path: join(out, 'midnight-edit-date.png'), animations: 'disabled' })
    await daily.getByRole('button', { name: '保存', exact: true }).click()
    await until(async () => (await stored(page)).dailyEntries.find(entry => entry.id === 'today').text === '午夜前开始的修改', 'draft original date persisted')
    assert.equal((await stored(page)).dailyEntries.some(entry => entry.date === '2026-10-31'), false)
    assert.match(await page.locator('.now29-daily-copy').innerText(), /今天还没有留下文字/)
    await context.close()
    check('a daily draft begun before midnight keeps its original date and clearly names it after midnight')
  }

  {
    const { context, page } = await setup()
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00+08:00'))
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await until(async () => (await page.locator('.now29-daily-copy').innerText()).includes('今天还没有留下文字'), 'focus date synchronization')
    await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+08:00'))
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await until(async () => (await page.locator('.now29-daily-copy').innerText()).includes('今天已保存的一行'), 'visibility date synchronization')
    await context.close()
    check('focus and visible restoration resynchronize local day after sleep or clock changes')
  }

  {
    const state = structuredClone(fixture)
    state.moments[0].photoIds = ['synthetic-missing-photo']
    const { context, page } = await setup(undefined, state)
    await nav(page, '我的')
    const before = await stored(page)
    let downloads = 0
    page.on('download', () => { downloads += 1 })
    for (const name of ['导出 JSON', '导出完整 ZIP']) {
      await page.getByRole('button', { name, exact: true }).click()
      await until(async () => (await page.locator('.toast').allTextContents()).some(text => text.includes('备份失败') && text.includes('synthetic-missing-photo')), `${name} failure is visible`)
      assert.deepEqual(await stored(page), before)
      // Dismiss the first toast before trying the second format, so each attempt
      // must display its own error instead of passing on stale feedback.
      await page.clock.runFor(3600)
      assert.equal(await page.locator('.toast').count(), 0)
    }
    assert.equal(downloads, 0)
    assert.equal(report.errors.length, 0)
    await context.close()
    check('JSON and ZIP export failures give visible feedback, reject incomplete backups and preserve missing photo references')
  }

  assert.equal(report.errors.length, 0)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.failure = error.stack ?? String(error)
  console.error(report.failure); process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.kill()
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
}
