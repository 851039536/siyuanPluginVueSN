/**
 * 组件预览清单 — Dialog 分组数据
 *
 * 注 1：对话框是受控组件（`visible` 由调用方持有），预览框架只接管 `modelValue` ⇒ 示例统一静态给
 *      `visible: true`，快照即为「打开态」（与 ConfirmDialog 同一口径）。
 * 注 2：`slots` 工厂第二参是注入全局档位后的实际渲染 props，页脚 / 内容里的共享控件据此对齐档位。
 * 注 3：默认插槽 = **内容区**（标题栏与页脚另有插槽），故 `slotText` / `render` 承载的是内容区内容。
 * 注 4：沙箱把遮罩改为相对舞台定位，并把卡片最大高度限制在舞台内（见 styles/PreviewSection.scss），
 *      故「长内容」示例演示的是内容区内部滚动；真实调用处卡片上限为 80vh。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"

/** 页脚按钮组（多个示例共用）：按钮档位随容器档位 */
const footerButtons = (exampleProps: Record<string, any>): VNode[] => [
  h(Button, { variant: "ghost", size: exampleProps.size }, () => "取消"),
  h(Button, { variant: "primary", size: exampleProps.size }, () => "保存"),
]

export const dialogGroup: PreviewGroup = {
  id: "dialog",
  component: Dialog,
  name: "Dialog",
  summary: "对话框：受控显示 + 九档位置 + 四档尺寸，标题栏 / 内容区 / 页脚三段结构，六个插槽",
  importCode: "import Dialog from \"@/components/Dialog.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（标题 + 内容）",
      props: {
        visible: true,
        header: "编辑资料",
      },
      slotText: "内容区可放任意内容：表单、列表、详情…",
      code: `<Dialog v-model:visible="visible" header="编辑资料">
  内容区可放任意内容：表单、列表、详情…
</Dialog>`,
    },
    {
      title: "页脚按钮组（footer 插槽）",
      props: {
        visible: true,
        header: "保存修改",
      },
      slotText: "传了 footer（文本或插槽）才会渲染页脚。",
      slots: {
        footer: (_scope, exampleProps): VNode[] => footerButtons(exampleProps),
      },
      code: `<Dialog v-model:visible="visible" header="保存修改">
  <p>传了 footer（文本或插槽）才会渲染页脚。</p>
  <template #footer>
    <Button variant="ghost" @click="visible = false">取消</Button>
    <Button variant="primary" @click="save">保存</Button>
  </template>
</Dialog>`,
    },
    {
      title: "仅内容（show-header=false）",
      props: {
        visible: true,
        showHeader: false,
      },
      slotText: "关闭标题栏后连带不渲染关闭按钮：只能靠 Esc / 遮罩 / 插槽内自建按钮关闭。",
      code: `<!-- 关闭标题栏时，关闭按钮一并消失（Esc 与遮罩仍可关） -->
<Dialog v-model:visible="visible" :show-header="false">
  关闭标题栏后连带不渲染关闭按钮。
</Dialog>`,
    },
    {
      title: "位置 - 左上（position=\"topleft\"）",
      props: {
        visible: true,
        header: "位置九档",
        position: "topleft",
      },
      slotText: "position 支持 center / 四边 / 四角，共九档。",
      code: `<Dialog v-model:visible="visible" header="位置九档" position="topleft">
  position 支持 center / 四边 / 四角，共九档。
</Dialog>`,
    },
    {
      title: "位置 - 右下（position=\"bottomright\"）",
      props: {
        visible: true,
        header: "位置九档",
        position: "bottomright",
      },
      slotText: "模板类驱动，零 JS 定位。",
      code: `<Dialog v-model:visible="visible" header="位置九档" position="bottomright">
  模板类驱动，零 JS 定位。
</Dialog>`,
    },
    {
      title: "遮罩点关（dismissable-mask）",
      props: {
        visible: true,
        header: "遮罩点关",
        dismissableMask: true,
      },
      slotText: "默认 false（官方同）；开启后需「在遮罩上按下并抬起」才关闭，避免误关。",
      code: `<Dialog v-model:visible="visible" header="遮罩点关" dismissable-mask>
  默认 false（官方同）；开启后点遮罩可关。
</Dialog>`,
    },
    {
      title: "不显示关闭按钮（closable=false）",
      props: {
        visible: true,
        header: "必须明确选择",
        closable: false,
      },
      slotText: "仍有 Esc（默认开启）与遮罩（需显式开启）两条关闭路径。",
      code: `<Dialog v-model:visible="visible" header="必须明确选择" :closable="false">
  仍有 Esc 与遮罩两条关闭路径。
</Dialog>`,
    },
    {
      title: "非模态（modal=false）",
      props: {
        visible: true,
        header: "非模态对话框",
        modal: false,
      },
      slotText: "遮罩透明且不接管指针事件，页面其余部分仍可交互；遮罩点关随之失效。",
      code: `<!-- 非模态：遮罩不加深、不遮断页面交互（遮罩点关随之失效） -->
<Dialog v-model:visible="visible" header="非模态对话框" :modal="false">
  页面其余部分仍可交互。
</Dialog>`,
    },
    {
      title: "标题插槽（header，作用域 { class, headerId }）",
      props: {
        visible: true,
      },
      slots: {
        header: (scope): VNode => h(
          "div",
          {
            id: scope.headerId,
            class: [scope.class, "cp-demo-block"],
          },
          [
            h("span", null, "发布版本"),
            h("span", { class: "cp-demo-muted" }, "v3.0.0 · 2026-09-11"),
          ],
        ),
      },
      slotText: "替换标题内容时记得带上 scope.headerId，`aria-labelledby` 才能指到它。",
      code: `<Dialog v-model:visible="visible">
  <template #header="{ class: titleClass, headerId }">
    <div :id="headerId" :class="titleClass">
      <span>发布版本</span>
      <span class="muted">v3.0.0 · 2026-09-11</span>
    </div>
  </template>
  替换标题内容时记得带上 headerId。
</Dialog>`,
    },
    {
      title: "整块替换（container 插槽）",
      props: {
        visible: true,
      },
      slots: {
        container: (scope, exampleProps): VNode => h(
          "div",
          { class: "cp-demo-block" },
          [
            h("div", { class: "cp-demo-title" }, "自定义结构"),
            h("p", { class: "cp-demo-text" }, "标题栏 / 内容区 / 页脚整块由 container 插槽提供，关闭按钮需自己放。"),
            h("div", { class: "cp-demo-actions" }, [
              h(Button, {
                variant: "primary",
                size: exampleProps.size,
                onClick: scope.closeCallback,
              }, () => "关闭"),
            ]),
          ],
        ),
      },
      code: `<Dialog v-model:visible="visible">
  <template #container="{ closeCallback }">
    <div class="my-dialog">
      <h3>自定义结构</h3>
      <p>整块结构由 container 插槽提供。</p>
      <Button variant="primary" @click="closeCallback">关闭</Button>
    </div>
  </template>
</Dialog>`,
    },
    {
      title: "长内容内部滚动",
      props: {
        visible: true,
        header: "变更日志",
      },
      render: (): VNode[] => Array.from(
        { length: 14 },
        (_, index) => h("p", { class: "cp-demo-text" }, `第 ${index + 1} 行：内容超出卡片上限时在内容区内部滚动，标题栏与页脚保持固定。`),
      ),
      code: `<!-- 内容超出上限时只有内容区滚动：卡片 max-height 80vh，标题栏 / 页脚固定 -->
<Dialog v-model:visible="visible" header="变更日志">
  <p v-for="index in 14" :key="index">第 {{ index }} 行…</p>
</Dialog>`,
    },
    {
      title: "尺寸 - large",
      props: {
        visible: true,
        header: "尺寸档位",
        footer: "标题与内容字号、内边距、弹窗宽度同步变化。",
        size: "large",
      },
      slotText: "四档：xsmall / small（默认）/ medium / large。",
      code: `<Dialog
  v-model:visible="visible"
  header="尺寸档位"
  footer="标题与内容字号、内边距、弹窗宽度同步变化。"
  size="large"
>
  四档：xsmall / small（默认）/ medium / large。
</Dialog>`,
    },
  ],
}

export const dialogPreviewGroups: PreviewGroup[] = [dialogGroup]
