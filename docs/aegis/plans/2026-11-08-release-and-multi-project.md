# 发布准备与多项目工作目录实施计划

## Goal
将本机开发插件改造为可分发的 `dsh-manta-workflow`，支持多个配置项目，每个项目独立保存 build/media/review 中间与评审文件；不执行公开发布。

## Architecture
- `project-registry.js`：配置项目 id → 绝对目录的唯一解析者；只接受已配置 id，缓存每项目 ReviewService。
- `review-service.js`：继续拥有单项目内的 report/annotations/feedback/acceptance；media URL 携带项目 id。
- `index.js`：所有 HTTP 路由从 `?project=` 选择项目，新增 `/api/projects`；不在路由里复制路径规则。
- `client.js`：顶部项目选择器；切换时清理上一项目瞬态状态，所有请求携带项目 id；选择保存在 localStorage。
- 配置：`projects: {id: absolutePath}` + `defaultProject`；保留 `projectDir` 作为旧单项目配置输入，未配置时回退到 `process.cwd()` 并在 README 明示。

## Compatibility / Safety
- API 路径保持不变，只新增可选 project 查询参数；缺省使用 defaultProject。
- 不允许客户端提交任意宿主路径；媒体仍受项目目录和前缀白名单约束。
- 包名、模块 id、locale namespace 同步改名；面板 id 与 `/manta-review` 路由不变。
- 示例报告、用户标注和本机构建产物不进入 npm 包。

## Change Necessity
单项目静态配置和 `@local/private` 无法满足多项目与公开安装；需要修改现有 owner 并新增项目解析模块。无纯文档方案。

## TDD Route
Mode off / skipped；采用 Node 回归、项目隔离/未知项目/URL 测试、npm pack 内容检查和真实 HTTP 验证。

## Tasks
1. SPEC/计划固定多项目契约和发布边界。
2. 项目注册表 + 路由/媒体/API 项目隔离。
3. Client 选择器、状态隔离和持久化选择。
4. 包元数据、README/LICENSE/CHANGELOG/CONTRIBUTING、CI、.gitignore；build_report 移除示例项目硬编码。
5. 测试、npm pack dry-run、重装与真实多项目 API 验证。
6. 交付重启说明；公开发布仍需用户确认包名、仓库和发布凭据。

## Verification
- 两项目同 id 素材各自返回自己的报告/标注；未知项目 404；媒体越界仍 404。
- 项目切换后所有请求使用新项目；验收仍绑定所在项目报告。
- npm 包包含运行/技能/脚本/文档，不包含本机 review/build/media。

## Risks
- 当前面板是根级全局面板，采用显式项目切换而非自动跟随 Session；这是本版边界。
- 本地 link client 更新仍需重启+强刷；npm 安装后的 HMR 边界另行验证。
