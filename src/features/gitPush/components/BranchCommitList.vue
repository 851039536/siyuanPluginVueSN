<!-- 分支与提交记录列表 -->
<template>
  <div class="bcl-panel">
    <div
      class="bcl-header"
      :class="{ expanded }"
      @click="toggleExpanded"
    >
      <Icon
        :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'"
        height="12"
      />
      <span class="bcl-title">COMMIT LOG</span>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm bcl-refresh-btn"
        :class="{ 'gp-spin': loading }"
        :disabled="loading"
        title="刷新提交日志"
        @click.stop="$emit('refreshCommitLog')"
      >
        <Icon icon="mdi:refresh" height="12" />
      </button>
      <span
        v-if="!loading && entries.length"
        class="bcl-count"
      >{{ entries.length }}</span>
    </div>

    <div
      v-if="expanded"
      class="bcl-body"
    >
      <!-- 搜索栏 -->
      <div class="bcl-search">
        <Icon
          icon="mdi:magnify"
          height="12"
          class="bcl-search-icon"
        />
        <input
          v-model="searchKeyword"
          class="bcl-search-input"
          placeholder="搜索提交信息..."
          @keyup.escape="searchKeyword = ''"
        />
        <input
          v-model="searchAuthor"
          class="bcl-search-input bcl-search-author"
          placeholder="作者..."
          @keyup.escape="searchAuthor = ''"
        />
        <button
          v-if="searchKeyword || searchAuthor"
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click.stop="searchKeyword = ''; searchAuthor = ''"
        >
        <Icon
          icon="mdi:close"
          height="12"
        />
        </button>
        <select
          v-model="displayCount"
          class="bcl-count-select"
          @change="onCountChange"
        >
          <option
            v-for="n in countOptions"
            :key="n"
            :value="n"
          >{{ n }}</option>
        </select>
      </div>

      <div
        v-if="loading"
        class="bcl-loading"
      >
        <Icon
          icon="mdi:loading"
          class="gp-spin"
          height="12"
        />
        <span>加载中...</span>
      </div>

      <div
        v-else-if="filteredEntries.length === 0"
        class="bcl-empty"
      >
        {{ (searchKeyword || searchAuthor) ? '无匹配结果' : '暂无提交记录' }}
      </div>

      <div
        v-else
        class="bcl-list"
      >
        <div
          v-for="entry in filteredEntries"
          :key="entry.hash"
          class="bcl-entry"
        >
          <span
            class="bcl-hash"
            :title="entry.hash"
          >{{ entry.hash }}</span>
          <span
            class="bcl-msg"
            :title="entry.message"
          >{{ entry.message }}</span>
          <span class="bcl-meta">
            <span class="bcl-author">{{ entry.author }}</span>
            <span
              class="bcl-date"
              :title="entry.date"
            >{{ entry.relativeDate }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommitLogEntry } from "../types"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
} from "vue"

const props = defineProps<{
  entries: CommitLogEntry[]
  loading: boolean
}>()

const emit = defineEmits<{
  reloadCommitLog: [count: number]
  refreshCommitLog: []
}>()

const COUNT_OPTIONS = [10, 20, 30, 50, 100]
const expanded = ref(false)
const searchKeyword = ref("")
const searchAuthor = ref("")
const displayCount = ref(30)

const countOptions = COUNT_OPTIONS

const filteredEntries = computed(() => {
  let list = props.entries
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter((e) => e.message.toLowerCase().includes(kw))
  }
  if (searchAuthor.value) {
    const au = searchAuthor.value.toLowerCase()
    list = list.filter((e) => e.author.toLowerCase().includes(au))
  }
  return list.slice(0, displayCount.value)
})

function toggleExpanded() {
  expanded.value = !expanded.value
}

function onCountChange() {
  emit("reloadCommitLog", displayCount.value)
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../styles/variables" as *;
@use "../styles/BranchCommitList.scss";
</style>
