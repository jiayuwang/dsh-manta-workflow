"""迭代求解器的收敛控制 —— 端到端验收幻灯片组。

主题：Manta Minimal 模板（Iosevka Term 字体、内置色板 token，无硬编码色值）。
时序规范（R4）：新概念 wait>=3s，结论 3s，转场 0.5s；入场 ease_out、出场 ease_in。
"""
import numpy as np
import manim as m

from manta.slide_templates.minimal.minimal_intro_slide import MinimalIntroSlide
from manta.slide_templates.minimal.minimal_slide_template import MinimalSlideTemplate


class ConvergenceIntro(MinimalIntroSlide):
    """第 1 页：封面"""
    title = "迭代求解器的收敛控制"
    subtitle = "从残差判据到松弛策略 · Manta 工作流验收"

    def construct(self):
        self.play(self.fade_in_slide())
        # 用一条残差衰减火花线点题，避免封面只有文字与纯色背景。
        spark_axes = m.Axes(
            x_range=[0, 1, 0.5], y_range=[0, 1, 0.5],
            axis_config={"include_ticks": False, "stroke_width": 1.0},
        ).scale_to_fit_width(4.0).stretch_to_fit_height(1.8).to_corner(m.UR, buff=0.85).shift(m.DOWN * 0.35)
        x = np.linspace(0, 1, 120)
        y = np.exp(-4.2 * x) * 0.86 + 0.08
        spark = spark_axes.plot_line_graph(
            x_values=x, y_values=y, add_vertex_dots=False, line_color=self.blue,
        )["line_graph"].set_stroke(color=self.blue, width=4)
        endpoint = m.Dot(radius=0.08, color=self.green).move_to(spark_axes.c2p(1, y[-1]))
        caption = m.Text("residual → tolerance", font_size=16, color=self.font_color_secondary)
        caption.next_to(spark_axes, m.DOWN, buff=0.18)
        self.play(m.Create(spark_axes, rate_func=m.rate_functions.ease_in_out_cubic, run_time=0.5),
                  m.Create(spark, rate_func=m.rate_functions.ease_out_cubic, run_time=0.9),
                  m.FadeIn(caption, rate_func=m.rate_functions.ease_out_cubic, run_time=0.4))
        self.play(m.FadeIn(endpoint, scale=1.4, rate_func=m.rate_functions.ease_out_back, run_time=0.35))
        self.wait(2.5)  # 封面属熟悉内容，2.5s


