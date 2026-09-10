<!-- 空状态引导：三步操作说明 -->
<template>
  <div class="empty-state">
    <IconWrapper
      name="sparkles"
      :size="48"
      class="empty-icon"
    />
    <p class="empty-title">
      <!-- 空状态标题："AI 内容编辑助手" -->
      {{ i18n.emptyTitle }}
    </p>
    <div class="empty-steps">
      <div class="empty-step">
        <span class="step-num">1</span>
        <!-- 第一步说明："点击下方「选择文档」或「选择块」" -->
        <span>{{ i18n.emptyStep1 }}</span>
      </div>
      <div class="empty-step">
        <span class="step-num">2</span>
        <!-- 第二步说明："选择 AI 快捷操作或输入自定义指令" -->
        <span>{{ i18n.emptyStep2 }}</span>
      </div>
      <div class="empty-step">
        <span class="step-num">3</span>
        <!-- 第三步说明："预览结果后应用到文档" -->
        <span>{{ i18n.emptyStep3 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  /** 国际化文案 */
  i18n: Record<string, string>
}>()
</script>

<style scoped lang="scss">
@use "../styles/ContentAreaEmpty.scss" as *;
@use "../styles/index.scss" as *;
</style>
