<!-- 生成结果操作栏：停止/应用/插入子文档/撤回/复制/直接审查/清空对话/清除 -->
<template>
  <div class="result-actions">
    <!-- 按钮："停止"（title："停止生成"） -->
    <Button
      v-if="isGenerating"
      variant="danger"
      size="xsmall"
      icon="close"
      :title="i18n.stopGenerating"
      @click="$emit('stop')"
    >
      {{ i18n.stopLabel }}
    </Button>
    <!-- 按钮："应用"（title："应用编辑"） -->
    <Button
      variant="primary"
      size="xsmall"
      icon="check"
      :disabled="!canApply"
      :loading="isApplying"
      :title="i18n.applyEditTitle"
      @click="$emit('applyEdit')"
    >
      {{ i18n.applyLabel }}
    </Button>
    <!-- 纯图标按钮：插入为子文档（ariaLabel："插入为子文档"） -->
    <Button
      variant="ghost"
      size="xsmall"
      icon="plus"
      :disabled="!canInsertSubDoc"
      :loading="isInsertingSubDoc"
      :aria-label="i18n.insertSubDocTitle"
      @click="$emit('insertSubdoc')"
    />
    <!-- 纯图标按钮：撤回编辑（ariaLabel："撤回编辑"） -->
    <Button
      v-if="canUndo"
      variant="ghost"
      size="xsmall"
      icon="refreshLeft"
      :disabled="isUndoing"
      :loading="isUndoing"
      :aria-label="i18n.undoEditTitle"
      @click="$emit('undoEdit')"
    />
    <!-- 纯图标按钮：复制（ariaLabel："复制"） -->
    <Button
      variant="ghost"
      size="xsmall"
      icon="copy"
      :aria-label="i18n.copyTitle"
      @click="$emit('copy')"
    />
    <!-- 直接审查：绕过 enableReview 开关，随时对当前内容发起交叉审核 -->
    <Button
      v-if="showDirectReview"
      variant="primary"
      size="xsmall"
      icon="sparkles"
      :title="i18n.directReviewTitle"
      @click="$emit('directReview')"
    >
      {{ i18n.directReview }}
    </Button>
    <!-- 按钮：清空对话历史（title："清空对话历史（N 轮）"） -->
    <Button
      v-if="!isGenerating && conversationCount > 0"
      variant="ghost"
      size="xsmall"
      icon="refresh"
      :title="i18n.clearConversationTitle.replace('{n}', String(conversationCount))"
      @click="$emit('clearConversation')"
    >
      <span class="conv-count">{{ conversationCount }}</span>
    </Button>
    <!-- 纯图标按钮：清除（ariaLabel："清除"） -->
    <Button
      variant="ghost"
      size="xsmall"
      icon="delete"
      :aria-label="i18n.clearTitle"
      @click="$emit('clear')"
    />
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

defineProps<{
  /** 国际化文案 */
  i18n: Record<string, string>
  /** 生成中：显示"停止"按钮并隐藏部分操作 */
  isGenerating: boolean
  /** 应用编辑进行中 */
  isApplying: boolean
  /** 撤回编辑进行中 */
  isUndoing: boolean
  /** 插入子文档进行中 */
  isInsertingSubDoc: boolean
  /** 是否可应用编辑 */
  canApply: boolean
  /** 是否可插入子文档 */
  canInsertSubDoc: boolean
  /** 是否可撤回编辑（存在可撤回历史） */
  canUndo: boolean
  /** 是否显示"直接审查"按钮（有生成内容且未在生成/审核中） */
  showDirectReview: boolean
  /** 对话轮次数（父组件已按 2 条/轮折算） */
  conversationCount: number
}>()

defineEmits<{
  (e: "stop"): void
  (e: "applyEdit"): void
  (e: "insertSubdoc"): void
  (e: "undoEdit"): void
  (e: "copy"): void
  (e: "clear"): void
  (e: "directReview"): void
  (e: "clearConversation"): void
}>()
</script>
