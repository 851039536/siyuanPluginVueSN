<template>
  <div class="vp-results">
    <!-- 加载状态 -->
    <div v-if="state.status === 'loading'" class="vp-results__loading">
      <Loader />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="state.status === 'error'" class="vp-empty">
      <span class="vp-empty__emoji"><IconWrapper name="error" :size="32" /></span>
      <p class="vp-empty__msg">{{ state.errorMessage }}</p>
    </div>

    <!-- 空状态（未搜索） -->
    <div v-else-if="state.status === 'idle'" class="vp-empty">
      <span class="vp-empty__emoji"><IconWrapper name="folder" :size="32" /></span>
      <p class="vp-empty__msg">{{ emptyHintText }}</p>
      <p class="vp-empty__hint">
        支持通配符：<code>*</code> 匹配任意字符 &nbsp; <code>?</code> 匹配单个字符
      </p>
    </div>

    <!-- 无结果 -->
    <div v-else-if="state.status === 'empty'" class="vp-empty">
      <span class="vp-empty__emoji"><IconWrapper name="search" :size="32" /></span>
      <p class="vp-empty__msg">未找到匹配的文件</p>
    </div>

    <!-- 结果列表 -->
    <div v-else class="vp-results__list">
      <div class="vp-results__header">
        <span class="vp-results__count">找到 {{ state.results.length }} 个结果</span>
      </div>
      <div class="vp-results__scroll">
        <ResultItem
          v-for="(item, index) in state.results"
          :key="`${item.name}-${item.path}-${index}`"
          :item="item"
          @click="handleItemClick"
          @dbl-click="handleItemDblClick"
          @open="handleItemOpen"
          @show-in-folder="handleItemShowInFolder"
          @copy-path="handleItemCopyPath"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  EverythingSearchResult,
  SearchState,
} from "../types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import ResultItem from "./ResultItem.vue"

interface Props {
  /** 搜索状态 */
  state: SearchState
  /** 是否启用自动搜索 */
  autoSearch?: boolean
}

interface Emits {
  (e: "itemClick", item: EverythingSearchResult): void
  (e: "itemDblClick", item: EverythingSearchResult): void
  (e: "itemOpen", item: EverythingSearchResult): void
  (e: "itemShowInFolder", item: EverythingSearchResult): void
  (e: "itemCopyPath", item: EverythingSearchResult): void
}

const props = withDefaults(defineProps<Props>(), {
  autoSearch: true,
})

const emit = defineEmits<Emits>()

/** 空状态提示文本 */
const emptyHintText = computed(() => {
  return props.autoSearch
    ? "输入关键词自动搜索本地文件"
    : "输入关键词点击搜索按钮搜索本地文件"
})

/** 处理项目点击 */
const handleItemClick = (item: EverythingSearchResult) => {
  emit("itemClick", item)
}

/** 处理项目双击 */
const handleItemDblClick = (item: EverythingSearchResult) => {
  emit("itemDblClick", item)
}

/** 处理项目打开 */
const handleItemOpen = (item: EverythingSearchResult) => {
  emit("itemOpen", item)
}

/** 处理在文件夹中显示 */
const handleItemShowInFolder = (item: EverythingSearchResult) => {
  emit("itemShowInFolder", item)
}

/** 处理复制路径 */
const handleItemCopyPath = (item: EverythingSearchResult) => {
  emit("itemCopyPath", item)
}
</script>

<style lang="scss">
@use "@/variables" as *;

$vp-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

.vp-results {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &__loading {
    flex: 1;
    position: relative;
  }

  &__list {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__header {
    padding: 4px 16px;
    background: var(--b3-theme-surface-light);
    border-bottom: 1px solid var(--b3-border-color);
  }

  &__count {
    font-size: 11px;
    font-family: $font-body;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }

  &__scroll {
    flex: 1;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: $brand-light-gray;
      border-radius: 3px;

      &:hover {
        background: $brand-mid-gray;
      }
    }
  }
}

// 空/错误状态
.vp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;

  &__emoji {
    font-size: 32px;
    margin-bottom: 8px;
  }

  &__msg {
    font-size: 13px;
    font-family: $font-body;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }

  &__hint {
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    opacity: 0.35;
    margin-top: 8px;

    code {
      font-family: "JetBrains Mono", "Consolas", monospace;
      padding: 1px 4px;
      background: var(--b3-theme-surface);
      border: 1px solid var(--b3-border-color);
      border-radius: 2px;
      font-size: 10px;
      opacity: 0.7;
    }
  }
}
</style>