class ResidualSlide(MinimalSlideTemplate):
    """第 2 页：残差判据（新概念，含真实衰减曲线）"""
    index_prefix = "02"

    def construct(self):
        self.play(self.set_title_row(title="残差判据", subtitle="Residual Criteria", seperator=" · "))

        # 真实形态的残差衰减曲线（指数收敛 + 平台期）；纵轴取 log10(残差)
        iters = np.linspace(0, 100, 200)
        logres = np.log10(1e0 * np.exp(-iters / 18.0) + 1e-4)
        axes = m.Axes(
            x_range=[0, 100, 20], y_range=[-5, 1, 1],
            x_axis_config={"include_ticks": True, "font_size": 16},
            y_axis_config={"include_ticks": True, "font_size": 16},
        ).scale_to_fit_width(6.2).stretch_to_fit_height(4.0).shift(m.RIGHT * 1.3 + m.DOWN * 0.35)
        labels = axes.get_axis_labels(
            x_label=m.Text("迭代步数 / 步", font_size=20),
            y_label=m.Text("log₁₀(无量纲残差)", font_size=19),
        )
        labels[0].shift(m.UP * 0.35)  # 避开末端 100 刻度
        tick_labels = m.VGroup()
        for value in range(0, 101, 20):
            tick_labels.add(m.Text(str(value), font_size=13).move_to(axes.c2p(value, 0) + m.UP * 0.24))
        for value in range(-5, 2):
            tick_labels.add(m.Text(str(value), font_size=13).move_to(axes.c2p(0, value) + m.LEFT * 0.32))
        labels.add(tick_labels)
        curve = axes.plot_line_graph(
            x_values=iters, y_values=logres,
            add_vertex_dots=False, line_color=self.blue,
        )["line_graph"].set_stroke(color=self.blue, width=4)
        tol = m.DashedLine(
            start=axes.c2p(0, -4), end=axes.c2p(100, -4),
            color=self.yellow,
        )
        tol_label = m.Text("容差 1e-4", font_size=20, color=self.yellow).next_to(tol, m.RIGHT, buff=0.15)

        bullets = m.VGroup()
        for text, color in [
            ("残差按指数衰减至平台期", self.blue),
            ("收敛判据：残差 < 容差", self.green),
            ("平台期提示网格或参数受限", self.yellow),
        ]:
            dot = m.Dot(radius=0.055, color=color)
            line = m.Text(text, font_size=22)
            bullets.add(m.VGroup(dot, line).arrange(m.RIGHT, buff=0.18))
        bullets.arrange(m.DOWN, aligned_edge=m.LEFT, buff=0.42).to_edge(m.LEFT, buff=0.6).shift(m.UP * 0.35)

        # 出场顺序：先坐标轴，再曲线，最后判据线（元素先出场再被引用）
        self.play(m.Create(axes), m.FadeIn(labels), run_time=1.0, rate_func=m.rate_functions.ease_in_out_cubic)
        self.wait(1.0)
        self.play(m.Create(curve), run_time=1.2, rate_func=m.rate_functions.ease_out_cubic)
        for b in bullets:
            self.play(m.FadeIn(b, shift=m.RIGHT * 0.3, rate_func=m.rate_functions.ease_out_cubic, run_time=0.5))
            self.wait(0.6)
        self.play(m.Create(tol), m.FadeIn(tol_label), run_time=0.5, rate_func=m.rate_functions.ease_out_cubic)
        self.wait(3.0)  # 新概念页结论


