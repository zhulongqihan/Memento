import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const out = join(root, 'output', 'playwright', `release-${version}`, 'reading')
mkdirSync(out, { recursive: true })
const url = 'http://127.0.0.1:1434'
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '1434', '--strictPort'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
let serverOutput = ''
server.stdout.on('data', data => { serverOutput += data })
server.stderr.on('data', data => { serverOutput += data })
const report = { status: 'running', version, checks: [], errors: [], dimensions: [], contrast: [], screenshots: [] }
let browser
const timestamp = '2026-10-29T12:00:00.000Z'
const moments = Array.from({ length: 83 }, (_, index) => {
  const month = index < 28 ? '10' : index < 56 ? '09' : '08'
  const day = String(28 - index % 28).padStart(2, '0')
  return { id: `reading-${index}`, kind: index === 0 ? 'first' : 'milestone', title: index === 32 ? '一封回信' : `记录 ${String(index).padStart(3, '0')}`, date: `2026-${month}-${day}`, note: index === 32 ? '第一行文字。\n第二行记下了回声。' : '这是合成的回归记录，用来检查日期与阅读。', location: index === 32 ? '北窗' : '', photoIds: [], createdAt: timestamp, updatedAt: timestamp }
})
const counter = (id, endDate, unit = 'custom', weekdays = [0, 1, 2, 3, 4, 5, 6]) => ({ id, title: id, endDate, unit, weekdays, createdAt: timestamp, updatedAt: timestamp })
const fixture = {
  schemaVersion: 4, moments, elapsed: [], stages: [], dailyEntries: [], narrationUses: [], savedNarrations: [],
  remaining: [counter('今天的日期', '2026-10-30'), counter('明天的日期', '2026-10-31'), counter('过去的日期', '2026-10-28'), counter('周五计数', '2026-11-06', 'friday', []), counter('没有匹配日', '2026-11-01', 'friday', [])],
  settings: { displayName: '阅读验证', displayLifeProgress: false, pinnedMomentId: 'reading-32', pinnedRemainingId: '今天的日期', timelineFilter: 'all', theme: 'light', displayDensity: 'comfortable', numberFormat: 'plain', visualNarrative: 'archive', dailyNarrationEnabled: false },
}
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
async function until(fn, label, timeout = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await fn()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
async function ready(page) {
  await page.locator('.app-shell').waitFor()
  await page.locator('.world-loading').waitFor({ state: 'hidden' })
}
async function nav(page, name) {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click()
  await ready(page)
}
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('memento:app-state:v4'))) }
async function shot(page, name, fullPage = false) {
  const path = join(out, `${name}.png`)
  await page.screenshot({ path, fullPage, animations: 'disabled' })
  report.screenshots.push(path)
}
async function dimensions(page, view, width, height) {
  await page.setViewportSize({ width, height })
  // Let resize observers and the next painted layout settle before measuring.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const metrics = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
  report.dimensions.push({ view, width, height, ...metrics })
  if (metrics.document > width + 1 || metrics.body > width + 1) await shot(page, `overflow-${view}-${width}`)
  assert.ok(metrics.document <= width + 1 && metrics.body <= width + 1, `${view}: horizontal overflow at ${width}: ${JSON.stringify(metrics)}`)
  if (view === 'remaining') {
    const gaps = await page.locator('#degree29-panel-remaining .degree-row').evaluateAll(rows => rows.map(row => {
      const number = row.querySelector('.row-number').getBoundingClientRect()
      const actions = row.querySelector('.row-actions').getBoundingClientRect()
      return actions.left - number.right
    }))
    assert.ok(gaps.every(gap => gap >= 8), `remaining actions overlap: ${gaps}`)
    metrics.actionGaps = gaps
  }
  Object.assign(report.dimensions.at(-1), metrics)
  await shot(page, `${view}-${width}`)
}
async function contrast(page, selector) {
  const sample = await page.locator(selector).first().evaluate(element => {
    const parse = color => color.match(/[\d.]+/g).map(Number)
    const blend = (front, back) => {
      const a = front[3] ?? 1
      return [0, 1, 2].map(i => front[i] * a + back[i] * (1 - a))
    }
    const layers = []
    for (let node = element; node; node = node.parentElement) layers.unshift(parse(getComputedStyle(node).backgroundColor))
    const background = layers.reduce((result, color) => blend(color, result), [255, 255, 255])
    const foreground = blend(parse(getComputedStyle(element).color), background)
    const luminance = rgb => rgb.map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return { ratio: (values[0] + 0.05) / (values[1] + 0.05), foreground, background, fontSize: getComputedStyle(element).fontSize }
  })
  report.contrast.push({ selector, ...sample })
  assert.ok(sample.ratio >= 4.5, `${selector}: contrast ${sample.ratio.toFixed(2)}`)
}

