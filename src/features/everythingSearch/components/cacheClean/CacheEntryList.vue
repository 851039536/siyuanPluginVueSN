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
        v-for="entry in entries"
        :key="entry.path"
        class="cc-entries__row"
        :class="{ 'cc-entries__row--picked': isSelected(entry.path) }"
      >
        <Checkbox
          size="small"
          :model-value="isSelected(entry.path)"
          :aria-label="entry.name"
          @update:model-value="emit('toggle-entry', entry.path, $event === true)"
        />

        <IconWrapper
          :name="entry.isDirectory ? 'folder' : 'fileOutline'"
          :size="12"
          class="cc-entries__icon"
        />

        <div class="cc-entries__main">
          <div
            class="cc-entries__name"
            :title="entry.name"
          >{{ entry.name }}</div>
          <div
            class="cc-entries__path"
            :title="entry.path"
          >{{ entry.path }}</div>
        </div>

        <div class="cc-entries__meta">
          <div class="cc-entries__size">{{ formatSize(entry.size) }}</div>
          <div
            v-if="formatModifiedTime(entry.modifiedTime)"
            class="cc-entries__time"
          >{{ formatModifiedTime(entry.modifiedTime) }}</div>
        </div>

        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="folderOpen"
          :title="i18n.cacheOpenFolder"
          @click="emit('open', entry.path)"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { CacheEntry } from "../../types"
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

/** 路径是否已选中（`selected` 为 Set 传入，模板内联判断会把 Set.has 反复求值） */
const isSelected = (path: string): boolean => props.selected.has(path)
</script>

<style scoped lang="scss">
@use "../../styles/CacheCleanEntryList.scss";
</style>
