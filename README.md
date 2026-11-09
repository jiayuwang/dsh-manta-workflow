# dsh-manta-workflow

源码与协作：[github.com/jiayuwang/dsh-manta-workflow](https://github.com/jiayuwang/dsh-manta-workflow)

面向 [Manta](https://github.com/Alexander-Nasuta/manta) / Manim 的科学幻灯片与视频工作流，在 DeepSeek Harness 中提供：

- 内容结构化、场景代码生成、headless 渲染与视频抽帧；
- 六层视觉审核规则：排版、科学图表、拓扑连线、时序动画、视频质量、主题一致性；
- 幻灯片与视频帧审核面板；
- 亮红色图上拖框、规则关联与评审意见；
- 返修清单导出与独立验收记录；
- **多项目工作目录隔离**。

## 环境要求

- DeepSeek Harness `>= 0.2.1-rc.2`；
- Node.js `>= 20`；
- 内容项目使用 Python venv，推荐 Python 3.12；
- 已验证依赖：`manim==0.18.1`、`manta-manim-theme==1.0.1`；
- `ffmpeg` 与 `ffprobe`；
- 自动视觉审核需要可用的图像输入模型。没有图像模型时，仍可使用程序化预筛、源码检查和人工面板审核。

Python 环境示例：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install manim==0.18.1 manta-manim-theme==1.0.1 "setuptools<81" pillow numpy
```

## 安装

公开发布后，在 DSH 插件管理器中安装 Bundle：

```text
dsh-manta-workflow@0.3.0
```

本地开发可在工作区中通过 `install_bundle` 安装本目录。安装或更新 Client 后，按 DSH 提示重启并刷新页面。

## 多项目配置

发布补丁不包含任何本机路径。请在自己的 DSH profile patch 中配置项目 id 和工作目录，例如：

```yaml
- id: manta-workflow
  name: dsh-manta-workflow
  config:
    projects:
      convergence: /absolute/path/to/convergence-project
      turbulence: /absolute/path/to/turbulence-project
    defaultProject: convergence
```

- 项目 id 是面板中的选择项；目录可以是任意你有权使用的绝对路径；
- 浏览器只能引用已配置的项目 id，不能提交任意宿主路径；
- 旧版 `projectDir` 仍可作为单个 `default` 项目的配置输入；
- 如果完全没有配置项目，默认使用 DSH 进程当前工作目录。多项目使用时推荐显式配置 `projects`。

每个项目独立使用以下目录：

```text
slides/                  # Manta 场景源码
build/slides/            # 逐页 PNG
build/video/             # 视频
build/frames/            # 视频抽帧
review/report.json       # 自动审核报告
review/annotations.json  # 人工图上标注
review/feedback.json     # 返修修改清单
review/acceptance.json   # 完成验收记录
```

重新生成 `report.json` 不会覆盖人工标注。验收记录绑定报告的生成时间，报告重生成后需要重新验收。

## 工作流如何触发

1. **制作**：在对话中提供论文、大纲或数据，并要求“用 Manta 制作幻灯片/视频”；
2. **审核**：Agent 渲染并生成 `review/report.json`，打开或刷新“Manta 视觉审核”面板；
3. **标注**：点击“添加标注”，在图上拖框，选择规则并填写意见；
4. **返修**：导出修改清单，然后在对话中明确要求“按反馈开始修正”；
5. **验收**：全部素材通过后点击“完成验收”，写入 `acceptance.json`。

当前版本没有后台文件监听或自动启动 Agent；制作和修正由对话指令触发，面板负责审核和状态持久化。

## 通用脚本

```bash
# 视频抽帧
skills/manta-production/scripts/extract_frames.sh <video.mp4> <间隔秒> <输出目录>

# 图像预筛与报告生成
python scripts/prefilter.py build
python scripts/build_report.py --project-dir /path/to/project visual.json
```

`visual.json` 为可选视觉模型结果；不提供时自动发现项目中的幻灯片和抽帧。

## 开发与贡献

```bash
npm test
npm run pack:check
```

欢迎 Issue 和 Pull Request。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。变更记录见 [CHANGELOG.md](CHANGELOG.md)。

## 安全边界

媒体读取限制在所选项目目录及 `build/`、`media/`、`slides/`、`review/` 前缀内；项目目录映射只能由 Host 配置。不要将审核 HTTP 服务直接暴露到不可信网络。

## License

MIT
