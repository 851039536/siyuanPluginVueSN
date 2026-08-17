<!-- 快捷键网格容器：按 group 分组渲染，组名+数量徽章，2列网格布局，空数据提示 -->
<template>
  <div class="shortcut-content">
    <!-- 空数据提示 -->
    <div
      v-if="shortcuts.length === 0"
      class="shortcut-empty"
    >
      <svg class="empty-icon"><use xlink:href="#iconSearch"></use></svg>
      <p>{{ i18n.noResults }}</p>
    </div>

    <!-- 分组渲染 -->
    <div
      v-for="group in groupedShortcuts"
      :key="group.name"
      class="shortcut-group"
    >
      <div class="group-header">
        <span class="group-name">{{ group.name }}</span>
        <span class="group-count">{{ group.shortcuts.length }}</span>
      </div>
      <div class="shortcut-grid">
        <ShortcutCard
          v-for="shortcut in group.shortcuts"
          :key="shortcut.id"
          :shortcut="shortcut"
          :is-favorite="isFavorite(shortcut.id)"
          :is-recent="isRecent(shortcut.id)"
          :category-label="getCategoryLabel(shortcut.category)"
          :show-tool-badge="showToolBadge(shortcut.category)"
          :i18n="i18n"
          @toggle-favorite="$emit('toggleFavorite', $event)"
          @copy="$emit('copy', $event)"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  ShortcutGroup,
  ShortcutInfo,
} from "../types"
import { computed } from "vue"
import ShortcutCard from "./ShortcutCard.vue"

interface Props {
  shortcuts: ShortcutInfo[]
  isFavorite: (id: string) => boolean
  isRecent: (id: string) => boolean
  getCategoryLabel: (category: string) => string
  showToolBadge: (category: string) => boolean
  i18n: Record<string, string>
}

const props = defineProps<Props>()

defineEmits<{
  toggleFavorite: [id: string]
  copy: [shortcut: ShortcutInfo]
  edit: [shortcut: ShortcutInfo]
  delete: [id: string]
}>()

const groupedShortcuts = computed((): ShortcutGroup[] => {
  const groupMap = new Map<string, ShortcutInfo[]>()

  props.shortcuts.forEach((shortcut) => {
    const group = shortcut.group || props.i18n.other
    if (!groupMap.has(group)) {
      groupMap.set(group, [])
    }
    groupMap.get(group)!.push(shortcut)
  })

  return Array.from(groupMap.entries()).map(([name, shortcuts]) => ({
    name,
    shortcuts,
  }))
})
</script>

<style lang="scss" scoped>
@use "../styles/ShortcutGrid.scss";
</style>
