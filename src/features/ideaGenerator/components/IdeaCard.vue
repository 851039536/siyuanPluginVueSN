<!-- 灵感卡片：标题 + 描述截断 + 展开/复制/细化操作 -->
<template>
  <div
    class="ig-card"
    :class="{ 'ig-card--expanded': expanded }"
  >
    <button
      type="button"
      class="ig-card-head"
      @click="emit('toggleExpand', idea.id)"
    >
      <!-- 灵感序号 -->
      <span class="ig-card-index">{{ String(index).padStart(2, "0") }}</span>
      <!-- 灵感标题 -->
      <h3 class="ig-card-title">{{ idea.title }}</h3>
    </button>
    <p
      class="ig-card-desc"
      :class="{ 'ig-card-desc--expanded': expanded }"
    >
      {{ idea.description }}
    </p>
    <div class="ig-card-actions">
      <button
        type="button"
        class="ig-card-btn"
        @click="emit('toggleExpand', idea.id)"
      >
        <IconWrapper
          :name="expanded ? 'chevronUp' : 'chevronDown'"
          :size="14"
          className="ig-icon"
        />
        <!-- 展开查看 / 收起详情 -->
        <span>{{ expanded ? i18n.collapse : i18n.expand }}</span>
      </button>
      <button
        type="button"
        class="ig-card-btn"
        @click="emit('copy', idea)"
      >
        <IconWrapper
          name="copy"
          :size="14"
          className="ig-icon"
        />
        <!-- 复制灵感 -->
        <span>{{ i18n.copy }}</span>
      </button>
      <button
        type="button"
        class="ig-card-btn ig-card-btn--primary"
        :disabled="isRefining"
        @click="emit('refine', idea)"
      >
        <IconWrapper
          name="sparkles"
          :size="14"
          className="ig-icon"
        />
        <!-- AI 细化 -->
        <span>{{ i18n.refine }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue"
import type {
  IdeaGeneratorI18n,
  IdeaItem,
} from "../types"

interface Props {
  idea: IdeaItem
  index: number
  expanded: boolean
  isRefining: boolean
  i18n: IdeaGeneratorI18n
}

defineProps<Props>()
const emit = defineEmits<{
  (e: "toggleExpand", id: string): void
  (e: "copy", idea: IdeaItem): void
  (e: "refine", idea: IdeaItem): void
}>()
</script>

<style lang="scss">
@use '../styles/IdeaCard.scss';
@use '../styles/index.scss';
</style>
