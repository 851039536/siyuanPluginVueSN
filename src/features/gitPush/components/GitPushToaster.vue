<!--
  gitPush 全局消息提示宿主（插件侧适配）

  消费 features/gitPush/notify 的队列，用共享 Toast 组件渲染；
  队列以 notify 为准，Toast 的关闭/到期只负责回写「移除」。
  挂载点在 gitPush/index.vue（Dock 面板与独立窗口共用同一根组件）。
-->
<script setup lang="ts">
import { computed } from "vue"
import Toast, { type ToastMessageOptionsPublic } from "@/components/Toast.vue"
import { dismissMessage, notifyItems } from "../notify"

/** 业务类型 → Toast 语义类型（Toast 用 warn，业务侧习惯 warning） */
const SEVERITY_MAP = {
  info: "info",
  success: "success",
  warning: "warn",
  error: "error",
} as const

const messages = computed<ToastMessageOptionsPublic[]>(() =>
  notifyItems.value.map(item => ({
    id: item.id,
    severity: SEVERITY_MAP[item.type],
    summary: item.message,
    life: item.timeout > 0 ? item.timeout : undefined,
    closable: true,
    action: item.action
      ? { label: item.action.label, onAction: item.action.onClick }
      : undefined,
  })),
)

/** Toast 派发的剩余队列 → 反向同步到 notify 队列 */
function handleUpdate(next: ToastMessageOptionsPublic[]): void {
  const keep = new Set(next.map(item => item.id))
  for (const item of notifyItems.value) {
    if (!keep.has(item.id)) dismissMessage(item.id)
  }
}
</script>

<template>
  <Toast
    :messages="messages"
    position="bottom-right"
    size="small"
    @update:messages="handleUpdate"
  />
</template>
