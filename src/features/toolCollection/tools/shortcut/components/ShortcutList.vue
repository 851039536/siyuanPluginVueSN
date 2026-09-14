<!-- 快捷键列表：分组渲染 + 吸顶组头（可折叠）+ 卡片网格 + 空态 -->
<template>
  <div class="shortcut-list">
    <!-- 空态 -->
    <div
      v-if="shortcuts.length === 0"
      class="shortcut-list__empty"
    >
      <IconWrapper
        name="search"
        :size="40"
        class="shortcut-list__empty-icon"
      />
      <p class="shortcut-list__empty-text">
        {{ i18n.noResults }}
      </p>
    </div>

    <!-- 分组渲染 -->
    <section
      v-for="group in groups"
      :key="group.name"
      class="shortcut-group"
    >
      <div class="shortcut-group__header">
        <button
          type="button"
          class="shortcut-group__toggle"
          :aria-expanded="!isCollapsed(group.name)"
          :title="group.name"
          @click="toggleGroup(group.name)"
        >
          <IconWrapper
            :name="isCollapsed(group.name) ? 'chevronRight' : 'chevronDown'"
            :size="13"
            class="shortcut-group__chevron"
          />
          <span class="shortcut-group__name">{{ group.name }}</span>
        </button>
        <Tag
          variant="secondary"
          size="xsmall"
          shape="circle"
        >
          {{ group.shortcuts.length }}
        </Tag>
      </div>

      <div
        v-show="!isCollapsed(group.name)"
        class="shortcut-group__body"
      >
        <ShortcutRow
          v-for="shortcut in group.shortcuts"
          :key="shortcut.id"
          :shortcut="shortcut"
          :is-preset="presetIds.has(shortcut.id)"
          :category-label="getCategoryLabel(shortcut.category)"
          :show-tool-badge="showToolBadge(shortcut, group.name)"
          :i18n="i18n"
          @copy="$emit('copy', $event)"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ShortcutInfo } from "../types"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Tag from "@/components/Tag.vue"
import { groupShortcuts } from "../utils"
import { TOOL_CATEGORIES } from "../types"
import ShortcutRow from "./ShortcutRow.vue"

interface Props {
  shortcuts: ShortcutInfo[]
  presetIds: ReadonlySet<string>
  getCategoryLabel: (category: string) => string
  i18n: Record<string, string>
}

const props = defineProps<Props>()

defineEmits<{
  copy: [shortcut: ShortcutInfo]
  edit: [shortcut: ShortcutInfo]
  delete: [id: string]
}>()

/** 折叠的分组名（会话级，不持久化） */
const collapsedGroups = ref<Set<string>>(new Set())

const groups = computed(() => groupShortcuts(props.shortcuts, props.i18n.other))

function isCollapsed(name: string): boolean {
  return collapsedGroups.value.has(name)
}

function toggleGroup(name: string): void {
  if (collapsedGroups.value.has(name)) {
    collapsedGroups.value.delete(name)
  } else {
    collapsedGroups.value.add(name)
  }
}

/**
 * 是否在卡片内显示分类标签：仅工具类分类需要，
 * 且组头已写明同一个工具名时不再重复（预置数据的 group 与工具名一致）
 */
function showToolBadge(shortcut: ShortcutInfo, groupName: string): boolean {
  if (!(TOOL_CATEGORIES as readonly string[]).includes(shortcut.category)) {
    return false
  }
  return props.getCategoryLabel(shortcut.category) !== groupName
}
</script>

<style scoped lang="scss">
@use "../styles/ShortcutList.scss";
</style>
