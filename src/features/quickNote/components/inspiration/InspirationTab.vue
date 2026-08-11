<template>
  <section class="panel-section">
    <!-- 灵感新增表单 + 标签筛选栏 -->
    <InspirationForm
      :plugin="plugin"
      :all-tags="allTags"
      :active-tag="activeTag"
      :i18n="i18n"
      @add="inspirations.add"
      @select-tag="handleSelectTag"
    />
    <div class="insp-list">
      <!-- 空态提示 -->
      <div
        v-if="filteredInspirations.length === 0"
        class="insp-list__empty"
      >{{ i18n.inspEmpty }}</div>
      <InspirationItem
        v-for="item in filteredInspirations"
        :key="item.id"
        :item="item"
        :plugin="plugin"
        :i18n="i18n"
        @update="(c, t) => inspirations.update(item.id, c, t)"
        @remove="handleInspRemove(item.id)"
        @filter-tag="handleSelectTag"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 灵感 Tab
 * 灵感新增表单 + 标签筛选栏 + 灵感列表；标签筛选状态由 inspirations composable 持有，
 * 删除/更新直达 composable，编辑态由 InspirationItem 自管理
 */
import type { Plugin } from "siyuan"
import InspirationForm from "./InspirationForm.vue"
import InspirationItem from "./InspirationItem.vue"
import { useInspirations } from "../../composables/useInspirations"

type InspirationsApi = ReturnType<typeof useInspirations>

const props = defineProps<{
  plugin: Plugin
  i18n: Record<string, string>
  inspirations: InspirationsApi
}>()

const inspirations = props.inspirations

/** 全量标签（供筛选栏渲染） */
const allTags = inspirations.allTags
/** 当前选中标签（null = 全部） */
const activeTag = inspirations.activeTag
/** 当前筛选结果 */
const filteredInspirations = inspirations.filteredInspirations

/** 删除灵感（带确认） */
const handleInspRemove = (id: string) => {
  if (!window.confirm(props.i18n.deleteConfirm)) return
  inspirations.remove(id)
}

/** 切换筛选标签 */
const handleSelectTag = (tag: string | null) => {
  inspirations.activeTag.value = tag
}
</script>

<style scoped lang="scss">
@use "../../styles/index.scss";
</style>
