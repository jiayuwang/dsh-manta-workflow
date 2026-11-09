// project-registry —— 配置项目 id 到工作目录的唯一映射。
// 客户端只能选择已配置项目，不能提交任意宿主路径。

import { resolve } from 'node:path'
import { ReviewService } from './review-service.js'

export class ProjectRegistry {
  constructor(config = {}, { cwd = process.cwd() } = {}) {
    const entries = new Map()
    const configured = config.projects && typeof config.projects === 'object' ? config.projects : {}
    for (const [id, directory] of Object.entries(configured)) {
      if (!id || id.length > 100 || typeof directory !== 'string' || directory.length === 0) {
        throw new Error(`非法项目配置: ${id}`)
      }
      entries.set(id, resolve(cwd, directory))
    }
    // 旧版单项目配置作为 default 项目输入；显式 projects.default 优先。
    if (config.projectDir && !entries.has('default')) {
      entries.set('default', resolve(cwd, config.projectDir))
    }
    // 无配置时以 DSH 进程工作目录为单项目；多项目应显式配置 projects。
    if (entries.size === 0) entries.set('default', resolve(cwd))
    this.defaultProject = config.defaultProject && entries.has(config.defaultProject)
      ? config.defaultProject
      : entries.keys().next().value
    this.directories = entries
    this.services = new Map()
  }

  list() {
    return {
      items: [...this.directories.keys()].map((id) => ({ id })),
      defaultProject: this.defaultProject,
    }
  }

  service(id) {
    const selected = id || this.defaultProject
    if (!this.directories.has(selected)) {
      const error = new Error(`未知项目: ${selected}`)
      error.status = 404
      throw error
    }
    if (!this.services.has(selected)) {
      this.services.set(selected, new ReviewService(this.directories.get(selected), selected))
    }
    return this.services.get(selected)
  }
}
