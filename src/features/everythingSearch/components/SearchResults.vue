<template>
  <div class="vp-results">
    <!-- 加载状态 -->
    <div
      v-if="state.status === 'loading'"
      class="vp-results__loading"
    >
      <Loader />
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="state.status === 'error'"
      class="vp-empty"
    >
      <span class="vp-empty__emoji"><IconWrapper
        name="error"
        :size="32"
      /></span>
      <p class="vp-empty__msg">
        {{ state.errorMessage }}
      </p>
    </div>

    <!-- 空状态（未搜索） -->
    <div
      v-else-if="state.status === 'idle'"
      class="vp-empty"
    >
      <span class="vp-empty__emoji"><IconWrapper
        name="folder"
        :size="32"
      /></span>
      <p class="vp-empty__msg">
        <!-- 空状态提示："输入关键词自动搜索本地文件" -->
        {{ i18n.emptyHint }}
      </p>
      <p class="vp-empty__hint">
        <!-- 通配符提示："支持通配符：* 匹配任意字符 ? 匹配单个字符" -->
        {{ i18n.wildcardSupport }}<code>*</code> {{ i18n.wildcardAny }} &nbsp; <code>?</code> {{ i18n.wildcardSingle }}
      </p>
    </div>

    <!-- 无结果 -->
    <div
      v-else-if="state.status === 'empty'"
      class="vp-empty"
    >
      <span class="vp-empty__emoji"><IconWrapper
        name="search"
        :size="32"
      /></span>
      <p class="vp-empty__msg">
        <!-- 无结果提示："未找到匹配的文件" -->
        {{ i18n.noMatch }}
      </p>
    </div>

    <!-- 结果列表 -->
    <div
      v-else
      class="vp-results__list"
    >
      <div class="vp-results__header">
        <!-- 结果计数："找到 N 个结果" -->
        <span class="vp-results__count">{{ resultsCountText }}</span>
      </div>
      <div class="vp-results__scroll">
        <ResultItem
          v-for="item in state.results"
          :key="`${item.name}-${item.path}`"
          :item="item"
          :i18n="i18n"
          @open="emit('itemOpen', $event)"
          @show-in-folder="emit('itemShowInFolder', $event)"
          @copy-path="emit('itemCopyPath', $event)"
          @delete="emit('itemDelete', $event)"
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
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "itemOpen", item: EverythingSearchResult): void
  (e: "itemShowInFolder", item: EverythingSearchResult): void
  (e: "itemCopyPath", item: EverythingSearchResult): void
  (e: "itemDelete", item: EverythingSearchResult): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 结果计数文案（替换 {count} 占位符） */
const resultsCountText = computed(() =>
  props.i18n.resultsCount.replace("{count}", String(props.state.results.length)),
)
</script>

<style scoped lang="scss">
@use "../styles/SearchResults.scss";
</style>