class RelaxationSlide(MinimalSlideTemplate):
    """第 3 页：松弛因子（视频场景，含模块连线）"""
    index_prefix = "03"

    def construct(self):
        self.play(self.set_title_row(title="松弛因子", subtitle="Relaxation Strategy", seperator=" · "))

        # 卡片式三阶段流程：编号、语义色、双层文字，减少空洞线框感。
        stages = [
            ("01", "残差评估", "Residual", "计算当前误差", self.blue, m.LEFT * 3.85),
            ("02", "松弛修正", "Relaxation", "按 α 更新解", self.green, m.ORIGIN),
            ("03", "收敛判定", "Convergence", "检查残差容差", self.yellow, m.RIGHT * 3.85),
        ]
        cards = m.VGroup()
        bodies = []
        for number, title, english, caption, color, xpos in stages:
            center = xpos + m.UP * 0.45
            body = m.RoundedRectangle(
                width=3.25, height=1.55, corner_radius=0.14,
                stroke_color=color, stroke_width=1.8,
                fill_color=color, fill_opacity=0.12,
            ).move_to(center)
            accent = m.Rectangle(
                width=2.85, height=0.055, stroke_width=0,
                fill_color=color, fill_opacity=1,
            ).move_to(center + m.UP * 0.66)
            badge = m.Circle(
                radius=0.25, stroke_width=0, fill_color=color, fill_opacity=1,
            ).move_to(center + m.LEFT * 1.12 + m.UP * 0.32)
            num = m.Text(number, font_size=15, color=self.background_color).move_to(badge)
            heading = m.Text(title, font_size=25).move_to(center + m.RIGHT * 0.3 + m.UP * 0.31)
            sub = m.Text(english, font_size=14, color=color).move_to(center + m.RIGHT * 0.3 + m.UP * 0.02)
            desc = m.Text(caption, font_size=18).move_to(center + m.DOWN * 0.43)
            cards.add(m.VGroup(body, accent, badge, num, heading, sub, desc))
            bodies.append(body)

        # 主流程只使用水平连线；反馈走下方弧线，避免斜线穿插。
        forward = m.VGroup(
            m.Arrow(start=bodies[0].get_edge_center(m.RIGHT), end=bodies[1].get_edge_center(m.LEFT),
                    buff=0.12, color=self.blue, stroke_width=2.2),
            m.Arrow(start=bodies[1].get_edge_center(m.RIGHT), end=bodies[2].get_edge_center(m.LEFT),
                    buff=0.12, color=self.green, stroke_width=2.2),
        )
        feedback = m.CurvedArrow(
            start_point=bodies[2].get_edge_center(m.DOWN),
            end_point=bodies[0].get_edge_center(m.DOWN),
            angle=-m.PI / 2, color=self.yellow, stroke_width=2.0,
        )
        feedback_label = m.Text(
            "未收敛：降低 α 后重新评估", font_size=17, color=self.yellow,
        ).move_to(m.DOWN * 1.18)

        note_bg = m.RoundedRectangle(
            width=8.8, height=0.62, corner_radius=0.12,
            stroke_color=self.blue, stroke_width=0.8,
            fill_color=self.blue, fill_opacity=0.06,
        ).to_edge(m.DOWN, buff=0.42)
        note = m.Text(
            "α 偏大：收敛更快但易发散   ·   α 偏小：更稳定但迭代更多",
            font_size=20,
        ).move_to(note_bg)

        self.play(m.FadeIn(cards[0], scale=0.94, rate_func=m.rate_functions.ease_out_cubic, run_time=0.65))
        self.wait(1.0)
        self.play(m.Create(forward[0], rate_func=m.rate_functions.ease_out_cubic, run_time=0.35))
        self.play(m.FadeIn(cards[1], scale=0.94, rate_func=m.rate_functions.ease_out_cubic, run_time=0.65))
        self.play(m.Create(forward[1], rate_func=m.rate_functions.ease_out_cubic, run_time=0.35))
        self.play(m.FadeIn(cards[2], scale=0.94, rate_func=m.rate_functions.ease_out_cubic, run_time=0.65))
        self.wait(1.5)
        self.play(m.Create(feedback, rate_func=m.rate_functions.ease_in_out_cubic, run_time=0.7),
                  m.FadeIn(feedback_label, rate_func=m.rate_functions.ease_out_cubic, run_time=0.5))
        self.wait(3.0)  # 关键结构：反馈回环
        self.play(m.FadeIn(note_bg, scale=0.96, rate_func=m.rate_functions.ease_out_cubic, run_time=0.4),
                  m.FadeIn(note, shift=m.UP * 0.12, rate_func=m.rate_functions.ease_out_cubic, run_time=0.5))
        self.wait(3.0)  # 关键结论


