<!-- 缓存条目明细列表：勾选 + 类型图标 + 名称 + 路径 + 体积 + 修改时间（纯展示，滚动容器由本组件承担） -->
<template>
  <div class="cc-entries">
    <div class="cc-entries__head">
      <span class="cc-entries__title">{{ i18n.cacheTotalFiles }}</span>
      <span class="cc-entries__count">{{ entries.length }}</span>
      <div class="cc-entries__actions">
        <Button
          variant="ghost"
          text
          size="xsmall"
          dense
          icon="checkboxMultipleOutline"
          @click="emit('select-all')"
        >{{ i18n.cacheSelectAll }}</Button>
        <Button
          variant="ghost"
          text
          size="xsmall"
          dense
          icon="minusBoxOutline"
          @click="emit('select-none')"
        >{{ i18n.cacheSelectNone }}</Button>
      </div>
    </div>

    <div
      v-if="entries.length === 0"
      class="cc-entries__empty"
    >{{ i18n.cacheEmpty }}</div>

    <ul
      v-else
      class="cc-entries__list"
    >
      <li
        v-for="row in rows"
        :key="row.path"
        class="cc-entries__row"
        :class="{ 'cc-entries__row--picked': isSelected(row.path) }"
      >
        <Checkbox
          size="small"
          :model-value="isSelected(row.path)"
          :aria-label="row.name"
          @update:model-value="emit('toggle-entry', row.path, $event === true)"
        />

        <IconWrapper
          :name="row.isDirectory ? 'folder' : 'fileOutline'"
          :size="12"
          class="cc-entries__icon"
        />

        <div class="cc-entries__main">
          <div
            class="cc-entries__name"
            :title="row.name"
          >{{ row.name }}</div>
          <div
            class="cc-entries__path"
            :title="row.path"
          >{{ row.path }}</div>
        </div>

        <div class="cc-entries__meta">
          <div class="cc-entries__size">{{ row.sizeText }}</div>
          <div
            v-if="row.timeText"
            class="cc-entries__time"
          >{{ row.timeText }}</div>
        </div>

        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="folderOpen"
          :title="i18n.cacheOpenFolder"
          @click="emit('open', row.path)"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { CacheEntry } from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Checkbox from "@/components/Checkbox.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  formatModifiedTime,
  formatSize,
} from "./format"

interface Props {
  /** 待清理条目（已按分类/体积排序，条目上限由扫描侧控制） */
  entries: CacheEntry[]
  /** 全部已选路径（用于渲染勾选态） */
  selected: Set<string>
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  /** 切换单条勾选（checked 为期望态） */
  (e: "toggle-entry", path: string, checked: boolean): void
  /** 在资源管理器中打开该条目 */
  (e: "open", path: string): void
  (e: "select-all"): void
  (e: "select-none"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 渲染行：体积/时间格式化随条目变化一次完成（模板逐行调用会在每次点选时重复格式化全量条目） */
interface EntryRow extends CacheEntry {
  sizeText: string
  timeText: string
}

const rows = computed<EntryRow[]>(() => props.entries.map(entry => ({
  ...entry,
  sizeText: formatSize(entry.size),
  timeText: formatModifiedTime(entry.modifiedTime),
})))

/** 路径是否已选中（`selected` 为 Set 传入，模板内联判断会把 Set.has 反复求值） */
const isSelected = (path: string): boolean => props.selected.has(path)
</script>

<style scoped lang="scss">
@use "../../styles/CacheCleanEntryList.scss";
</style>
