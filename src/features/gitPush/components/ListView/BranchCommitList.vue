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
      <!-- 搜索输入框（placeholder："搜索提交信息..."；清空入口由 Input 内建，Escape 亦可清空） -->
      <Input
        v-model="searchKeyword"
        class="bcl-search-input"
        size="xsmall"
        clearable
        :placeholder="i18n.commitSearchPlaceholder"
        @keydown.esc="searchKeyword = ''"
      />
      <!-- 显示条数下拉（"全部" / 数字；Select 为纯受控，回写由 handleCountChange 负责） -->
      <Select
        class="bcl-count-select"
        size="xsmall"
        :model-value="displayCount"
        :options="countSelectOptions"
        :aria-label="i18n.commitLogCountLabel"
        @update:model-value="handleCountChange"
      />
      <!-- 刷新提交日志 -->
      <Button
        class="bcl-refresh-btn"
        variant="ghost"
        size="xsmall"
        dense
        :icon="loading ? 'loading' : 'refresh'"
        :loading="loading"
        :title="i18n.refreshCommitLog"
        @click.stop="$emit('refreshCommitLog')"
      />
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
        @pointerenter="openStatTip(entry.hash, $event)"
        @pointerleave="closeStatTip"
        @focusin="openStatTip(entry.hash, $event)"
        @focusout="closeStatTip"
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
          <Tag
            v-for="tagName in entryTags(entry.hash).slice(0, 2)"
            :key="tagName"
            class="bcl-tag-chip"
            variant="primary"
            size="xsmall"
            icon="tagOutline"
            :title="tagPushTitle(tagName)"
          >
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
          </Tag>
          <Tag
            v-if="entryTags(entry.hash).length > 2"
            class="bcl-tag-more"
            variant="secondary"
            size="xsmall"
          >+{{ entryTags(entry.hash).length - 2 }}</Tag>
        </span>
        <span
          class="bcl-msg bcl-msg--clickable"
          :title="i18n.ruleFixOpen + ': ' + entry.message"
          @click.stop="$emit('fixCommit', entry)"
        >{{ entry.message }}</span>
        <!-- 查看提交文件按钮（常显；点击弹出该提交修改的文件清单） -->
        <Button
          class="bcl-files-btn"
          variant="ghost"
          size="xsmall"
          dense
          icon="fileOutline"
          :title="i18n.commitFilesOpen"
          @click.stop="$emit('viewFiles', entry)"
        />
        <!-- 打 Tag 按钮（常显） -->
        <Button
          class="bcl-tag-btn"
          variant="ghost"
          size="xsmall"
          dense
          icon="tagPlusOutline"
          :title="i18n.createTag"
          @click.stop="$emit('addTag', entry)"
        />
        <!-- 删除提交按钮（常显；点击弹出删除确认弹窗） -->
        <Button
          class="bcl-drop-btn"
          variant="ghost"
          size="xsmall"
          dense
          icon="deleteOutline"
          :title="i18n.dropCommitOpen"
          @click.stop="$emit('dropCommit', entry)"
        />
        <span class="bcl-meta">
          <span class="bcl-author">{{ entry.author }}</span>
          <span
            class="bcl-date"
            :title="entry.date"
          >
            <span class="bcl-date-relative">{{ relativeTime(entry.date, i18n) }}</span>
            <span class="bcl-date-absolute">{{ formatDateTime(entry.date) }}</span>
          </span>
        </span>
      </div>
    </div>

    <!--
      提交变更规模提示：单个受控 Tooltip 复用给所有行（而非每行挂一个实例 —— 200 行会多挂 200 个组件）。
      锚点取指针/焦点所在行元素，内容随目标行切换。
      `disabled` 关掉组件内建的 hover/focus 触发器：锚点随行列变化，而组件的触发器只在挂载时绑定一次，
      留着会绑到过期行上；本组件改由行上的 pointerenter/focus 显式驱动（可同时覆盖鼠标移入与键盘聚焦）。
    -->
    <Tooltip
      :visible="tipVisible"
      :target="tipAnchor"
      :text="tipText"
      placement="top"
      size="xsmall"
      :max-width="280"
      disabled
      @update:visible="tipVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import type { CommitLogEntry, CommitStat } from "../../types"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
} from "vue"
import { DEFAULT_LOG_LIMIT, formatDateTime, relativeTime } from "../../utils"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Tag from "@/components/Tag.vue"
import Tooltip from "@/components/Tooltip.vue"

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
  /** 短 hash → 提交变更规模（--shortstat 后台批量取；未就绪/无该项时不展示悬停提示） */
  stats?: Map<string, CommitStat>
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
/** 条数下拉选项（末尾「全部」取 i18n 文案；值为 number | "all"，与 displayCount 同值域） */
const countSelectOptions = computed(() =>
  countOptions.map((n) => ({ value: n, label: n === "all" ? props.i18n.logFilterAll : String(n) })),
)
const searchKeyword = ref("")
/** 选择框当前值：以卡片级 logLimit（initialCount prop）为初始值，切换 Tab 重建后仍沿用用户上次选择 */
const displayCount = ref<number | "all">(props.initialCount ?? DEFAULT_LOG_LIMIT)

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

/** 条数变更：Select 为纯受控组件（内部只 emit），必须先回写 ref 再按新值重载 */
function handleCountChange(value: string | number | boolean | null) {
  if (value !== "all" && typeof value !== "number") return
  displayCount.value = value
  emit("reloadCommitLog", displayCount.value)
}

// ── 提交变更规模提示（单个受控 Tooltip 服务所有行）──

/** 提示是否显示（受控；指针悬停或行获得焦点时打开） */
const tipVisible = ref(false)
/** 提示锚点（当前悬停/聚焦的行元素） */
const tipAnchor = ref<HTMLElement | null>(null)
/** 提示文案（随目标行切换） */
const tipText = ref("")

/** 取该提交的变更规模（未加载/merge 提交/超出统计上限时为 undefined） */
function statOf(hash: string): CommitStat | undefined {
  return props.stats?.get(hash)
}

/** 变更规模文案："6 个文件变更 · 6 行插入(+) · 3 行删除(−)"（三段均为 i18n 文案，随语言切换） */
function statText(hash: string): string {
  const stat = statOf(hash)
  if (!stat) return ""
  return [
    props.i18n.commitStatFiles.replace("{0}", String(stat.files)),
    props.i18n.commitStatInsertions.replace("{0}", stat.insertions.toLocaleString()),
    props.i18n.commitStatDeletions.replace("{0}", stat.deletions.toLocaleString()),
  ].join(" · ")
}

/** 打开提示：无统计时不打开（merge 提交与超出统计上限的行保持原样） */
function openStatTip(hash: string, event: Event) {
  if (!statOf(hash)) return
  tipAnchor.value = event.currentTarget as HTMLElement
  tipText.value = statText(hash)
  tipVisible.value = true
}

function closeStatTip() {
  tipVisible.value = false
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/BranchCommitList.scss";
</style>
