# Manta 科学视频与幻灯片制作工作流 — 设计 Spec

日期：2026-11-08 · 状态：已获方向批准，待用户复核

## 目标

基于 [Manta](https://github.com/Alexander-Nasuta/manta)（Manim 幻灯片/视频框架）构建可复用的科学内容制作工作流，最终产出幻灯片与视频，并通过**视觉化审核面板**给出改进建议，形成"制作 → 审核 → 修改"闭环。

## 非目标（首版）

- 不做 Manim-Editor GUI 集成
- 不做自动重渲循环（AgentTeams 全自动审核为后续扩展）
- 不做多主题并行比较 UI

## 组件

### 1. Skill：`manta-production`（DSH 技能包）

阶段流水：
1. **内容结构化**：科学素材（论文/大纲/数据）→ 逐页大纲（标题、要点、图示意图）
2. **模板与主题选择**：Manta SlideTemplates（如 MinimalIntroSlide 等）+ 主题（Catppuccin / Tokyo Night / 自定义）
3. **代码生成**：产出 Manta 场景 Python 代码（`slides/*.py`），复用模板继承模式
4. **渲染**：调用 Manta 渲染 API → `build/slides/*.png`（逐页末帧）、`build/video/*.mp4`
5. **抽帧**：视频按场景/固定间隔抽帧 → `build/frames/`
6. **触发审核**：整理素材清单，进入审核阶段

产物目录约定（项目根相对）：
```
slides/          # Manta 场景源码
build/slides/    # 逐页 PNG
build/video/     # mp4
build/frames/    # 视频抽帧
review/report.json   # 审核意见（自动预审 + 人工复核）
review/feedback.json # 导出的结构化修改清单
```

### 2. 插件：视觉审核面板（DSH Web UI bundle）

- **Host 侧**：Service 读取 `review/report.json` 与素材目录（图片以文件路径/静态服务方式供 Client 加载）；支持配置多个项目 id → 独立工作目录，所有读写按项目隔离，面板可切换项目
- **Client 侧**：侧边栏面板，两个视图：
  - 幻灯片缩略图墙（逐页卡片）
  - 视频抽帧时间线（按时间排序卡片）
- 每卡片：图像、自动审核意见、改进建议、源文件:行号跳转
- 人工操作：✅ 通过 / ❌ 需修改 + 追加评语；返修时导出修改清单（`review/feedback.json`）；全部通过后使用独立“完成验收”按钮写入 `review/acceptance.json`，并在报告未重新生成时恢复通过状态
- 图上人工标注：进入“添加标注”模式后拖框，每图支持多个编号方框；方框与意见编辑器双向高亮，可编辑规则/评语、删除；标注后自动视为“需修改”
- 方框使用相对图片宽高的 0–1 归一化坐标 `{x,y,width,height}`，窗口/图片缩放不漂移；无图片的全局项不显示标注入口
- 人工标注独立持久化到 `review/annotations.json`，读取 report 时按素材 id 合并；重新生成 report.json 不覆盖标注
- `feedback.json` 的 entries/fixList 携带对应 annotations，供下一轮定位修改
- annotations.json 结构（v1）：
```json
{
  "version": 1,
  "updatedAt": "ISO8601",
  "items": {
    "slide-03": [
      {"id": "uuid", "rect": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.2},
       "comment": "箭头未落在节点边界", "rule": "R3-连线端点",
       "createdAt": "ISO8601", "updatedAt": "ISO8601"}
    ]
  }
}
```
- report.json 结构（v1）：
```json
{
  "project": "…", "generatedAt": "ISO8601",
  "items": [
    {"id": "slide-03", "kind": "slide|frame",
     "image": "build/slides/slide_03.png",
     "timestamp": 12.5,
     "source": {"file": "slides/intro.py", "line": 42},
     "autoReview": {"issues": ["文字溢出"], "suggestions": ["缩小字号或拆分要点"]},
     "humanVerdict": null, "humanComment": null}
  ]
}
```

### 3. 自动预审规则（写入 skill）

预审规则分六层，每条规则标注检测方式：`[V]` 视觉模型读图、`[P]` 程序化预筛脚本、`[S]` 场景源码结构检查（Manta 代码 AST/约定）。

**R1 排版与可读性**（幻灯片 + 帧）
- 文字溢出/被图形遮挡、超出安全边距 `[V][P]`（边缘像素检测）
- 字号层级一致性（标题/正文/标注三级比例） `[V]`
- 每页信息密度：要点数、单页文字量上限 `[V][S]`（参考 Harvard 幻灯片清单的"一页一信息"原则）

**R2 科学图表严谨性**（参考 Nature 图表规范）
- 坐标轴：轴名称、单位刻度完整，不截断误导 `[V]`
- 图例覆盖图中全部视觉编码（颜色/线型/形状），且无多余项 `[V]`
- 配色：色盲友好（避免红绿同图纯色对）、同一语义跨页用色一致 `[V][S]`（主题 token 检查）
- 数据真实性：曲线/柱状与源数据一致 `[S]`（数据文件对照，可选）

**R3 拓扑与连线**（模块图/架构图/流程图，参考 diagram-design 连线规则）
- 连线端点：箭头必须落在目标节点边界上，不悬空、不穿过非端点节点 `[V][S]`（Manta 中 Arrow/Connection 目标坐标检查）
- 连线正交性：避免斜线乱穿，交叉处用跳线或重新布线 `[V]`
- 标签间隙：连线标签有底衬遮罩，不与线条/节点重叠 `[V]`
- 共享边扇出：同一节点多条连线附着点错开，不互相压盖 `[V]`
- 复杂度预算：单图节点 ≤9、连线 ≤12，超出建议拆分为总览+详图 `[S]`（场景中 mobject 计数）
- 孤儿节点：无任何连线的模块（除非有意独立） `[V][S]`

**R4 时序与动画**（视频 + 逐帧，参考 manim 节奏规则）
- 停顿时长按内容类型分级：新概念 wait ≥3s、熟悉内容 1–1.5s、关键结论 3–4s、转场 ≤0.5s `[S]`（解析 `self.play`/`self.wait` 的 run_time 与顺序）+ `[V]` 抽帧间隔对照
- 元素出场先于引用：被讲解/被指向的元素必须先出现 `[S]`（动画顺序 vs 指向关系）
- 时序图专用：消息箭头按时间顺序自上而下，激活期与调用区间一致 `[V]`
- 节奏一致性：避免连续快闪（run_time<0.2）或单元素停滞 >5s `[S]`
- easing 合理性：入场 ease_out、出场 ease_in、位移 ease_in_out，不用纯 linear 表现有机运动 `[S]`

**R5 视频技术质量**（程序化为主）
- 黑帧/闪帧/纯色帧检测 `[P]`（帧差分）
- 关键帧间隔异常（长静止段、密集切变） `[P]`
- 转场残影、元素残留（前页内容未清除） `[V][P]`
- 分辨率/宽高比一致性、文字最小可读尺寸 `[P][V]`

**R6 主题一致性**
- 主题 token（Manta 主题色板/字体）全片一致，无硬编码色值逃逸 `[S]`（源码色值扫描）+ `[V]`
- 图标风格统一（Nerdfont 图标与矢量图混用检测） `[V]`

预审执行：`[P]` 脚本（预筛器）→ `[V]` agent 视觉逐图审 → `[S]` 场景源码检查，三类结果合并去重后写入 report.json 的 `autoReview`，每条 issue 标注规则编号（如 `R3-连线端点`），建议给到具体修改动作。

参考来源：[Nature 图表规范](https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/)、[Harvard 幻灯片检查清单](https://hsph.harvard.edu/research/health-communication/resources/slide-checklist/)、[manim-video-generator 节奏规则](https://github.com/rohitg00/manim-video-generator/blob/main/skills/visual-storyteller/rules/pacing-for-understanding.md)、[manim 时序与 easing 规则](https://github.com/rohitg00/manim-video-generator/blob/main/skills/motion-graphics/rules/timing-and-easing.md)、[diagram-design 连线规则](https://github.com/cathrynlavery/diagram-design/blob/master/skills/diagram-design/SKILL.md)

## 验收标准

1. 用一篇短科学内容跑通：大纲 → Manta 代码 → 渲染 ≥5 页幻灯片 + ≥1 段视频 + 抽帧
2. 审核面板展示全部素材，每项含自动意见与建议
3. 人工标记后可导出结构化修改清单 feedback.json；图上拖框可绑定意见，刷新后保留，导出包含归一化坐标
4. 修改清单内容可被下一轮制作阶段消费（闭环成立）

## 实施顺序

1. Manta 环境验证 + 管线试渲染（最小样例）
2. Skill `manta-production` 编写与安装
3. 审核插件 bundle（Host Service → Client 面板）
4. 端到端验收（上述标准 1–4）

## 环境验证记录（2026-11-08，已完成）

- 环境：`~/manim-env`（Python 3.12 venv）。修复项：
  - manimpango 二进制 RPATH 误指 `/opt/anaconda3/lib`（新旧 glib/pango 混载），已 patchelf 移除
  - manim_voiceover 依赖 `pkg_resources`，已固定 `setuptools<81`
  - 安装 manta-manim-theme 1.0.1（连带把 manim 降级到 0.18.1，与 Manta 1.0.1 匹配）
- 渲染验证：`examples/minimal_slide.py` 成功产出 1280x720 PNG（32KB，含文字内容）
- 管线注意：`show_last_frame()` 会启动 GUI 查看器，headless 流水线应改用 manim CLI（`manim -ql --format=png ... -o`）或渲染 API
- 视觉审核 `[V]` 规则：当前主模型不支持图片输入，读图审核需委派给支持视觉的模型（subagent 支持 model 覆写）
- sox 未安装：仅配音（voiceover）功能需要，首版可不用

## 端到端验收记录（2026-11-08，已完成）

- 内容：《迭代求解器的收敛控制》5 页幻灯片 + 13s 视频（`slides/convergence_deck.py`）
- 渲染：5 张末帧 PNG + mp4 + 6 抽帧；期间适配 manim 0.18.1 的坑：easing 在 `m.rate_functions.*`、`Axes(width=)`/log 轴有 bug（用 `scale_to_fit_width` + log₁₀ 变换替代）、`set_title_row` 返回 AnimationGroup 直接 play、无 `m.BOTTOM`
- 审核：`[P]` scripts/prefilter.py（黑帧/尺寸）、`[S]` scripts/build_report.py 内源码检查（复杂度预算/色值逃逸/easing）、`[V]` glm-4.6v 视觉读图
## 端到端验收记录（2026-11-08，已完成）

- **插件部署边界（实测）**：本地 link 包（`link:` 安装）的 client 半边**无法**通过 HMR 安装进入浏览器 boot 模块表（npm 安装包如 better-sidebar 可以）；且同名包 remove+重装后需要重启才能加载新一代模块。结论：**本地 link 带客户端 UI 的 bundle，每次更新 client.js 或重装后都需要重启 `dsh web` 并强刷页面**。Host 半边（HTTP 路由）则始终随激活即时生效。
- 视觉路由：zai-coding-cn/glm-4.6v 可读图（glm-4.5v 不可用）；并发读图 >3 会触发限流长时间挂起，必须分批（每批 ≤3）
- report.json 12 items，面板 API 实测返回正常；人工复核 → feedback.json 闭环待用户在面板完成

## 风险

- Manta 渲染依赖 Manim 环境（主目录已有 manim-env，需验证版本兼容）
- 图片在 Client 面板的加载方式需按 DSH 插件实际 API 确定（静态资源/文件 Service）
- 视频抽帧密度影响审核效率，首版用固定间隔 + 场景边界
