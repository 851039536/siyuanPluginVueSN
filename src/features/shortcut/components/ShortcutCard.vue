<!-- 单个快捷键卡片：名称、平台标记、分类徽章、按键组合、收藏/复制/编辑/删除操作 -->
<template>
  <div
    class="shortcut-card"
    :class="{
      'is-favorite': isFavorite,
      'is-recent': isRecent,
    }"
  >
    <div class="card-header">
      <div class="shortcut-name">
        <span class="name-text">{{ shortcut.name }}</span>
        <!-- 平台限制标记 -->
        <span
          v-if="shortcut.platform"
          class="platform-badge"
        >{{ shortcut.platform }}</span>
        <!-- 工具分类徽章 -->
        <span
          v-if="showToolBadge"
          class="tool-badge"
        >{{ categoryLabel }}</span>
      </div>
      <div class="shortcut-actions">
        <!-- 收藏切换 -->
        <Button
          variant="ghost"
          size="xsmall"
          :icon="isFavorite ? 'star' : 'starOutline'"
          :class="{ active: isFavorite }"
          :title="isFavorite ? i18n.unFavorite : i18n.favorite"
          @click="$emit('toggleFavorite', shortcut.id)"
        />
        <!-- 复制按键 -->
        <Button
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          :title="i18n.copy"
          @click="$emit('copy', shortcut)"
        />
        <!-- 编辑（仅自定义分类） -->
        <Button
          v-if="shortcut.category === 'custom'"
          variant="ghost"
          size="xsmall"
          icon="edit"
          :title="i18n.edit"
          @click="$emit('edit', shortcut)"
        />
        <!-- 删除（仅自定义分类） -->
        <Button
          v-if="shortcut.category === 'custom'"
          variant="ghost"
          size="xsmall"
          icon="delete"
          :title="i18n.delete"
          @click="$emit('delete', shortcut.id)"
        />
      </div>
    </div>
    <!-- 按键组合（点击复制） -->
    <div
      class="shortcut-keys"
      :title="i18n.copy"
      @click="$emit('copy', shortcut)"
    >
      <span
        v-for="(key, idx) in keyParts"
        :key="`key-${idx}`"
        class="key-badge"
      >
        {{ key }}
      </span>
    </div>
    <!-- 功能描述 -->
    <div class="shortcut-desc">
      {{ shortcut.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ShortcutInfo } from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"

interface Props {
  shortcut: ShortcutInfo
  isFavorite: boolean
  isRecent: boolean
  categoryLabel: string
  showToolBadge: boolean
  i18n: Record<string, string>
}

const props = defineProps<Props>()

defineEmits<{
  toggleFavorite: [id: string]
  copy: [shortcut: ShortcutInfo]
  edit: [shortcut: ShortcutInfo]
  delete: [id: string]
}>()

const keyParts = computed(() => {
  return props.shortcut.keys.split(", ").flatMap((seq) =>
    seq.split("+").map((k) => k.trim()),
  )
})
</script>

<style lang="scss" scoped>
@use "../styles/ShortcutCard.scss";
</style>
