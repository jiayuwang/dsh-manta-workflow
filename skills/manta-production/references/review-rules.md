# 六层视觉审核规则

每条规则标注检测方式：`[V]` 视觉模型读图、`[P]` 程序化预筛脚本、`[S]` 场景源码结构检查。
issue 输出统一带规则编号（如 `R3-连线端点`）与具体修改动作。

## R1 排版与可读性（幻灯片 + 帧）
- 文字溢出/被图形遮挡、超出安全边距 `[V][P]`（边缘像素检测）
- 字号层级一致性（标题/正文/标注三级比例） `[V]`
- 每页信息密度：要点 ≤5、单页文字量上限（一页一信息原则） `[V][S]`

## R2 科学图表严谨性（Nature 图表规范）
- 坐标轴：轴名称、单位刻度完整，不截断误导 `[V]`
- 图例覆盖图中全部视觉编码（颜色/线型/形状），且无多余项 `[V]`
- 配色：色盲友好（避免红绿同图纯色对）、同一语义跨页用色一致 `[V][S]`（主题 token 检查）
- 数据真实性：曲线/柱状与源数据一致 `[S]`（数据文件对照，可选）

## R3 拓扑与连线（模块图/架构图/流程图）
- 连线端点：箭头必须落在目标节点边界上，不悬空、不穿过非端点节点 `[V][S]`（Arrow 目标坐标检查）
- 连线正交性：避免斜线乱穿，交叉处用跳线或重新布线 `[V]`
- 标签间隙：连线标签有底衬遮罩，不与线条/节点重叠 `[V]`
- 共享边扇出：同一节点多条连线附着点错开，不互相压盖 `[V]`
- 复杂度预算：单图节点 ≤9、连线 ≤12，超出建议拆分为总览+详图 `[S]`（mobject 计数）
- 孤儿节点：无任何连线的模块（除非有意独立） `[V][S]`

## R4 时序与动画（视频 + 逐帧）
- 停顿时长分级：新概念 wait ≥3s、熟悉内容 1–1.5s、关键结论 3–4s、转场 ≤0.5s `[S]`（解析 `self.play`/`self.wait` 的 run_time 与顺序）+ `[V]` 抽帧间隔对照
- 元素出场先于引用：被讲解/被指向的元素必须先出现 `[S]`（动画顺序 vs 指向关系）
- 时序图专用：消息箭头按时间顺序自上而下，激活期与调用区间一致 `[V]`
- 节奏一致性：避免连续快闪（run_time<0.2）或单元素停滞 >5s `[S]`
- easing 合理性：入场 ease_out、出场 ease_in、位移 ease_in_out，不用纯 linear 表现有机运动 `[S]`

## R5 视频技术质量（程序化为主）
- 黑帧/闪帧/纯色帧检测 `[P]`（帧差分）
- 关键帧间隔异常（长静止段、密集切变） `[P]`
- 转场残影、元素残留（前页内容未清除） `[V][P]`
- 分辨率/宽高比一致性、文字最小可读尺寸 `[P][V]`

## R6 主题一致性
- 主题 token（Manta 主题色板/字体）全片一致，无硬编码色值逃逸 `[S]`（源码色值扫描）+ `[V]`
- 图标风格统一（Nerdfont 图标与矢量图混用检测） `[V]`

## 执行顺序

1. `[P]` 预筛脚本 → 2. `[S]` 源码检查 → 3. `[V]` 视觉逐图审（委派图像能力 subagent）
三类结果按素材 id 合并去重，写入 `review/report.json`。

## 参考

- [Nature 图表规范](https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/)
- [Harvard 幻灯片检查清单](https://hsph.harvard.edu/research/health-communication/resources/slide-checklist/)
- [manim 节奏规则](https://github.com/rohitg00/manim-video-generator/blob/main/skills/visual-storyteller/rules/pacing-for-understanding.md)
- [manim 时序与 easing 规则](https://github.com/rohitg00/manim-video-generator/blob/main/skills/motion-graphics/rules/timing-and-easing.md)
- [diagram-design 连线规则](https://github.com/cathrynlavery/diagram-design/blob/master/skills/diagram-design/SKILL.md)
