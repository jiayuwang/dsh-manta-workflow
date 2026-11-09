/**
 * dsh-manta-workflow Host：注入 manta-production 技能树，并提供按项目隔离的
 * report/media/annotations/feedback/acceptance HTTP 路由。
 */

import { fileURLToPath } from 'node:url'
import { createReadStream } from 'node:fs'
import z from '@deepseek-ai/schemastery'
import { apply as applyFilesystemProvider } from '@deepseek-ai/dsh-skill-filesystem'
import { sendJson, mediaType, fileExists } from './review-service.js'
import { ProjectRegistry } from './project-registry.js'

const skillsRoot = fileURLToPath(new URL('./skills/', import.meta.url))

export const name = 'manta-workflow'
export const inject = ['skills', 'webServer']

export const Config = z.object({
  /** 旧版单项目目录；新配置优先使用 projects。 */
  projectDir: z.string(),
  /** 项目 id → 工作目录；每个目录独立保存 build/media/review。 */
  projects: z.dict(z.string()).default({}),
  defaultProject: z.string(),
})

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function apply(ctx, config) {
  applyFilesystemProvider(ctx, {
    providerName: 'manta-workflow',
    includeDefaultRoots: false,
    bundledSkillDir: skillsRoot,
    watch: false,
  })

  const registry = new ProjectRegistry(config)
  const service = (req) => registry.service(
    new URL(req.url, 'http://localhost').searchParams.get('project'),
  )
  const handleError = (res, error) => sendJson(res, error.status ?? 400, {
    error: String(error?.message ?? error),
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/manta-review/api/projects',
    handler: (_req, res) => sendJson(res, 200, registry.list()),
  }), 'manta-workflow: projects route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/manta-review/api/report',
    handler: async (req, res) => {
      try { sendJson(res, 200, await service(req).readReport()) }
      catch (error) { handleError(res, error) }
    },
  }), 'manta-workflow: report route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/manta-review/media',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        const rel = decodeURIComponent(url.pathname).replace(/^\/manta-review\/media\/?/, '')
        const abs = service(req).resolveMedia(rel)
        if (abs === undefined || !(await fileExists(abs))) {
          sendJson(res, 404, { error: 'not found' })
          return
        }
        res.writeHead(200, { 'content-type': await mediaType(abs), 'cache-control': 'no-cache' })
        createReadStream(abs).pipe(res)
      } catch (error) { handleError(res, error) }
    },
  }), 'manta-workflow: media route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/manta-review/api/annotations',
    handler: async (req, res) => {
      try {
        const body = await readBody(req)
        const annotations = await service(req).writeAnnotations(body.itemId, body.annotations)
        sendJson(res, 200, { itemId: body.itemId, annotations })
      } catch (error) { handleError(res, error) }
    },
  }), 'manta-workflow: annotations route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/manta-review/api/acceptance',
    handler: async (req, res) => {
      try {
        const body = await readBody(req)
        sendJson(res, 200, await service(req).writeAcceptance(body.entries ?? body))
      } catch (error) { handleError(res, error) }
    },
  }), 'manta-workflow: acceptance route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/manta-review/api/feedback',
    handler: async (req, res) => {
      try {
        const body = await readBody(req)
        sendJson(res, 200, await service(req).writeFeedback(body.entries ?? body))
      } catch (error) { handleError(res, error) }
    },
  }), 'manta-workflow: feedback route')
}
