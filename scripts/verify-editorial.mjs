import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

// Only synthetic state in fresh browser contexts; never open a user's profile or /preview/ clone.
const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.match(version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/)
const out = join(root, 'output', 'playwright', `release-${version}`, 'editorial')
mkdirSync(out, { recursive: true })
const port = 1436
const url = `http://127.0.0.1:${port}`
const sizes = [[1280, 720], [1440, 900], [1920, 1080]]
const themes = ['light', 'dark', 'high-contrast']
const views = [['此刻', 'now'], ['时光', 'timeline'], ['几度', 'degrees'], ['我的', 'settings']]
const stamp = '2026-10-30T04:00:00.000Z'
const record = (id, extra) => ({ id, title: `合成记录 ${id}`, createdAt: stamp, updatedAt: stamp, ...extra })
const fixture = {
  schemaVersion: 4,
  moments: Array.from({ length: 12 }, (_, i) => record(`moment-${i}`, { kind: i % 2 ? 'milestone' : 'first', date: `2026-10-${String(28 - i).padStart(2, '0')}`, location: '河岸与书房', note: '第一行，留下当时的光。\n第二行，保存原本的换行。', photoIds: [] })),
  elapsed: Array.from({ length: 4 }, (_, i) => record(`elapsed-${i}`, { startDate: `202${i}-05-16` })),
  remaining: Array.from({ length: 4 }, (_, i) => record(`remaining-${i}`, { endDate: `2027-0${i + 1}-15`, unit: 'custom', weekdays: [0, 1, 2, 3, 4, 5, 6] })),
  stages: [record('stage-0', { kind: 'custom', startDate: '2026-01-01', endDate: '2027-06-30', enabled: true })],
  dailyEntries: [record('daily-0', { date: '2026-10-30', text: '这只是合成的阅读验证资料。' })],
  narrationUses: [], savedNarrations: [],
  settings: { displayName: '合成时间册', displayLifeProgress: false, lifeExpectancyYears: 80, pinnedMomentId: 'moment-0', pinnedElapsedId: 'elapsed-0', pinnedRemainingId: 'remaining-0', timelineFilter: 'all', elapsedDisplayMode: 'days', elapsedSort: 'recent', theme: 'light', displayDensity: 'comfortable', numberFormat: 'plain', visualNarrative: 'archive', dailyNarrationEnabled: false },
}
const report = { status: 'running', version, syntheticOnly: true, startedAt: new Date().toISOString(), checks: [], failures: [], pageErrors: [], dimensions: [], contrast: [], density: [], motion: [], screenshots: [], helper: { port, windowsHide: true } }
let server, browser, serverOutput = ''
const contexts = new Set()

