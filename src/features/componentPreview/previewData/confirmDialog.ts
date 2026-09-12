/**
 * 组件预览清单 — ConfirmDialog 分组数据
 *
 * 注 1：对话框是受控组件（`visible` 由调用方持有），预览框架只接管 `modelValue` ⇒ 示例统一静态给
 *      `visible: true`，快照即为「打开态」。
 * 注 2：`slots` 的工厂第二参是注入全局档位后的实际渲染 props，`container` / `message` 插槽内的共享控件据此对齐档位。
 * 注 3：命名对齐官方 `ConfirmationOptions`（header / message / acceptLabel / rejectLabel），
 *      但驱动方式为受控（官方靠 `useConfirm().require()` 命令式服务）。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"

export const confirmDialogGroup: PreviewGroup = {
  id: "confirm-dialog",
  component: ConfirmDialog,
  name: "ConfirmDialog",
  summary: "确认对话框：受控显示 + 九档位置，标题 / 消息 / 图标 / 确认按钮配色与加载态，官方五个插槽",
  importCode: "import ConfirmDialog from \"@/components/ConfirmDialog.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础确认",
      props: {
        visible: true,
        header: "保存修改",
        message: "确定要保存当前修改吗？",
        acceptSeverity: "primary",
        acceptLabel: "保存",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  header="保存修改"
  message="确定要保存当前修改吗？"
  accept-severity="primary"
  accept-label="保存"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "危险操作（默认危险配色）",
      props: {
        visible: true,
        header: "删除快照",
        message: "删除后不可恢复，确定继续吗？",
        acceptLabel: "删除",
      },
      code: `<!-- accept-severity 默认 danger，删除/覆盖等不可撤销操作无需显式传 -->
<ConfirmDialog
  v-model:visible="visible"
  header="删除快照"
  message="删除后不可恢复，确定继续吗？"
  accept-label="删除"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "多行消息（\\n 拆行）",
      props: {
        visible: true,
        header: "恢复快照",
        message: "确定要恢复此快照吗？\n当前数据将被覆盖。",
        acceptLabel: "确认恢复",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  header="恢复快照"
  message="确定要恢复此快照吗？\\n当前数据将被覆盖。"
  accept-label="确认恢复"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "标题图标",
      props: {
        visible: true,
        header: "退出未保存的编辑？",
        message: "未保存的内容会丢失。",
        icon: "warning",
        acceptLabel: "退出",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  header="退出未保存的编辑？"
  message="未保存的内容会丢失。"
  icon="warning"
  accept-label="退出"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "位置 - 左上（position=\"topleft\"）",
      props: {
        visible: true,
        header: "位置九档",
        message: "position 支持 center / 四边 / 四角。",
        acceptSeverity: "primary",
        position: "topleft",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  header="位置九档"
  message="position 支持 center / 四边 / 四角。"
  accept-severity="primary"
  position="topleft"
/>`,
    },
    {
      title: "位置 - 右下（position=\"bottomright\"）",
      props: {
        visible: true,
        header: "位置九档",
        message: "模板类驱动，零 JS 定位。",
        acceptSeverity: "primary",
        position: "bottomright",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  header="位置九档"
  position="bottomright"
  accept-severity="primary"
/>`,
    },
    {
      title: "右上角关闭按钮（closable）",
      props: {
        visible: true,
        header: "可关闭的确认框",
        message: "closable 默认关闭（确认框已有「取消」），需要时显式打开。",
        closable: true,
        acceptSeverity: "primary",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  header="可关闭的确认框"
  message="需要时显式打开右上角关闭按钮。"
  closable
  accept-severity="primary"
/>`,
    },
    {
      title: "关闭遮罩点关（dismissable-mask=false）",
      props: {
        visible: true,
        header: "必须明确选择",
        message: "遮罩点关已关闭，只能点按钮或按 Esc。",
        dismissableMask: false,
        acceptSeverity: "primary",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  header="必须明确选择"
  message="遮罩点关已关闭，只能点按钮或按 Esc。"
  :dismissable-mask="false"
  accept-severity="primary"
/>`,
    },
    {
      title: "消息插槽（message，作用域 { message, icon }）",
      props: {
        visible: true,
        header: "恢复快照",
        icon: "folderOpen",
      },
      slots: {
        message: (scope: Record<string, any>): VNode => h("div", { class: "cp-demo-block" }, [
          h("p", { class: "cp-demo-text" }, String(scope.message || "快照：2026-09-11 09:12 · 128 个文件")),
          h("p", { class: "cp-demo-muted" }, "可用 scope.message / scope.icon 组合任意排版。"),
        ]),
      },
      code: `<ConfirmDialog v-model:visible="visible" header="恢复快照" icon="folderOpen">
  <template #message="{ message }">
    <p>{{ message }}</p>
    <p class="muted">快照：2026-09-11 09:12 · 128 个文件</p>
  </template>
</ConfirmDialog>`,
    },
    {
      title: "整块替换（container 插槽）",
      props: {
        visible: true,
        header: "自定义确认框",
        message: "整块内容由 container 插槽提供。",
        acceptLabel: "继续",
      },
      slots: {
        container: (scope: Record<string, any>, exampleProps: Record<string, any>): VNode => h(
          "div",
          { class: "cp-demo-block" },
          [
            h("div", { class: "cp-demo-title" }, String(scope.header ?? "")),
            h("p", { class: "cp-demo-text" }, String(scope.message ?? "")),
            h("div", { class: "cp-demo-actions" }, [
              h(Button, {
                size: exampleProps.size,
                variant: "ghost",
                onClick: scope.rejectCallback,
              }, String(scope.rejectLabel ?? "取消")),
              h(Button, {
                size: exampleProps.size,
                variant: "primary",
                onClick: scope.acceptCallback,
              }, String(scope.acceptLabel ?? "确定")),
            ]),
          ],
        ),
      },
      code: `<ConfirmDialog v-model:visible="visible" header="自定义确认框" message="…">
  <template #container="{ header, message, acceptLabel, rejectLabel, acceptCallback, rejectCallback }">
    <div class="my-confirm">
      <h3>{{ header }}</h3>
      <p>{{ message }}</p>
      <div class="my-confirm__actions">
        <Button variant="ghost" @click="rejectCallback">{{ rejectLabel }}</Button>
        <Button variant="primary" @click="acceptCallback">{{ acceptLabel }}</Button>
      </div>
    </div>
  </template>
</ConfirmDialog>`,
    },
  ],
}

export const confirmDialogPreviewGroups: PreviewGroup[] = [confirmDialogGroup]