class PipelineSlide(MinimalSlideTemplate):
    """第 4 页：求解流水线（5 节点 4 连线线性流）"""
    index_prefix = "04"

    def construct(self):
        self.play(self.set_title_row(title="求解流水线", subtitle="Solver Pipeline", seperator=" · "))

        names = ["前处理", "网格生成", "迭代求解", "收敛评估", "后处理"]
        colors = [self.blue, self.blue, self.green, self.yellow, self.blue]
        boxes = m.VGroup()
        for i, (name, color) in enumerate(zip(names, colors)):
            body = m.RoundedRectangle(
                width=2.05, height=1.05, corner_radius=0.12,
                stroke_color=color, stroke_width=1.6,
                fill_color=color, fill_opacity=0.12,
            )
            number = m.Text(f"0{i + 1}", font_size=13, color=color).move_to(body).shift(m.UP * 0.31)
            text = m.Text(name, font_size=21).move_to(body).shift(m.DOWN * 0.12)
            boxes.add(m.VGroup(body, number, text))
        boxes.arrange(m.RIGHT, buff=0.55).shift(m.DOWN * 0.45)

        arrows = m.VGroup()
        for a, b, color in zip(boxes[:-1], boxes[1:], [self.blue, self.blue, self.green, self.yellow]):
            arrows.add(m.Arrow(
                start=a[0].get_edge_center(m.RIGHT), end=b[0].get_edge_center(m.LEFT),
                buff=0.1, color=color, stroke_width=2.0,
            ))
        feedback = m.CurvedArrow(
            start_point=boxes[3][0].get_edge_center(m.DOWN),
            end_point=boxes[2][0].get_edge_center(m.DOWN),
            angle=-m.PI / 2, color=self.yellow, stroke_width=2.0,
        )
        feedback_label = m.Text("未收敛反馈", font_size=15, color=self.yellow)
        feedback_label.move_to((boxes[2].get_center() + boxes[3].get_center()) / 2 + m.DOWN * 1.35)

        note_bg = m.RoundedRectangle(
            width=8.6, height=0.62, corner_radius=0.12,
            stroke_color=self.blue, stroke_width=0.8,
            fill_color=self.blue, fill_opacity=0.06,
        ).to_edge(m.DOWN, buff=0.45)
        note = m.Text("收敛进入后处理；未收敛则反馈至迭代求解", font_size=20).move_to(note_bg)

        self.play(*[m.FadeIn(b, scale=0.94, rate_func=m.rate_functions.ease_out_back, run_time=0.5) for b in boxes])
        self.wait(1.5)
        self.play(*[m.Create(a, rate_func=m.rate_functions.ease_out_cubic, run_time=0.4) for a in arrows])
        self.wait(1.5)
        self.play(m.Create(feedback, rate_func=m.rate_functions.ease_in_out_cubic, run_time=0.6),
                  m.FadeIn(feedback_label, rate_func=m.rate_functions.ease_out_cubic, run_time=0.4))
        self.wait(2.0)
        self.play(m.FadeIn(note_bg, rate_func=m.rate_functions.ease_out_cubic, run_time=0.4),
                  m.FadeIn(note, shift=m.UP * 0.12, rate_func=m.rate_functions.ease_out_cubic, run_time=0.5))
        self.wait(3.0)


class SummarySlide(MinimalIntroSlide):
    """第 5 页：结论"""
    title = "小结"
    subtitle = "残差判据 · 松弛策略 · 收敛闸门"

    def construct(self):
        self.play(self.fade_in_slide())
        takeaways = m.VGroup()
        for number, heading, caption, color in [
            ("01", "残差判据", "用容差定义收敛", self.blue),
            ("02", "松弛策略", "在速度与稳定间取舍", self.green),
            ("03", "收敛闸门", "未收敛则反馈修正", self.yellow),
        ]:
            bg = m.RoundedRectangle(
                width=3.45, height=0.95, corner_radius=0.12,
                stroke_color=color, stroke_width=1.5,
                fill_color=color, fill_opacity=0.12,
            )
            num = m.Text(number, font_size=16, color=color).move_to(bg).shift(m.LEFT * 1.32)
            title = m.Text(heading, font_size=22).move_to(bg).shift(m.UP * 0.18 + m.RIGHT * 0.18)
            sub = m.Text(caption, font_size=15, color=self.font_color_secondary).move_to(bg).shift(m.DOWN * 0.22 + m.RIGHT * 0.18)
            takeaways.add(m.VGroup(bg, num, title, sub))
        takeaways.arrange(m.RIGHT, buff=0.55).to_edge(m.DOWN, buff=0.85).set_z_index(10)
        self.play(*[m.FadeIn(card, shift=m.UP * 0.2, rate_func=m.rate_functions.ease_out_cubic, run_time=0.55)
                    for card in takeaways])
        self.wait(3.0)  # 结论页
