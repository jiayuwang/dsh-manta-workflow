// review-service —— 纯逻辑：读取 report.json、路径解析、feedback 写入。
// 不含 Harness 接线，便于单测。

import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises'
import { resolve, dirname, join, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

/** 只允许出现在 media 路由下的项目内前缀（防止越出项目目录）。 */
export const ALLOWED_MEDIA_PREFIXES = ['build', 'media', 'slides', 'review']

const MAX_ANNOTATIONS_PER_ITEM = 100
const MAX_COMMENT_LENGTH = 4000

function normalizeRect(rect) {
  if (!rect || typeof rect !== 'object') throw new Error('标注缺少 rect')
  const out = {}
  for (const key of ['x', 'y', 'width', 'height']) {
    const value = rect[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`rect.${key} 必须是 0–1 的有限数`)
    }
    out[key] = value
  }
  if (out.x + out.width > 1 || out.y + out.height > 1 || out.width < 0.005 || out.height < 0.005) {
    throw new Error('标注方框越出图片或尺寸过小')
  }
  return out
}

function normalizeAnnotation(input, existing, now) {
  if (!input || typeof input !== 'object') throw new Error('非法标注条目')
  if (input.id !== undefined && (typeof input.id !== 'string' || input.id.length > 100)) {
    throw new Error('非法标注 id')
  }
  const comment = input.comment ?? ''
  const rule = input.rule ?? ''
  if (typeof comment !== 'string' || comment.length > MAX_COMMENT_LENGTH) throw new Error('评语类型错误或过长')
  if (typeof rule !== 'string' || rule.length > 100) throw new Error('规则编号类型错误或过长')
  return {
    id: input.id || randomUUID(),
    rect: normalizeRect(input.rect),
    comment,
    rule,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export class ReviewService {
  /** @param {string} projectDir 项目根目录（绝对路径） @param {string} projectId 面板项目 id */
  constructor(projectDir, projectId = 'default') {
    this.projectDir = resolve(projectDir)
    this.projectId = projectId
  }

  reportPath() {
    return join(this.projectDir, 'review', 'report.json')
  }

  feedbackPath() {
    return join(this.projectDir, 'review', 'feedback.json')
  }

  annotationsPath() {
    return join(this.projectDir, 'review', 'annotations.json')
  }

  acceptancePath() {
    return join(this.projectDir, 'review', 'acceptance.json')
  }

  /** 把 report 中相对路径解析为绝对路径；越出项目目录返回 undefined。 */
  resolveInside(relPath) {
    if (typeof relPath !== 'string' || relPath.length === 0) return undefined
    const abs = resolve(this.projectDir, relPath)
    if (abs !== this.projectDir && !abs.startsWith(this.projectDir + sep)) return undefined
    return abs
  }

  /** media 路由专用：还要求位于允许的顶层前缀之下。 */
  resolveMedia(relPath) {
    const abs = this.resolveInside(relPath)
    if (abs === undefined) return undefined
    const rel = abs.slice(this.projectDir.length + 1)
    if (!ALLOWED_MEDIA_PREFIXES.some((p) => rel === p || rel.startsWith(p + sep))) return undefined
    return abs
  }

  mediaUrl(relPath) {
    const path = String(relPath).split(sep).map(encodeURIComponent).join('/')
    return `/manta-review/media/${path}?project=${encodeURIComponent(this.projectId)}`
  }

  async readReport() {
    try {
      const raw = await readFile(this.reportPath(), 'utf8')
      const report = JSON.parse(raw)
      if (!Array.isArray(report.items)) throw new Error('report.json 缺少 items 数组')
      const annotations = await this.readAnnotations()
      // 图片地址换成 media 路由 URL；人工标注按素材 id 合并，不改写生成的报告。
      report.items = report.items.map((it) => ({
        ...it,
        image: typeof it.image === 'string' ? this.mediaUrl(it.image) : undefined,
        annotations: annotations.items[it.id] ?? [],
      }))
      report.acceptance = await this.readAcceptance()
      return report
    } catch (error) {
      if (error?.code === 'ENOENT') {
        const e = new Error('report.json 不存在：请先运行 manta-production 流水线的审核阶段')
        e.status = 404
        throw e
      }
      throw error
    }
  }

  async readAnnotations() {
    try {
      const store = JSON.parse(await readFile(this.annotationsPath(), 'utf8'))
      if (!store || typeof store.items !== 'object' || Array.isArray(store.items)) {
        throw new Error('annotations.json 缺少 items 对象')
      }
      return store
    } catch (error) {
      if (error?.code === 'ENOENT') return { version: 1, updatedAt: null, items: {} }
      throw error
    }
  }

  /** 全量替换一个素材的人工标注；其他素材保持不变。 */
  async writeAnnotations(itemId, annotations) {
    if (typeof itemId !== 'string' || itemId.length === 0 || itemId.length > 200) {
      throw new Error('非法素材 id')
    }
    if (!Array.isArray(annotations) || annotations.length > MAX_ANNOTATIONS_PER_ITEM) {
      throw new Error(`annotations 必须是不超过 ${MAX_ANNOTATIONS_PER_ITEM} 条的数组`)
    }
    const store = await this.readAnnotations()
    const existing = new Map((store.items[itemId] ?? []).map((a) => [a.id, a]))
    const now = new Date().toISOString()
    const normalized = annotations.map((a) => normalizeAnnotation(a, existing.get(a.id), now))
    if (normalized.length === 0) delete store.items[itemId]
    else store.items[itemId] = normalized
    store.version = 1
    store.updatedAt = now
    const path = this.annotationsPath()
    await mkdir(dirname(path), { recursive: true })
    const temp = `${path}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(store, null, 2) + '\n', 'utf8')
    await rename(temp, path)
    return normalized
  }

  async readAcceptance() {
    try {
      const acceptance = JSON.parse(await readFile(this.acceptancePath(), 'utf8'))
      if (acceptance?.status !== 'accepted' || !Array.isArray(acceptance.entries)) {
        throw new Error('acceptance.json 结构无效')
      }
      return acceptance
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  /** 完成验收：当前报告中的每个素材都必须显式通过。 */
  async writeAcceptance(entries) {
    if (!Array.isArray(entries)) throw new Error('entries 必须是数组')
    const report = await this.readReport()
    if (report.items.length === 0) throw new Error('当前没有可验收的素材')
    if (entries.length !== report.items.length) throw new Error('仍有素材未标记通过')
    const inputs = new Map(entries.map((e) => [e?.id, e]))
    const acceptedEntries = report.items.map((item) => {
      const input = inputs.get(item.id)
      if (!input || input.verdict !== 'pass') throw new Error(`${item.id} 尚未通过`)
      return {
        id: item.id,
        verdict: 'pass',
        comment: typeof input.comment === 'string' ? input.comment : '',
        source: item.source ?? null,
        annotations: item.annotations ?? [],
      }
    })
    const acceptance = {
      id: randomUUID(),
      status: 'accepted',
      project: report.project ?? '',
      reportGeneratedAt: report.generatedAt ?? null,
      acceptedAt: new Date().toISOString(),
      entries: acceptedEntries,
    }
    const path = this.acceptancePath()
    await mkdir(dirname(path), { recursive: true })
    const temp = `${path}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(acceptance, null, 2) + '\n', 'utf8')
    await rename(temp, path)
    return acceptance
  }

  /** 写入人工复核结果；entries: [{id, verdict:'pass'|'fail', comment?}] */
  async writeFeedback(entries) {
    if (!Array.isArray(entries)) throw new Error('entries 必须是数组')
    for (const e of entries) {
      if (!e || typeof e.id !== 'string' || (e.verdict !== 'pass' && e.verdict !== 'fail')) {
        throw new Error(`非法条目: ${JSON.stringify(e)}`)
      }
    }
    const report = await this.readReport().catch(() => ({ items: [] }))
    const byId = new Map((report.items ?? []).map((it) => [it.id, it]))
    const feedback = {
      id: randomUUID(),
      generatedAt: new Date().toISOString(),
      entries: entries.map((e) => ({
        ...e,
        source: byId.get(e.id)?.source ?? null,
        autoReview: byId.get(e.id)?.autoReview ?? null,
        annotations: byId.get(e.id)?.annotations ?? [],
      })),
      fixList: entries
        .filter((e) => e.verdict === 'fail')
        .map((e) => ({
          id: e.id,
          comment: e.comment ?? '',
          suggestions: byId.get(e.id)?.autoReview?.suggestions ?? [],
          source: byId.get(e.id)?.source ?? null,
          annotations: byId.get(e.id)?.annotations ?? [],
        })),
    }
    await mkdir(dirname(this.feedbackPath()), { recursive: true })
    await writeFile(this.feedbackPath(), JSON.stringify(feedback, null, 2) + '\n', 'utf8')
    return feedback
  }
}

/** HTTP 响应小工具 */
export function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

export async function mediaType(path) {
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.gif')) return 'image/gif'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.mp4')) return 'video/mp4'
  return 'application/octet-stream'
}

export async function fileExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