async function until(fn, label, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await fn()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
async function ready(page) {
  await page.locator('.app-shell').waitFor()
  await page.locator('.world-loading').waitFor({ state: 'hidden' })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
async function nav(page, label) {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: label, exact: true }).click()
  await ready(page)
  await page.evaluate(() => scrollTo(0, 0))
}
async function newPage(state) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
  contexts.add(context)
  const page = await context.newPage()
  page.on('pageerror', error => report.pageErrors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00+08:00'))
  await page.addInitScript(state => {
    if (!localStorage.getItem('memento:app-state:v4')) localStorage.setItem('memento:app-state:v4', JSON.stringify(state))
  }, state)
  await page.goto(url)
  await ready(page)
  return page
}
async function closePage(page) {
  const context = page.context()
  await context.close()
  contexts.delete(context)
}
async function shot(page, name) {
  const file = join(out, `${name}.png`)
  await page.screenshot({ path: file, animations: 'disabled' })
  report.screenshots.push(file)
}
async function test(name, page, fn) {
  try {
    await fn()
    report.checks.push(name)
    console.log(`PASS ${name}`)
  } catch (error) {
    report.failures.push({ name, error: error.stack ?? String(error) })
    if (page && !page.isClosed()) await shot(page, `failure-${report.failures.length}`).catch(() => {})
    console.error(`FAIL ${name}: ${error.message}`)
  }
}
async function dimensions(page, name) {
  const metrics = await page.evaluate(() => {
    const visible = element => {
      const r = element.getBoundingClientRect(), s = getComputedStyle(element)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !element.closest('[hidden], [aria-hidden="true"], .sr-only')
    }
    // Measure readable content, not intentional decorative bleed or offscreen hidden tabpanels.
    const selector = '.world-page h1, .world-page h2, .world-page h3, .world-page p, .now29-memory-location, .film29-index-copy > *, .film29-record-copy > *, .registry29-directory small, .registry29-identity > span, .detail-copy > *'
    const local = [...document.querySelectorAll(selector)].filter(visible).flatMap(element => {
      const r = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect(), s = getComputedStyle(element)
      const ellipsis = s.textOverflow === 'ellipsis' && s.overflowX !== 'visible'
      const clippedPreview = Number(s.webkitLineClamp) > 0 && s.overflowX === 'hidden'
      const ownOverflow = element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2 && !ellipsis && !clippedPreview
      const outsideParent = r.right > parent.right + 2 || r.left < parent.left - 2
      const outsideViewport = r.right > innerWidth + 2 || r.left < -2
      return ownOverflow || outsideParent || outsideViewport ? [{ tag: element.tagName, className: element.className, text: element.textContent.slice(0, 50), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, right: r.right, parentRight: parent.right, ownOverflow, outsideParent, outsideViewport }] : []
    })
    const drawers = [...document.querySelectorAll('.detail-drawer, .record-drawer')].filter(visible).map(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }))
    return { width: innerWidth, height: innerHeight, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, local, drawers }
  })
  report.dimensions.push({ name, ...metrics })
  assert.ok(metrics.document <= metrics.width + 1 && metrics.body <= metrics.width + 1, `${name}: global overflow ${JSON.stringify(metrics)}`)
  assert.deepEqual(metrics.local, [], `${name}: local readable-content overflow`)
  assert.ok(metrics.drawers.every(x => x.scrollWidth <= x.clientWidth + 1), `${name}: drawer horizontal overflow`)
}
async function contrast(page, selector, name) {
  const samples = await page.locator(selector).evaluateAll(elements => elements.filter(e => e.getClientRects().length && !e.closest('[hidden]') && !e.disabled).map(element => {
    const parse = color => color.match(/[\d.]+/g).map(Number)
    const blend = (a, b) => [0, 1, 2].map(i => a[i] * (a[3] ?? 1) + b[i] * (1 - (a[3] ?? 1)))
    const layers = []
    for (let n = element; n; n = n.parentElement) layers.unshift(parse(getComputedStyle(n).backgroundColor))
    const background = layers.reduce((color, layer) => blend(layer, color), [255, 255, 255])
    const style = getComputedStyle(element)
    const foreground = blend(parse(style.color), background)
    const lum = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
    const a = lum(foreground), b = lum(background)
    const size = parseFloat(style.fontSize), weight = parseInt(style.fontWeight, 10)
    return { text: element.textContent.trim().slice(0, 60), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), threshold: size >= 24 || size >= 18.66 && weight >= 700 ? 3 : 4.5, foreground, background, size, weight }
  }))
  report.contrast.push({ name, selector, samples })
  assert.ok(samples.length > 0, `${name}: contrast selector has no visible enabled samples: ${selector}`)
  assert.ok(samples.every(s => s.ratio >= s.threshold), `${name}: insufficient contrast ${JSON.stringify(samples.filter(s => s.ratio < s.threshold))}`)
}
async function buttonTargets(page, selector, name) {
  const targets = await page.locator(selector).evaluateAll(elements => elements.filter(e => e.getClientRects().length && !e.closest('[hidden]') && !e.disabled).map(e => ({ label: e.getAttribute('aria-label') ?? e.textContent.trim(), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })))
  assert.ok(targets.length, `${name}: no visible controls measured`)
  assert.ok(targets.every(t => t.width >= 32 && t.height >= 32), `${name}: targets below 32px ${JSON.stringify(targets.filter(t => t.width < 32 || t.height < 32))}`)
}

