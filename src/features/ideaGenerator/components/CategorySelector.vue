<!-- 分类选择器：预设开发方向分类胶囊按钮组（单选） -->
<template>
  <div class="ig-cat">
    <!-- 区域标签："开发方向" -->
    <span class="ig-cat-label">{{ i18n.categoryLabel }}</span>
    <div class="ig-cat-list">
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="ig-cat-item"
        :class="{ 'ig-cat-item--active': cat.id === selectedId }"
        @click="handleSelect(cat.id)"
      >
        <IconWrapper
          :name="cat.icon"
          :size="14"
          className="ig-icon"
        />
        <!-- 分类名称 -->
        <span>{{ labelOf(cat) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue"
import type {
  IdeaCategory,
  IdeaGeneratorI18n,
} from "../types"
import { resolveI18nLabel } from "../utils"

interface Props {
  categories: IdeaCategory[]
  selectedId: string
  i18n: IdeaGeneratorI18n
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: "select", id: string): void }>()

function labelOf(cat: IdeaCategory): string {
  return resolveI18nLabel(props.i18n as Record<string, unknown>, cat.labelKey, cat.id)
}

function handleSelect(id: string): void {
  if (id === props.selectedId) return
  emit("select", id)
}
</script>

<style lang="scss">
@use '../styles/CategorySelector.scss';
@use '../styles/index.scss';
</style>
