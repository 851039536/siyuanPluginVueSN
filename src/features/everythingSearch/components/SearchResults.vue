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
          v-for="item in state.results"
          :key="`${item.name}-${item.path}`"
          :item="item"
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

<style scoped lang="scss">
@use "../styles/SearchResults.scss";
</style>
