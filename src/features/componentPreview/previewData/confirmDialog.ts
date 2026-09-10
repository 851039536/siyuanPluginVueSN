/**
 * 组件预览清单 — ConfirmDialog 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、code（对应可复制模板）
 */
import type { PreviewGroup } from "../types"
import ConfirmDialog from "@/components/ConfirmDialog.vue"

export const confirmDialogGroup: PreviewGroup = {
  id: "confirm-dialog",
  component: ConfirmDialog,
  name: "ConfirmDialog",
  summary: "确认对话框：标题 / 多行消息 / 危险配色 / 尺寸档位 / 自定义消息插槽",
  importCode: "import ConfirmDialog from \"@/components/ConfirmDialog.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础确认",
      props: {
        visible: true,
        title: "保存修改",
        message: "确定要保存当前修改吗？",
        danger: false,
        confirmText: "保存",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  title="保存修改"
  message="确定要保存当前修改吗？"
  :danger="false"
  confirm-text="保存"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "危险操作（默认危险配色）",
      props: {
        visible: true,
        title: "删除快照",
        message: "删除后不可恢复，确定继续吗？",
        confirmText: "删除",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  title="删除快照"
  message="删除后不可恢复，确定继续吗？"
  confirm-text="删除"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "多行消息",
      props: {
        visible: true,
        title: "恢复快照",
        message: "确定要恢复此快照吗？\n当前数据将被覆盖。",
        confirmText: "确认恢复",
      },
      code: `<ConfirmDialog
  v-model:visible="visible"
  title="恢复快照"
  message="确定要恢复此快照吗？\\n当前数据将被覆盖。"
  confirm-text="确认恢复"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "自定义消息插槽",
      props: {
        visible: true,
        title: "恢复快照",
      },
      slotText: "快照：2026-09-10 21:30 · 128 个文件",
      code: `<ConfirmDialog
  v-model:visible="visible"
  title="恢复快照"
  confirm-text="确认恢复"
  @confirm="handleConfirm"
>
  快照：2026-09-10 21:30 · 128 个文件
</ConfirmDialog>`,
    },
  ],
}

export const confirmDialogPreviewGroups: PreviewGroup[] = [confirmDialogGroup]
