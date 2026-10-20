<!-- 弹窗标题栏：标题 + 独立窗口 / 关闭两个图标按钮（按钮统一走共享 Button） -->
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
      <!-- 在独立窗口打开（浮动窗口内隐藏；overlay 弹窗与主窗口页签均显示）
           ⚠️ 图标是 plugin.addIcons 注册的 `#iconFloatingWindow`，不在 IconKey 集合内，故走默认插槽放内联 svg -->
      <Button
        v-if="!isFloating"
        class="vp-header__float"
        variant="ghost"
        text
        rounded
        size="xsmall"
        :title="i18n.openFloatingWindow"
        :aria-label="i18n.openFloatingWindow"
        @click="emit('openFloating')"
      >
        <svg
          class="vp-header__float-icon"
          aria-hidden="true"
        ><use xlink:href="#iconFloatingWindow" /></svg>
      </Button>
      <!-- 关闭按钮（仅 overlay 弹窗显示；tab 页签由思源管理关闭）（aria："关闭对话框"） -->
      <Button
        v-if="mode === 'overlay'"
        class="vp-header__close"
        variant="ghost"
        text
        rounded
        size="xsmall"
        icon="close"
        :title="i18n.closeDialog"
        :aria-label="i18n.closeDialog"
        @click="handleClose"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

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
