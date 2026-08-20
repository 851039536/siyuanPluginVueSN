<template>
  <div class="vp-header">
    <div class="vp-title">
      <span
        class="vp-title__icon"
        aria-hidden="true"
      >⌘</span>
      <!-- 弹窗标题："Everything搜索" -->
      <span class="vp-title__text">{{ i18n.title }}</span>
    </div>
    <div class="vp-header__actions">
      <!-- 在独立窗口打开（浮动窗口内隐藏；overlay 弹窗与主窗口页签均显示） -->
      <button
        v-if="!isFloating"
        class="vp-header__float"
        :title="i18n.openFloatingWindow"
        :aria-label="i18n.openFloatingWindow"
        @click="emit('openFloating')"
      >
        <svg
          width="12"
          height="12"
        ><use xlink:href="#iconFloatingWindow" /></svg>
      </button>
      <!-- 关闭按钮（仅 overlay 弹窗显示；tab 页签由思源管理关闭）（aria："关闭对话框"） -->
      <button
        v-if="mode === 'overlay'"
        class="vp-header__close"
        :aria-label="i18n.closeDialog"
        @click="handleClose"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
  /** 承载模式：overlay = 弹窗；tab = 独立窗口页签 */
  mode?: "overlay" | "tab"
  /** 是否运行在独立浮动窗口中（浮动窗口内隐藏"在独立窗口打开"按钮） */
  isFloating?: boolean
}

interface Emits {
  (e: "close"): void
  (e: "openFloating"): void
}

withDefaults(defineProps<Props>(), {
  mode: "overlay",
  isFloating: false,
})

const emit = defineEmits<Emits>()

/** 处理关闭 */
const handleClose = () => {
  emit("close")
}
</script>

<style scoped lang="scss">
@use "../styles/DialogHeader.scss";
</style>
