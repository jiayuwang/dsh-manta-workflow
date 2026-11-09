---
name: manta-production
description: Use when producing scientific slides or videos with Manta (manta-manim-theme, Manim-based), or when reviewing/iterating rendered Manta output. Covers content structuring, template/theme selection, scene code generation, headless rendering, frame extraction, and the six-layer visual review pipeline (typography, scientific-figure rigor, topology/connectors, timing/animation, video technical quality, theme consistency) that produces review/report.json with improvement suggestions.
license: MIT
metadata:
  version: "0.1.0"
---

# Manta 科学幻灯片与视频制作

基于 [Manta](https://github.com/Alexander-Nasuta/manta)（Manim 主题框架）的科学内容制作流水线。
环境：使用项目自己的 Python venv（已验证 Python 3.12 + manim 0.18.1 + manta-manim-theme 1.0.1），并确保 `ffmpeg`/`ffprobe` 可用。不要把某台机器的 venv 路径写入项目。

## 产物目录约定（项目根相对）

```
slides/          # Manta 场景源码（每个场景一个 .py）
build/slides/    # 逐页幻灯片 PNG
build/video/     # 渲染 mp4
build/frames/    # 视频抽帧 <name>_<sec>.png
review/report.json    # 审核报告（自动预审 + 人工复核）
review/feedback.json  # 导出的结构化修改清单
review/annotations.json # 人工图上标注（独立持久化）
review/acceptance.json  # 完成验收记录
```

## 流水线阶段

### 1. 内容结构化
将科学素材（论文/大纲/数据）拆为逐页大纲：每页 `title`、要点（≤5 条）、图示意图（模块图/曲线/时序图/无）。科学图表优先用真实数据文件。

### 2. 模板与主题选择
- 模板：继承 Manta SlideTemplates（如 `MinimalIntroSlide`），读取模板源码确认可定制项（字号、色板）
- 主题：Catppuccin / Tokyo Night / 自定义；同一项目全片只用一个主题，禁止硬编码色值逃逸主题 token

### 3. 场景代码生成
- 每页幻灯片一个 Scene 类，文件放 `slides/`，类名即素材 id
- 时序规范（写入代码而非事后审）：
  - 新概念 `wait >= 3s`，熟悉内容 1–1.5s，关键结论 3–4s，转场 ≤0.5s
  - 元素必须先出场再被指向/引用
  - 入场 `ease_out_*`、出场 `ease_in_*`、位移 `ease_in_out_*`；有机运动不用 `linear`
- 连线规范：Arrow/Connection 目标用节点边界坐标（`get_edge_center` 等），不裸坐标；单图节点 ≤9、连线 ≤12，超出拆分

### 4. 渲染（headless，禁止 GUI 路径）
```bash
source <项目venv>/bin/activate
# 逐页末帧 PNG（不使用 show_last_frame()，它会启动查看器）
manim -qm -s --format=png slides/<file>.py <SceneName> --media_dir build
# 视频
manim -qm slides/<file>.py <SceneName> --media_dir build
```
渲染后统一把末帧 PNG 归档为 `build/slides/<scene>.png`；默认统一使用 `-qm` 的 1280×720。

### 5. 视频抽帧
```bash
skills 资源 scripts/extract_frames.sh <video.mp4> <interval_sec> <outdir>
```
帧命名 `<name>_<秒>.png`，时间戳写进 report.json 的 `timestamp`。

### 6. 视觉审核（六层规则）
完整规则见 [references/review-rules.md](references/review-rules.md)，摘要：
- R1 排版可读性、R2 科学图表严谨性、R3 拓扑连线、R4 时序动画、R5 视频技术质量、R6 主题一致性
- 检测方式：`[P]` 程序化预筛（脚本）→ `[S]` 场景源码检查（AST/文本扫描）→ `[V]` 视觉读图（主模型不支持读图时，必须委派给支持图像输入的 subagent，逐图给意见）
- 结果合并写入 `review/report.json`，每条 issue 带 `rule` 编号（如 `R3-连线端点`）与具体修改动作
- 通用报告生成：`python scripts/build_report.py --project-dir <项目目录> [visual.json]`；不提供 visual.json 时自动发现幻灯片和抽帧

report.json v1：
```json
{
  "project": "…", "generatedAt": "ISO8601",
  "items": [
    {"id": "slide-03", "kind": "slide|frame",
     "image": "build/slides/slide_03.png", "timestamp": 12.5,
     "source": {"file": "slides/intro.py", "line": 42},
     "autoReview": {"issues": ["…"], "suggestions": ["…"], "rules": ["R1-文字溢出"]},
     "humanVerdict": null, "humanComment": null}
  ]
}
```

### 7. 闭环
人工在面板标注并导出 `review/feedback.json`，随后在对话中明确要求“按反馈开始修正”。Agent 读取修改清单，定位场景源码、重渲受影响页并复审。全部通过后在面板点击“完成验收”，写入 `review/acceptance.json`。导出本身不会自动启动 Agent。

每个项目有自己的工作目录；面板切换项目只改变读写目标，不共享中间文件或评审状态。

## 注意事项

- `sox` 未安装：voiceover 配音功能不可用，首版跳过
- manimpango 曾有 RPATH 问题已修复；若换环境重建 venv 需重新 `patchelf --remove-rpath`
  `site-packages/manimpango/_register_font.*.so`，并固定 `setuptools<81`
