<!-- 联网搜索结果可折叠区块 -->
<template>
  <div
    v-if="searchStatus || searchResults.length > 0"
    class="search-results-section"
  >
    <button
      class="search-results-toggle"
      @click="showPanel = !showPanel"
    >
      <svg
        width="12"
        height="12"
        class="search-chevron"
        :class="{ expanded: showPanel }"
      >
        <use xlink:href="#iconRight"></use>
      </svg>
      <svg
        width="14"
        height="14"
      ><use xlink:href="#iconSearch"></use></svg>
      <span>搜索来源</span>
      <span class="search-status-text">{{ searchStatus }}</span>
    </button>
    <div
      v-if="showPanel && searchResults.length > 0"
      class="search-results-body"
    >
      <div
        v-for="(result, idx) in searchResults"
        :key="idx"
        class="search-result-item"
      >
        <div class="search-result-header">
          <span class="search-result-index">{{ idx + 1 }}.</span>
          <a
            :href="result.url"
            class="search-result-link"
            target="_blank"
            :title="result.url"
          >{{ result.title || result.url }}</a>
        </div>
        <div
          v-if="result.content"
          class="search-result-content"
        >{{ result.content }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import type { SearchResult } from "@/types/ai"

defineProps<{
  searchResults: SearchResult[]
  searchStatus?: string
}>()

const showPanel = ref(true)
</script>

<style scoped lang="scss">
@use "../styles/SearchResultsSection.scss" as *;
@use "../styles/index.scss" as *;
</style>
