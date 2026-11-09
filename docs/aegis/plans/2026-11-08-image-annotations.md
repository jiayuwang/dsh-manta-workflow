# 图片人工标注实施计划

## Goal
在审核面板的幻灯片和视频帧上拖框并填写评审意见；标注随窗口缩放保持位置，持久化并进入 feedback.json 修改闭环。

## Architecture / Owners
- `review-service.js`：annotations.json 的唯一读写与校验者；report 读取时合并标注，feedback 导出携带标注。
- `index.js`：新增 `/manta-review/api/annotations` HTTP 接线，不复制业务逻辑。
- `client.js`：现有 Card 内增加 HTML 绝对定位标注层和意见列表；ReviewPanel 持有标注状态与保存/导出。
- 人工数据 `review/annotations.json` 与生成的 `review/report.json` 分离，report 重生成不覆盖人工数据。

## Baseline / Compatibility
- 已批准：人工拖框 + 填意见；不做 AI 自动框选。
- 保持现有 report v1、feedback 字段和 ✅/❌ 操作兼容；新增 annotations 为附加字段。
- 无图片的全局项保持破图修复，不渲染图片或标注层。

## Change Necessity
纯文档/配置无法实现图上坐标、拖框交互与持久化，必须修改上述三个既有 owner；不新增运行时插件 owner。

## TDD Route
Mode off；decision skipped（无显式 strict 授权）。采用 post-change 的 Node 数据/组件测试、坐标换算测试和 HTTP 验证。

## Tasks
1. SPEC 并入标注契约与验收。
2. Host：annotations 读写、归一化坐标/条目校验、report 合并、feedback 附加、HTTP 路由。
3. Client：拖框、编号、选择高亮、规则与意见编辑、保存/删除、错误提示；有标注自动判为需修改。
4. 测试：Node test 覆盖持久化/非法输入/导出；Client 结构测试覆盖无图、框位置、坐标反向拖动；curl 验证新 API 和既有 report/media/feedback。
5. 交付：说明本地 link client 更新所需的重启+强刷及未覆盖的人工浏览器验收。

## Verification / Acceptance
- 反向拖动得到合法 0–1 矩形；过框和非法 comment/rule 被拒绝。
- 每图多框，编号与意见对应；report 刷新后标注仍在；无图项无破图。
- feedback entries/fixList 含 annotations；既有导出调用不需要新必填字段。

## Risks / Retirement
- 浏览器真实拖放手感仍需人工验收；无移动/缩放方框和 AI 自动框选，均属后续扩展。
- 不保留第二份标注 owner；若未来引入 AI 框选，仍写同一 annotations 契约。
