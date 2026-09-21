<!-- 导航栏 — 磁盘列表（含用量条）+ 收藏夹 + 合计容量页脚 -->
<template>
  <div class="db-nav">
    <!-- 磁盘列表 -->
    <div
      class="db-drives"
      role="list"
    >
      <div
        v-for="disk in disks"
        :key="disk.drive"
        class="db-drive-row"
        :class="{ active: expandedDisk === disk.drive }"
        role="listitem"
        tabindex="0"
        :title="driveTitle(disk)"
        @click="$emit('selectDisk', disk)"
        @keydown.enter.prevent="$emit('selectDisk', disk)"
        @keydown.space.prevent="$emit('selectDisk', disk)"
      >
        <div class="db-drive-info">
          <!-- 盘符 + 已用/总量 + 百分比同处一行；卷标在无容量数据时兜底显示 -->
          <!-- 完整精度（2 位小数 + 卷标）放在行 title 中，窄侧栏无需牺牲可读性 -->
          <div class="db-drive-heading">
            <span class="db-drive-label">{{ disk.drive }}</span>
            <span
              v-if="disk.total"
              class="db-drive-space"
            >{{ formatVolumePair(disk.used ?? 0, disk.total) }}</span>
            <span
              v-if="disk.total"
              class="db-drive-usage"
            >{{ disk.usagePercent ?? 0 }}%</span>
            <span
              v-else-if="disk.label"
              class="db-drive-name"
            >{{ disk.label }}</span>
          </div>
          <ProgressBar
            v-if="disk.total"
            :value="disk.usagePercent ?? 0"
            :severity="usageSeverity(disk.usagePercent ?? 0)"
            size="xsmall"
            :show-value="false"
          />
        </div>
      </div>

      <div
        v-if="disks.length === 0"
        class="db-drive-empty"
      >
        {{ i18n.noDisks }}
      </div>
    </div>

    <!-- 收藏夹 -->
    <div class="db-favorites">
      <div class="db-favorites-title">
        <IconWrapper
          name="star"
          :size="12"
          color="#f97316"
        />
        <span>{{ i18n.favorites }}</span>
        <Badge
          v-if="favoriteFolders.length > 0"
          :content="favoriteFolders.length"
          variant="primary"
          size="xsmall"
        />
      </div>

      <div
        v-if="favoriteFolders.length > 0"
        class="db-fav-list"
      >
        <div
          v-for="path in favoriteFolders"
          :key="path"
          class="db-fav-row"
          role="button"
          tabindex="0"
          :title="path"
          @click="$emit('navigateFavorite', path)"
          @keydown.enter.prevent="$emit('navigateFavorite', path)"
          @keydown.space.prevent="$emit('navigateFavorite', path)"
        >
          <IconWrapper
            name="folder"
            :size="12"
            color="var(--b3-theme-on-surface-light)"
          />
          <span class="db-fav-name">{{ folderName(path) }}</span>
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="close"
            class="db-fav-remove"
            :title="i18n.removeFavorite"
            @click.stop="$emit('removeFavorite', path)"
          />
        </div>
      </div>
      <div
        v-else
        class="db-fav-empty"
      >
        {{ i18n.noFavorites }}
      </div>
    </div>

    <!-- 页脚：合计容量 + 刷新磁盘 -->
    <div class="db-nav-footer">
      <span
        v-if="totalCapacity > 0"
        class="db-nav-total"
        :title="`${i18n.usedSpace} ${formatFileSize(totalUsed)} / ${i18n.freeSpace} ${formatFileSize(totalCapacity - totalUsed)} / ${i18n.totalSpace} ${formatFileSize(totalCapacity)}`"
      >
        {{ formatVolumePair(totalUsed, totalCapacity) }}
      </span>
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="refresh"
        :loading="loading"
        :title="i18n.refreshing"
        @click="$emit('refreshDisks')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiskBrowserI18n, DiskInfo } from "../types"
import { formatFileSize } from "@/utils/format"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import ProgressBar from "@/components/ProgressBar.vue"
import { formatVolumePair } from "../utils"

interface Props {
  disks: DiskInfo[]
  expandedDisk: string
  favoriteFolders: string[]
  loading: boolean
  totalCapacity: number
  totalUsed: number
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  selectDisk: [disk: DiskInfo]
  navigateFavorite: [path: string]
  removeFavorite: [path: string]
  refreshDisks: []
}>()

/** 用量阈值：>=85% 红、>=60% 琥珀，其余主色 */
function usageSeverity(percent: number): "primary" | "warning" | "danger" {
  if (percent >= 85) return "danger"
  if (percent >= 60) return "warning"
  return "primary"
}

/**
 * 行悬浮提示：卷标 + 盘符 + **完整精度**容量。
 * 行内为窄侧栏做了取整（`275/290 GB`），精确值与被舍去的卷标在此补全。
 */
function driveTitle(disk: DiskInfo): string {
  const head = disk.label ? `${disk.label} (${disk.drive})` : disk.drive
  if (!disk.total) return head
  const used = formatFileSize(disk.used ?? 0)
  const total = formatFileSize(disk.total)
  return `${head} — ${used} / ${total}`
}

/** 取路径末段作为收藏夹显示名（"E:\a\b" → "b"，根路径回退为盘符本身） */
function folderName(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split("\\")
  return parts[parts.length - 1] || path
}
</script>

<style scoped lang="scss">
@use "../styles/NavPane.scss";
</style>
