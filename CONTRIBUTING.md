# Contributing

## 开发流程

1. 新建 Issue 描述使用场景、验收标准和兼容性影响；
2. 小范围修改对应 owner：Host 路由在 `index.js`，项目解析在 `project-registry.js`，项目内持久化在 `review-service.js`，面板在 `client.js`，制作规则在 `skills/manta-production/`；
3. 运行 `npm test` 与 `npm run pack:check`；
4. 对 UI 变更附上实际页面验证结果；仅安装成功不等于 UI 验收；
5. 提交 PR，说明兼容性、数据契约和未覆盖风险。

## 数据兼容

`report.json`、`annotations.json`、`feedback.json`、`acceptance.json` 是工作流契约。新增字段优先保持向后兼容；不兼容变更需要版本号、迁移说明和 CHANGELOG。

## 发布

维护者在确认公共仓库、npm 包名和凭据后，通过版本 tag 触发发布。不要在 PR 中提交本机审核数据、凭据或绝对路径。
