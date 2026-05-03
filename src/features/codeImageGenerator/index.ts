/**
 * 代码图片生成器功能模块
 */
import { Plugin } from "siyuan";
import { createApp, h } from "vue";
import CodeImageGeneratorPanel from "./index.vue";

/**
 * 注册代码图片生成器功能
 */
export function registerCodeImageGenerator(plugin: Plugin) {
  addCodeImageGeneratorDock(plugin);
}

/**
 * 添加右侧边栏 Dock
 */
function addCodeImageGeneratorDock(plugin: Plugin) {
  const self = { plugin };

  plugin.addDock({
    config: {
      position: "RightBottom",
      size: { width: 600, height: 0 },
      icon: "iconCode",
      title: plugin.i18n.codeImageGenerator || "图片生成",
      show: false,
    },
    data: {},
    type: "code-image-generator-dock",
    init: (dock: any) => {
      const container = document.createElement("div");
      container.style.height = "100%";
      container.style.overflow = "hidden";

      const app = createApp({
        setup() {
          return () =>
            h(CodeImageGeneratorPanel, {
              i18n: self.plugin.i18n,
              plugin: self.plugin,
            });
        },
      });

      app.mount(container);
      dock.element?.appendChild(container);

      dock.__app = app;
      dock.__container = container;
    },
  });
}

export * from "./types";
