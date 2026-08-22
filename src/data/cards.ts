export type ShareCardKind = 'moment' | 'elapsed' | 'remaining'

export interface MomentCardData {
  title: string
  date: string
  note?: string
}

export interface ElapsedCardData {
  title: string
  value: number
  unit: string
}

export interface RemainingCardData {
  title: string
  count: number
  unit: string
  nextDate?: string
}

type ShareCardData = MomentCardData | ElapsedCardData | RemainingCardData

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
  const characters = [...text]
  let line = ''
  let lineCount = 0
  for (const character of characters) {
    const next = `${line}${character}`
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y + lineCount * lineHeight)
      line = character
      lineCount += 1
      if (lineCount >= maxLines) break
    } else {
      line = next
    }
  }
  if (lineCount < maxLines && line) context.fillText(line, x, y + lineCount * lineHeight)
}

function drawBase(context: CanvasRenderingContext2D, title: string, accent: string): void {
  context.fillStyle = '#f7f5f0'
  context.fillRect(0, 0, 1200, 630)
  context.fillStyle = accent
  context.fillRect(80, 80, 8, 470)
  context.fillStyle = '#726e68'
  context.font = '500 22px "Microsoft YaHei", sans-serif'
  context.fillText('几度 · Memento', 124, 110)
  context.fillStyle = '#292321'
  context.font = '500 20px "Microsoft YaHei", sans-serif'
  context.fillText(title, 124, 560)
}

function drawCard(kind: ShareCardKind, data: ShareCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境无法生成分享卡片。')
  context.textBaseline = 'top'
  if (kind === 'moment') {
    const moment = data as MomentCardData
    drawBase(context, '一段被记住的时光', '#ad4c43')
    context.fillStyle = '#292321'
    context.font = '500 54px "Microsoft YaHei", sans-serif'
    drawWrappedText(context, moment.title, 124, 190, 900, 70, 2)
    context.fillStyle = '#726e68'
    context.font = '400 22px "Microsoft YaHei", sans-serif'
    context.fillText(moment.date, 124, 355)
    if (moment.note) {
      context.font = '400 24px "Microsoft YaHei", sans-serif'
      drawWrappedText(context, moment.note, 124, 410, 880, 38, 2)
    }
  } else if (kind === 'elapsed') {
    const elapsed = data as ElapsedCardData
    drawBase(context, '已经经过的时间', '#8d6d57')
    context.fillStyle = '#292321'
    context.font = '500 54px "Microsoft YaHei", sans-serif'
    drawWrappedText(context, elapsed.title, 124, 190, 900, 70, 2)
    context.font = '500 122px "Segoe UI", "Microsoft YaHei", sans-serif'
    context.fillText(String(elapsed.value), 124, 350)
    context.fillStyle = '#726e68'
    context.font = '400 28px "Microsoft YaHei", sans-serif'
    context.fillText(elapsed.unit, 124 + context.measureText(String(elapsed.value)).width + 20, 405)
  } else {
    const remaining = data as RemainingCardData
    drawBase(context, '还剩下的具体日子', '#b06e61')
    context.fillStyle = '#292321'
    context.font = '500 54px "Microsoft YaHei", sans-serif'
    drawWrappedText(context, remaining.title, 124, 190, 900, 70, 2)
    context.font = '500 122px "Segoe UI", "Microsoft YaHei", sans-serif'
    context.fillText(String(remaining.count), 124, 350)
    context.fillStyle = '#726e68'
    context.font = '400 28px "Microsoft YaHei", sans-serif'
    context.fillText(remaining.unit, 124 + context.measureText(String(remaining.count)).width + 20, 405)
    if (remaining.nextDate) {
      context.font = '400 22px "Microsoft YaHei", sans-serif'
      context.fillText(`下一次 · ${remaining.nextDate}`, 124, 480)
    }
  }
  return canvas
}

export async function downloadShareCard(kind: ShareCardKind, data: ShareCardData): Promise<void> {
  const canvas = drawCard(kind, data)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('分享卡片生成失败。')), 'image/png'))
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `memento-${kind}-${new Date().toISOString().slice(0, 10)}.png`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
