<!-- gitPush 项目卡片多面板 Tab 切换条（CHANGES/LOG/STASH/TAG + 计数徽标，v-model 双向绑定） -->
<template>
  <!-- 多面板 Tab 切换（工作区 / 提交日志 / Stash / Tag） -->
  <div class="gp-stash-tag-tabs">
    <div class="gp-stash-tag-tab-bar">
      <!-- 单个 Tab 按钮（激活态下划线高亮），悬停无文案提示 -->
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="gp-stash-tag-tab"
        :class="{ active: modelValue === tab.id }"
        @click="$emit('update:modelValue', tab.id)"
      >
        {{ tab.label }}
        <!-- 计数徽标（数量为 0 时不显示） -->
        <span
          v-if="counts[tab.countKey] > 0"
          class="gp-stash-tag-tab-count"
        >{{ counts[tab.countKey] }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

/** 卡片面板 Tab ID（与编排层 stashTagTab 状态同值域） */
export type CardTabId = "worktree" | "log" | "stash" | "tag"

/** Tab 元数据表（countKey 指向 props 对应计数字段） */
const TABS: { id: CardTabId, label: string, countKey: keyof CardCounts }[] = [
  { id: "worktree", label: "CHANGES", countKey: "changesCount" },
  { id: "log", label: "LOG", countKey: "logCount" },
  { id: "stash", label: "STASH", countKey: "stashCount" },
  { id: "tag", label: "TAG", countKey: "tagCount" },
]

interface CardCounts {
  changesCount: number
  logCount: number
  stashCount: number
  tagCount: number
}

const props = defineProps<{
  modelValue: CardTabId
} & CardCounts>()

/** 计数聚合映射（模板按 countKey 取数） */
const counts = computed<CardCounts>(() => ({
  changesCount: props.changesCount,
  logCount: props.logCount,
  stashCount: props.stashCount,
  tagCount: props.tagCount,
}))
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardTabs.scss";
</style>
