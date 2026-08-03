<!-- 联网搜索结果可折叠区块 -->
<template>
  <CollapsibleSection
    v-if="searchStatus || searchResults.length > 0"
    title="搜索来源"
    icon="#iconSearch"
    v-model:open="showPanel"
  >
    <template #headerRight>
      <span class="search-status-text">{{ searchStatus }}</span>
    </template>
    <div
      v-if="searchResults.length > 0"
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
  </CollapsibleSection>
</template>

<script setup lang="ts">
import { ref } from "vue"
import type { SearchResult } from "@/types/ai"
import CollapsibleSection from "./CollapsibleSection.vue"

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
