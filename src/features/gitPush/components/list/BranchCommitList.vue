<!-- 分支与提交记录列表 -->
<template>
  <div class="bcl-panel">
    <!-- 搜索栏：搜索 + 作者 + 条数 + 刷新 -->
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
      <button
        v-if="searchKeyword"
        class="vp-btn vp-btn--ghost vp-btn--sm"
        @click.stop="searchKeyword = ''"
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
        >{{ n === "all" ? i18n.logFilterAll : n }}</option>
      </select>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm bcl-refresh-btn"
        :disabled="loading"
        title="刷新提交日志"
        @click.stop="$emit('refreshCommitLog')"
      >
        <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" height="12" :class="{ 'gp-spin': loading }" />
      </button>
    </div>

    <!-- 加载中提示 -->
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

    <!-- 空状态 -->
    <div
      v-else-if="filteredEntries.length === 0"
      class="bcl-empty"
    >
      {{ searchKeyword ? '无匹配结果' : '暂无提交记录' }}
    </div>

    <!-- 提交记录列表 -->
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
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm bcl-fix-btn"
            :title="i18n.ruleFixOpen"
            @click.stop="$emit('fixCommit', entry)"
          >
            <Icon
              icon="mdi:pencil-outline"
              height="12"
            />
          </button>
          <span
            class="bcl-date"
            :title="entry.date"
          >{{ entry.relativeDate }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommitLogEntry } from "../../types"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
} from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  entries: CommitLogEntry[]
  loading: boolean
}>()

const emit = defineEmits<{
  reloadCommitLog: [count: number | "all"]
  refreshCommitLog: []
  fixCommit: [entry: CommitLogEntry]
}>()

const countOptions = [200, 300, 500, 1000, 2000, "all"] as const
const searchKeyword = ref("")
const displayCount = ref<number | "all">(200)

const filteredEntries = computed(() => {
  let list = props.entries
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter((e) => e.message.toLowerCase().includes(kw))
  }
  return displayCount.value === "all" ? list : list.slice(0, displayCount.value)
})

function onCountChange() {
  emit("reloadCommitLog", displayCount.value)
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/BranchCommitList.scss";
</style>
