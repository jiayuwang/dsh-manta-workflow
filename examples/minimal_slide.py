from manta.slide_templates.minimal.minimal_intro_slide import MinimalIntroSlide


class MyMinimalExampleSlide(MinimalIntroSlide):
    title = "Manta Workflow"
    subtitle = "科学视频与幻灯片制作 · 视觉审核管线验证"

    def construct(self):
        self.play(self.fade_in_slide())
        self.wait(2)


if __name__ == '__main__':
    MyMinimalExampleSlide.show_last_frame()
