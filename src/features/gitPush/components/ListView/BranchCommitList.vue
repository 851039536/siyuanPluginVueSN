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
      <!-- 搜索输入框（placeholder："搜索提交信息..."） -->
      <input
        v-model="searchKeyword"
        class="bcl-search-input"
        :placeholder="i18n.commitSearchPlaceholder"
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
      <!-- 显示条数下拉（"全部" / 数字） -->
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
      <!-- "加载中..." -->
      <span>{{ i18n.loading }}</span>
    </div>

    <!-- 空状态（"暂无提交记录" / 有搜索词时"无匹配结果"） -->
    <div
      v-else-if="filteredEntries.length === 0"
      class="bcl-empty"
    >
      {{ searchKeyword ? i18n.commitListNoMatch : i18n.commitListEmpty }}
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
        <!-- 该提交已命中的 Tag 徽标（tag→hash 映射；徽标内附已推送远程名，未推送时提示） -->
        <span
          v-if="entryTags(entry.hash).length"
          class="bcl-tags"
          :title="entryTags(entry.hash).join(', ')"
        >
          <span
            v-for="tagName in entryTags(entry.hash).slice(0, 2)"
            :key="tagName"
            class="bcl-tag-chip"
            :title="tagPushTitle(tagName)"
          >
            <Icon
              icon="mdi:tag-outline"
              height="10"
            />
            {{ tagName }}
            <!-- 已推送的远程名（远程数据缺失时不显示，避免误标） -->
            <span
              v-if="tagRemotes(tagName).length"
              class="bcl-tag-chip-remotes"
            >{{ tagRemotes(tagName).join(" ") }}</span>
            <span
              v-else-if="hasRemoteData"
              class="bcl-tag-chip-unpushed"
            >{{ i18n.tagNotPushed }}</span>
          </span>
          <span
            v-if="entryTags(entry.hash).length > 2"
            class="bcl-tag-more"
          >+{{ entryTags(entry.hash).length - 2 }}</span>
        </span>
        <span
          class="bcl-msg bcl-msg--clickable"
          :title="i18n.ruleFixOpen + ': ' + entry.message"
          @click.stop="$emit('fixCommit', entry)"
        >{{ entry.message }}</span>
        <!-- 查看提交文件按钮（hover 显示；点击弹出该提交修改的文件清单） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm bcl-files-btn"
          :title="i18n.commitFilesOpen"
          @click.stop="$emit('viewFiles', entry)"
        >
          <Icon icon="mdi:file-document-outline" height="12" />
        </button>
        <!-- 打 Tag 按钮（hover 显示） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm bcl-tag-btn"
          :title="i18n.createTag"
          @click.stop="$emit('addTag', entry)"
        >
          <Icon
            icon="mdi:tag-plus-outline"
            height="12"
          />
        </button>
        <!-- 删除提交按钮（hover 显示；点击弹出删除确认弹窗） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm bcl-drop-btn"
          :title="i18n.dropCommitOpen"
          @click.stop="$emit('dropCommit', entry)"
        >
          <Icon icon="mdi:delete-outline" height="12" />
        </button>
        <span class="bcl-meta">
          <span class="bcl-author">{{ entry.author }}</span>
          <span
            class="bcl-date"
            :title="entry.date"
          >
            <span class="bcl-date-relative">{{ entry.relativeDate }}</span>
            <span class="bcl-date-absolute">{{ formatDateTime(entry.date) }}</span>
          </span>
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
import { formatDateTime } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  entries: CommitLogEntry[]
  loading: boolean
  /** Tag 指向 commit 的映射（完整 hash → Tag 名数组），供行内展示 */
  tagCommitMap?: Map<string, string[]>
  /** 各远程已有的 Tag 名列表（remote 名 → Tag 名数组），供推送状态展示 */
  remoteTags?: Map<string, string[]>
  /** 显示条数初始值（卡片级 logLimit 传入，与抓取条数保持一致；不传回退 200） */
  initialCount?: number | "all"
}>()

const emit = defineEmits<{
  reloadCommitLog: [count: number | "all"]
  refreshCommitLog: []
  fixCommit: [entry: CommitLogEntry]
  addTag: [entry: CommitLogEntry]
  dropCommit: [entry: CommitLogEntry]
  viewFiles: [entry: CommitLogEntry]
}>()

const countOptions = [200, 300, 500, 1000, 2000, "all"] as const
const searchKeyword = ref("")
/** 选择框当前值：以卡片级 logLimit（initialCount prop）为初始值，切换 Tab 重建后仍沿用用户上次选择 */
const displayCount = ref<number | "all">(props.initialCount ?? 200)

const filteredEntries = computed(() => {
  let list = props.entries
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter((e) => e.message.toLowerCase().includes(kw))
  }
  return displayCount.value === "all" ? list : list.slice(0, displayCount.value)
})

/** 短 hash（7 位）→ Tag 名数组（日志列表 hash 为短 hash，映射键为完整 hash，按前缀截取匹配） */
const shortTagMap = computed(() => {
  const map = new Map<string, string[]>()
  if (!props.tagCommitMap) return map
  for (const [fullHash, names] of props.tagCommitMap) {
    const short = fullHash.slice(0, 7)
    const existing = map.get(short)
    if (existing) existing.push(...names)
    else map.set(short, [...names])
  }
  return map
})

function entryTags(hash: string): string[] {
  return shortTagMap.value.get(hash) ?? []
}

/** 是否已获取到任一远程的 Tag 数据（全失败/无远程时 UI 不显示推送状态，避免误标） */
const hasRemoteData = computed(() => !!props.remoteTags && props.remoteTags.size > 0)

/** Tag 名 → 已推送的远程名数组 */
const tagRemoteMap = computed(() => {
  const map = new Map<string, string[]>()
  if (!props.remoteTags) return map
  for (const [remote, tags] of props.remoteTags) {
    for (const t of tags) {
      const arr = map.get(t)
      if (arr) arr.push(remote)
      else map.set(t, [remote])
    }
  }
  return map
})

function tagRemotes(tag: string): string[] {
  return tagRemoteMap.value.get(tag) ?? []
}

/** Tag 徽标 tooltip：列出已推送的远程名，未推送（且远程数据可用）时提示 */
function tagPushTitle(tag: string): string {
  const remotes = tagRemotes(tag)
  return remotes.length ? `${tag} → ${remotes.join(", ")}` : `${tag} · ${props.i18n.tagNotPushed}`
}

function onCountChange() {
  emit("reloadCommitLog", displayCount.value)
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/BranchCommitList.scss";
</style>
