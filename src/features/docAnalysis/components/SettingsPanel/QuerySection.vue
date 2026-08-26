<!-- 文档分析功能 - 设置弹窗查询默认分区（隐藏零值/默认笔记本/默认排序） -->
<template>
  <section class="settings-section">
    <div class="settings-section-title">查询默认</div>

    <!-- 隐藏零值行开关 -->
    <div class="settings-row">
      <span class="settings-row-label">隐藏零值</span>
      <Switch
        :model-value="hideZero"
        size="xsmall"
        label="统计表格隐藏数量为 0 的行"
        @update:model-value="(v) => emit('update:hideZero', v)"
      />
    </div>

    <!-- 默认笔记本 -->
    <div class="settings-row">
      <span class="settings-row-label">默认笔记本</span>
      <select
        :value="notebookId"
        class="settings-select"
        @change="onNotebookChange"
      >
        <option value="">
          全部笔记本
        </option>
        <option
          v-for="nb in notebooks"
          :key="nb.id"
          :value="nb.id"
        >
          {{ nb.name }}
        </option>
      </select>
    </div>

    <!-- 默认排序字段与方向 -->
    <div class="settings-row">
      <span class="settings-row-label">默认排序</span>
      <select
        :value="sortField"
        class="settings-select"
        @change="onSortFieldChange"
      >
        <option
          v-for="opt in SORT_FIELD_OPTIONS"
          :key="opt.value"
          :value="opt.value"
        >{{ opt.label }}</option>
      </select>
      <select
        :value="sortOrder"
        class="settings-select settings-select--small"
        @change="onSortOrderChange"
      >
        <option value="asc">升序</option>
        <option value="desc">降序</option>
      </select>
    </div>
  </section>
</template>

<script setup lang="ts">
import Switch from "@/components/Switch.vue"
import type { NotebookInfo, SortField, SortOrder } from "../../types/index"
import { SORT_FIELD_OPTIONS } from "../../types/index"

interface Props {
  hideZero: boolean
  notebookId: string
  sortField: SortField
  sortOrder: SortOrder
  notebooks: NotebookInfo[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: "update:hideZero", value: boolean): void
  (e: "update:notebookId", value: string): void
  (e: "update:sortField", value: SortField): void
  (e: "update:sortOrder", value: SortOrder): void
}>()

/** 默认笔记本变更（模板事件经函数包装，保证 emit 参数类型可推断） */
function onNotebookChange(e: Event) {
  emit("update:notebookId", (e.target as HTMLSelectElement).value)
}

/** 默认排序字段变更 */
function onSortFieldChange(e: Event) {
  emit("update:sortField", (e.target as HTMLSelectElement).value as SortField)
}

/** 默认排序方向变更 */
function onSortOrderChange(e: Event) {
  emit("update:sortOrder", (e.target as HTMLSelectElement).value as SortOrder)
}
</script>

<style lang="scss" scoped>
@use "../../styles/SettingsPanel.scss";
</style>
