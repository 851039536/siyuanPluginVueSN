<!-- 速记恢复 — 弹窗卡死/位置异常时一键复位为居中展开态 -->
<template>
  <div class="quick-note-reset">
    <!-- 标题行：工具图标 + 名称 -->
    <div class="qnr-header">
      <Icon
        icon="ph:arrow-counter-clockwise"
        :size="14"
      />
      <span class="qnr-title">{{ i18n.quickNoteReset?.title }}</span>
    </div>

    <!-- 说明卡：描述功能用途 -->
    <div class="qnr-desc">
      {{ i18n.quickNoteReset?.description }}
    </div>

    <!-- 操作区：恢复按钮（点击后短暂切换为"已恢复"反馈） -->
    <div class="qnr-actions">
      <button
        class="qnr-btn"
        :class="{ 'qnr-btn--done': done }"
        @click="handleReset"
      >
        <Icon
          :icon="done ? 'mdi:check' : 'ph:arrow-counter-clockwise'"
          :size="14"
        />
        {{ done ? i18n.quickNoteReset?.done : i18n.quickNoteReset?.reset }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记恢复工具 - 主组件
 * 派发 resetQuickNote 事件复位速记弹窗为居中展开态，带"已恢复"反馈
 */
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import { emitCustomEvent } from "@/utils/eventBus"

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

defineProps<Props>()

/** "已恢复"反馈状态（2 秒后复原为默认按钮态） */
const done = ref(false)

/** 一键恢复：派发事件供 App.vue 调度，随后短暂展示成功反馈 */
const handleReset = () => {
  emitCustomEvent("resetQuickNote")
  done.value = true
  setTimeout(() => {
    done.value = false
  }, 2000)
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
