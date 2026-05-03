<template>
  <div class="shortcut-content">
    <div v-if="shortcuts.length === 0" class="shortcut-empty">
      <svg class="empty-icon"><use xlink:href="#iconSearch"></use></svg>
      <p>{{ emptyText }}</p>
    </div>

    <div v-for="group in groupedShortcuts" :key="group.name" class="shortcut-group">
      <div class="group-header">
        <span class="group-name">{{ group.name }}</span>
        <span class="group-count">{{ group.shortcuts.length }}</span>
      </div>
      <div class="shortcut-grid" :class="gridClass">
        <ShortcutCard
          v-for="shortcut in group.shortcuts"
          :key="shortcut.id"
          :shortcut="shortcut"
          :is-favorite="isFavorite(shortcut.id)"
          :is-recent="isRecent(shortcut.id)"
          :category-label="getCategoryLabel(shortcut.category)"
          :show-tool-badge="showToolBadge(shortcut.category)"
          :favorite-title="favoriteTitle"
          :un-favorite-title="unFavoriteTitle"
          :copy-title="copyTitle"
          :edit-title="editTitle"
          :delete-title="deleteTitle"
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
import { computed } from "vue";
import ShortcutCard from "./ShortcutCard.vue";
import type { ShortcutInfo, ShortcutGroup, ViewMode } from "../types";

interface Props {
  shortcuts: ShortcutInfo[];
  viewMode: ViewMode;
  isFavorite: (id: string) => boolean;
  isRecent: (id: string) => boolean;
  getCategoryLabel: (category: string) => string;
  showToolBadge: (category: string) => boolean;
  emptyText?: string;
  favoriteTitle?: string;
  unFavoriteTitle?: string;
  copyTitle?: string;
  editTitle?: string;
  deleteTitle?: string;
  otherGroupLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  emptyText: "未找到快捷键",
  favoriteTitle: "收藏",
  unFavoriteTitle: "取消收藏",
  copyTitle: "复制",
  editTitle: "编辑",
  deleteTitle: "删除",
  otherGroupLabel: "其他",
});

defineEmits<{
  toggleFavorite: [id: string];
  copy: [shortcut: ShortcutInfo];
  edit: [shortcut: ShortcutInfo];
  delete: [id: string];
}>();

const gridClass = computed(() => ({
  "list-view": props.viewMode === "list",
  "three-col-view": props.viewMode === "three-col",
}));

const groupedShortcuts = computed((): ShortcutGroup[] => {
  const groupMap = new Map<string, ShortcutInfo[]>();

  props.shortcuts.forEach((shortcut) => {
    const group = shortcut.group || props.otherGroupLabel;
    if (!groupMap.has(group)) {
      groupMap.set(group, []);
    }
    groupMap.get(group)!.push(shortcut);
  });

  return Array.from(groupMap.entries()).map(([name, shortcuts]) => ({
    name,
    shortcuts,
  }));
});
</script>

<style scoped lang="scss">
.shortcut-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.shortcut-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 12px;
  gap: 12px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.3;
}

.shortcut-group {
  padding: 0;
  margin-bottom: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  text-transform: uppercase;
  letter-spacing: 1px;
  background: var(--b3-theme-surface);
  position: sticky;
  top: 0;
  z-index: 10;
  border-left: 4px solid var(--b3-theme-primary);
}

.group-name {
  flex: 1;
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--b3-theme-primary);
  color: white;
  border-radius: 10px;
  font-size: 10px;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px;
}

.shortcut-grid.list-view {
  grid-template-columns: 1fr;
}

.shortcut-grid.three-col-view {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 1200px) {
  .shortcut-grid.three-col-view {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 800px) {
  .shortcut-grid.three-col-view {
    grid-template-columns: 1fr;
  }
}

.shortcut-content::-webkit-scrollbar {
  width: 5px;
}

.shortcut-content::-webkit-scrollbar-track {
  background: transparent;
}

.shortcut-content::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
}

.shortcut-content::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-on-surface-variant);
}
</style>