try {
  // Do not reuse a server already on this port: it may be another agent's process or stale build.
  let occupied = false
  try { occupied = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok } catch { /* expected for an unused port */ }
  assert.equal(occupied, false, `Port ${port} is occupied; no existing process was stopped`)
  server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  report.helper.pid = server.pid
  server.stdout.on('data', data => { serverOutput += data })
  server.stderr.on('data', data => { serverOutput += data })
  server.on('error', error => { serverOutput += error.stack })
  await until(async () => { if (server.exitCode !== null) throw new Error(serverOutput); try { return (await fetch(url)).ok } catch { return false } }, 'editorial preview')
  browser = await chromium.launch({ channel: 'msedge', headless: true })

  for (const theme of themes) {
    const page = await newPage({ ...fixture, settings: { ...fixture.settings, theme } })
    for (const [label, key] of views) {
      await nav(page, label)
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height }); await ready(page)
        await test(`layout ${key} ${theme} ${width}`, page, () => dimensions(page, `${key}-${theme}-${width}`))
        await shot(page, `${key}-${theme}-${width}`)
      }
      await test(`contrast ${key} ${theme}`, page, async () => {
        const title = { now: '.now29-time-column h1', timeline: '.film29-title-line h1', degrees: '.degree29-heading h1', settings: '.registry29-header h1' }[key]
        await contrast(page, title, `${key}-${theme}-title`)
        const actions = { now: '.now29-actions > button', timeline: '.film29-header-side > button', degrees: '.degree29-new, .degree-shell-header .icon-text-button', settings: '.registry29-secondary:not([disabled])' }[key]
        await contrast(page, actions, `${key}-${theme}-actions`)
        if (key === 'settings') {
          await contrast(page, '.registry29-header p, .registry29-directory .is-selected small, .registry29-encrypted label small, .registry29-microcopy, .registry29-identity span, .registry29-ledger > span', `settings-${theme}-explanations`)
          await page.getByRole('textbox', { name: /备份密码/ }).fill('synthetic-only-password')
          await contrast(page, '.registry29-primary', `settings-${theme}-encryption-action`)
        }
      })
      await test(`reduced motion ${key} ${theme}`, page, async () => {
        const motion = await page.evaluate(() => ({ reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, running: document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().duration > 1).map(a => ({ name: a.animationName, duration: a.effect.getTiming().duration, target: a.effect.target.className })) }))
        report.motion.push({ key, theme, ...motion }); assert.ok(motion.reduce); assert.deepEqual(motion.running, [])
      })
      if (key === 'settings') {
        for (const [label, section] of [['人生', 'life'], ['阅读', 'appearance'], ['旁白', 'library'], ['关于', 'about']]) {
          await page.getByRole('navigation', { name: '设置目录' }).getByRole('button', { name: new RegExp(`^${label}`) }).click()
          await test(`settings panel ${section} ${theme}`, page, async () => {
            await contrast(page, '.registry29-section h2, .registry29-note, .registry29-fields label, .registry29-microcopy, .registry29-toggle, .registry29-source-count, .registry29-source-count strong, .registry29-source-list a, .registry29-source-list small, .registry29-source-toggle', `${section}-${theme}-text`)
            await dimensions(page, `${section}-${theme}`)
          })
          await shot(page, `settings-${section}-${theme}`)
        }
      }
    }
    await closePage(page)
  }

  for (const theme of themes) {
    const empty = { ...fixture, moments: [], elapsed: [], remaining: [], stages: [], dailyEntries: [], settings: { ...fixture.settings, theme } }
    const page = await newPage(empty)
    await test(`empty now ${theme}`, page, async () => {
      await contrast(page, '.now29-empty-observation button', `empty-now-${theme}`)
      assert.match(await page.locator('.now29-narration-empty').innerText(), /自动旁白已关闭/)
    })
    await shot(page, `empty-now-${theme}`)
    await nav(page, '时光')
    await test(`empty timeline ${theme}`, page, () => contrast(page, '.film41-empty button', `empty-timeline-${theme}`))
    await shot(page, `empty-timeline-${theme}`)
    await nav(page, '几度')
    for (const [label, key] of [['经年', 'elapsed'], ['余下', 'remaining'], ['刻度', 'stage']]) {
      await page.getByRole('tab', { name: new RegExp(label) }).click()
      await test(`empty ${key} ${theme}`, page, async () => {
        await contrast(page, `#degree29-panel-${key} .empty-state button`, `empty-${key}-${theme}`)
        await buttonTargets(page, `#degree29-panel-${key} .empty-state button`, `empty-${key}-${theme}`)
      })
      await shot(page, `empty-${key}-${theme}`)
    }
    await closePage(page)
  }

  const longTitle = '在很多年后仍然记得的那一天'.repeat(10)
  const longLocation = 'ShanghaiRiversideBuildingTwentySixConferenceRoom'.repeat(3)
  const longNote = ['第一行必须保留原来的位置。', '第二行包含一段无空格英文：' + 'SyntheticLongWord'.repeat(40), '第三行在结尾，不能被悄悄丢掉。'].join('\n')
  const longState = structuredClone(fixture)
  Object.assign(longState.moments[0], { title: longTitle, location: longLocation, note: longNote })
  longState.elapsed[0].title = longTitle
  longState.dailyEntries[0].text = longNote
  const longPage = await newPage(longState)
  for (const [width, height] of sizes) {
    await longPage.setViewportSize({ width, height })
    for (const [label, key] of views.slice(0, 3)) {
      await nav(longPage, label)
      if (key === 'timeline') await longPage.getByRole('button', { name: '索引', exact: true }).click()
      await test(`long ${key} ${width}`, longPage, () => dimensions(longPage, `long-${key}-${width}`))
      await shot(longPage, `long-${key}-${width}`)
      if (key === 'timeline') {
        await longPage.locator('.film29-index-record').first().click()
        await longPage.locator('.detail-drawer').waitFor()
        await longPage.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
        await test(`long detail ${width}`, longPage, async () => {
          await dimensions(longPage, `long-detail-${width}`)
          assert.equal(await longPage.locator('.detail-copy h2').innerText(), longTitle)
          assert.equal(await longPage.locator('.detail-location').innerText(), longLocation)
          assert.equal(await longPage.locator('.detail-note').innerText(), longNote)
          const flow = await longPage.locator('.detail-note').evaluate(e => ({ whiteSpace: getComputedStyle(e).whiteSpace, client: e.clientWidth, scroll: e.scrollWidth }))
          assert.ok(['pre-wrap', 'pre-line', 'break-spaces'].includes(flow.whiteSpace), `detail lost multiline rendering: ${flow.whiteSpace}`)
          assert.ok(flow.scroll <= flow.client + 1)
        })
        await shot(longPage, `long-detail-${width}`)
        await longPage.keyboard.press('Escape')
        await longPage.getByRole('button', { name: '每日一行', exact: true }).click()
        await test(`long daily ${width}`, longPage, () => dimensions(longPage, `long-daily-${width}`))
        await shot(longPage, `long-daily-${width}`)
      }
    }
  }
  await closePage(longPage)

  const densityMeasurements = {}
  for (const density of ['comfortable', 'compact']) {
    const page = await newPage({ ...fixture, settings: { ...fixture.settings, displayDensity: density } })
    const measure = async (name, rowSelector, controls) => {
      await test(`density ${name} ${density}`, page, async () => {
        const height = await page.locator(rowSelector).first().evaluate(e => e.getBoundingClientRect().height)
        densityMeasurements[name] ??= {}; densityMeasurements[name][density] = height
        report.density.push({ name, density, height })
        await buttonTargets(page, controls, `${name}-${density}`)
      })
      await shot(page, `density-${name}-${density}`)
    }
    await nav(page, '时光')
    await measure('index', '.film29-index-record', '.film29-index-record')
    await page.getByRole('button', { name: '胶片', exact: true }).click()
    await measure('film', '.film29-record', '.film29-record')
    await nav(page, '几度')
    for (const [label, key] of [['经年', 'elapsed'], ['余下', 'remaining']]) {
      await page.getByRole('tab', { name: new RegExp(label) }).click()
      await measure(key, `#degree29-panel-${key} .degree-row`, `#degree29-panel-${key} .degree-list button`)
    }
    await closePage(page)
  }
  for (const [name, values] of Object.entries(densityMeasurements)) await test(`density changes ${name}`, null, async () => {
    assert.ok(values.comfortable - values.compact >= 2, `${name}: compact is not denser: ${JSON.stringify(values)}`)
  })
  const yearsPage = await newPage(fixture)
  await nav(yearsPage, '我的')
  await yearsPage.getByRole('button', { name: /^人生/ }).click()
  await test('life years draft validation and persistence', yearsPage, async () => {
    const field = yearsPage.getByLabel('预期年限', { exact: true })
    const savedYears = () => yearsPage.evaluate(() => JSON.parse(localStorage.getItem('memento:app-state:v4')).settings.lifeExpectancyYears)
    for (const invalid of ['999', '', '1.5', '0', '-1', '151']) {
      await field.fill(invalid)
      assert.equal(await savedYears(), 80)
      await field.press('Tab')
      await yearsPage.locator('#life-years-error').waitFor()
      assert.equal(await field.getAttribute('aria-invalid'), 'true')
      assert.equal(await field.inputValue(), invalid)
      assert.equal(await savedYears(), 80)
    }
    await field.fill('1'); await field.press('Enter')
    await until(async () => await savedYears() === 1, 'life years lower boundary commit')
    await field.fill('150'); await field.press('Tab')
    await until(async () => await savedYears() === 150, 'life years upper boundary commit')
    await field.fill('83.5'); await field.press('Enter')
    assert.equal(await savedYears(), 150)
    await yearsPage.reload(); await ready(yearsPage); await nav(yearsPage, '我的')
    await yearsPage.getByRole('button', { name: /^人生/ }).click()
    assert.equal(await yearsPage.getByLabel('预期年限', { exact: true }).inputValue(), '150')
  })
  await closePage(yearsPage)
  await test('zero browser page errors', null, async () => assert.deepEqual(report.pageErrors, []))
} catch (error) {
  report.failures.push({ name: 'runner', error: error.stack ?? String(error) })
  console.error(error.stack)
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser?.close()
  if (server) {
    if (server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve))
      server.kill()
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))])
    }
    report.helper.cleanedUp = server.exitCode !== null || server.signalCode !== null
    if (!report.helper.cleanedUp) report.failures.push({ name: 'helper cleanup', error: `Owned PID ${server.pid} did not exit` })
  }
  report.status = report.failures.length ? 'failed' : 'passed'
  report.completedAt = new Date().toISOString()
  report.serverOutput = serverOutput
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`${report.status.toUpperCase()}: ${report.checks.length} checks, ${report.failures.length} failures. ${join(out, 'report.json')}`)
  if (report.failures.length) process.exitCode = 1
}