try {
  await until(async () => {
    if (server.exitCode !== null) throw new Error(serverOutput)
    try { return (await fetch(url)).ok } catch { return false }
  }, 'reading preview')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', acceptDownloads: true })
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-10-30T00:00:00+08:00'))
  await page.addInitScript(state => { if (!localStorage.getItem('memento:app-state:v4')) localStorage.setItem('memento:app-state:v4', JSON.stringify(state)) }, fixture)
  await page.goto(url); await ready(page)
  assert.equal(await page.locator('.now29-empty-observation').count(), 0)
  assert.equal(await page.locator('.now29-text-memory time').getAttribute('datetime'), '2026-09-24')
  assert.match(await page.locator('.now29-text-memory').innerText(), /一封回信/)
  assert.match(await page.locator('.now29-note-meta').last().innerText(), /今天/)
  await page.getByRole('button', { name: '打开这段时光', exact: true }).click()
  const detail = page.getByRole('dialog', { name: '一封回信详情' })
  assert.equal(await detail.locator('.detail-photo-placeholder').count(), 0)
  assert.equal(await detail.locator('.detail-footnote').count(), 0)
  assert.equal(await detail.locator('.detail-note').innerText(), moments[32].note)
  assert.equal(await detail.locator('.detail-note').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap')
  await shot(page, 'text-detail')
  await page.keyboard.press('Escape')
  check('text record owns its actual date, preserves lines, has no empty photo block or invented ordinal')

  await nav(page, '时光')
  const list = page.locator('.film29-index-list')
  await list.focus(); await page.keyboard.press('ArrowDown')
  assert.equal(await page.locator('.film29-index-record:focus').getAttribute('data-index'), '0')
  await page.keyboard.press('End')
  assert.equal(await page.locator('.film29-index-record:focus').getAttribute('data-index'), '82')
  await page.keyboard.press('Home')
  assert.equal(await page.locator('.film29-index-record:focus').getAttribute('data-index'), '0')
  await page.getByRole('button', { name: '跳到 2026 年 9 月', exact: true }).click()
  assert.equal(await page.locator('.film29-index-record:focus').getAttribute('data-month'), '2026-09')
  const search = page.getByRole('searchbox', { name: '搜索时光记录' })
  for (const query of ['一封回信', '  回声  ', '北窗']) {
    await search.fill(query)
    await until(async () => await page.locator('.film29-index-record').count() === 1, 'search result')
    assert.match(await page.locator('.film29-index-record').innerText(), /一封回信/)
  }
  await search.fill('不存在的关键词')
  await until(async () => await page.locator('.film29-index-record').count() === 0, 'no search results')
  await page.getByRole('button', { name: '清除查找条件', exact: true }).click()
  await until(async () => await page.locator('.film29-index-record').count() === 83, 'clear search')
  await page.getByRole('button', { name: '胶片', exact: true }).click()
  assert.equal(await page.locator('.film29-evidence strong').count(), 0)
  await page.getByRole('button', { name: '索引', exact: true }).click()
  assert.deepEqual((await stored(page)).moments, moments)
  check('month navigation, text/location search, empty recovery, first/last keys and read-only records')
  for (const selector of ['.film29-index-record time', '.film29-index-copy small', '.film29-index-copy p']) await contrast(page, selector)

  await nav(page, '几度'); await page.getByRole('tab', { name: /余下/ }).click()
  const row = title => page.locator('#degree29-panel-remaining .degree-row').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  assert.match(await row('今天的日期').innerText(), /今天/)
  assert.match(await row('明天的日期').innerText(), /还有\s*1\s*天/)
  assert.match(await row('过去的日期').innerText(), /已过\s*2\s*天/)
  assert.match(await row('没有匹配日').innerText(), /截止前没有符合的日期/)
  assert.equal(await row('明天的日期').locator('.remaining-date').count(), 0)
  assert.doesNotMatch(await page.locator('#degree29-panel-remaining').innerText(), /下一次|个自定义日/)
  assert.match(await row('周五计数').innerText(), /下个计入日/)
  await page.locator('.degree29-new').click()
  let drawer = page.getByRole('dialog')
  assert.equal(await drawer.locator('#remaining-unit').inputValue(), 'calendar')
  await drawer.locator('input[name=title]').fill('新建自然日')
  await drawer.locator('input[name=endDate]').fill('2026-10-31')
  await drawer.getByRole('button', { name: '保存这段时间', exact: true }).click()
  await until(async () => (await stored(page)).remaining.some(item => item.title === '新建自然日'), 'calendar save')
  const created = (await stored(page)).remaining.find(item => item.title === '新建自然日')
  assert.equal(created.unit, 'custom'); assert.deepEqual(created.weekdays, [0, 1, 2, 3, 4, 5, 6])
  await page.getByRole('button', { name: '编辑明天的日期', exact: true }).click()
  drawer = page.getByRole('dialog')
  assert.equal(await drawer.locator('#remaining-unit').inputValue(), 'calendar')
  await page.keyboard.press('Escape')
  check('future/today/past and zero-match semantics; new calendar mode saves the compatible schema')
  await page.evaluate(() => {
    window.__readingCardText = []
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { window.__readingCardText.push(text); return original.call(this, text, ...args) }
  })
  const downloaded = page.waitForEvent('download')
  await row('明天的日期').getByRole('button', { name: '生成余下分享卡' }).click()
  await (await downloaded).saveAs(join(out, 'calendar-share.png'))
  const cardText = await page.evaluate(() => window.__readingCardText.join('\n'))
  assert.match(cardText, /还有 1 天/); assert.match(cardText, /日期 · 2026 年 10 月 31 日/); assert.doesNotMatch(cardText, /下一次/)
  check('share card uses the same reading and the actual target date')
  for (const selector of ['#degree29-panel-remaining .row-caption', '#degree29-panel-remaining .row-number small', '#degree29-panel-remaining .remaining-date small']) await contrast(page, selector)

  for (const [name, view] of [['此刻', 'now'], ['时光', 'timeline'], ['几度', 'remaining']]) {
    await nav(page, name)
    if (view === 'remaining') await page.getByRole('tab', { name: /余下/ }).click()
    for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) await dimensions(page, view, width, height)
  }
  check('nine desktop layouts have no horizontal overflow; counter actions remain separate')
  for (const theme of ['dark', 'high-contrast']) {
    await page.evaluate(theme => { const state = JSON.parse(localStorage.getItem('memento:app-state:v4')); state.settings.theme = theme; localStorage.setItem('memento:app-state:v4', JSON.stringify(state)) }, theme)
    await page.reload(); await ready(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await shot(page, `now-${theme}`)
    await nav(page, '时光')
    for (const selector of ['.film29-index-record time', '.film29-index-copy small', '.film29-index-copy p']) await contrast(page, selector)
    await shot(page, `timeline-${theme}`)
  }
  assert.equal(report.errors.length, 0)
  check('reading contrast across themes and zero runtime errors')
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.failure = error.stack ?? String(error)
  console.error(report.failure); process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.kill()
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
}
