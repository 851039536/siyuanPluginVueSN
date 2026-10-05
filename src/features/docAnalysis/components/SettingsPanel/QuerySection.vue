<!-- 文档分析功能 - 设置弹窗查询默认分区（隐藏零值/默认笔记本/默认排序） -->
<template>
  <section class="settings-section">
    <div class="settings-section-title">
      查询默认
    </div>

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
      <!-- 下拉：共享 Select（纯受控，显示全取 modelValue ⇒ handler 内回写 ref） -->
      <Select
        class="settings-select-field"
        :model-value="notebookId"
        :options="notebookOptions"
        size="xsmall"
        aria-label="默认笔记本"
        @update:model-value="(v) => emit('update:notebookId', toStr(v))"
      />
    </div>

    <!-- 默认排序字段与方向 -->
    <div class="settings-row">
      <span class="settings-row-label">默认排序</span>
      <Select
        class="settings-select-field"
        :model-value="sortField"
        :options="SORT_FIELD_OPTIONS"
        size="xsmall"
        aria-label="默认排序"
        @update:model-value="(v) => emit('update:sortField', toStr(v) as SortField)"
      />
      <Select
        class="settings-select-field settings-select-field--small"
        :model-value="sortOrder"
        :options="SORT_ORDER_OPTIONS"
        size="xsmall"
        aria-label="排序方向"
        @update:model-value="(v) => emit('update:sortOrder', toStr(v) as SortOrder)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  NotebookInfo,
  SortField,
  SortOrder,
} from "../../types/index"
import { computed } from "vue"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"
import { SORT_FIELD_OPTIONS } from "../../types/index"

interface Props {
  hideZero: boolean
  notebookId: string
  sortField: SortField
  sortOrder: SortOrder
  notebooks: NotebookInfo[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:hideZero", value: boolean): void
  (e: "update:notebookId", value: string): void
  (e: "update:sortField", value: SortField): void
  (e: "update:sortOrder", value: SortOrder): void
}>()

/** 排序方向选项（与 SortOrder 联合类型编译期绑定） */
const SORT_ORDER_OPTIONS: { value: SortOrder, label: string }[] = [
  {
    value: "asc",
    label: "升序",
  },
  {
    value: "desc",
    label: "降序",
  },
]

/** 笔记本选项：空串代表"全部笔记本"（与 FilterOptions.notebookId 的空值语义一致） */
const notebookOptions = computed(() => [
  {
    value: "",
    label: "全部笔记本",
  },
  ...props.notebooks.map((nb) => ({
    value: nb.id,
    label: nb.name,
  })),
])

/** Select 载荷归一为字符串（组件载荷为 string | number | boolean | null） */
function toStr(value: string | number | boolean | null): string {
  return value === null ? "" : String(value)
}
</script>

<style lang="scss" scoped>
@use "../../styles/SettingsPanel.scss";
</style>
