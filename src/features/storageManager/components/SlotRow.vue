<!-- 数据管理 - 单个存储槽位行：名称/标签 + 大小/条数/时间 + 清空操作 -->
<template>
  <div class="sm-slot">
    <div class="sm-slot__main">
      <!-- 槽位名称（注册表 defaultLabel） -->
      <span class="sm-slot__name">{{ slot?.defaultLabel || usage.key }}</span>
      <!-- 类型标签："JSON" / "SQLite" / "文件" / "浏览器" -->
      <Tag
        size="xsmall"
        :variant="kindVariant"
        :content="t.kinds?.[usage.kind] || usage.kind"
      />
      <!-- 增长标记："增长" -->
      <Tag
        v-if="slot?.growth"
        size="xsmall"
        variant="warning"
        :content="t.tags?.growth"
      />
      <!-- 敏感标记："敏感" -->
      <Tag
        v-if="slot?.sensitive"
        size="xsmall"
        variant="danger"
        :content="t.tags?.sensitive"
      />
      <!-- 旧命名标记："旧命名" -->
      <Tag
        v-if="slot?.legacyName"
        size="xsmall"
        variant="secondary"
        :content="t.tags?.legacy"
      />
    </div>

    <!-- 大小 / 行数 / 更新时间 / 存储键 -->
    <div class="sm-slot__meta">
      <span v-if="usage.missing" class="sm-slot__missing">{{ t.missing }}</span>
      <span v-else-if="usage.kind === 'sqlite'">{{ usage.items ?? 0 }} {{ t.rows }}</span>
      <span v-else>{{ formatBytes(usage.bytes) }}</span>
      <span v-if="usage.updatedAt">{{ formatTime(usage.updatedAt) }}</span>
      <code class="sm-slot__key" :title="usage.key">{{ usage.key }}</code>
      <span v-if="usage.unavailableReason" class="sm-slot__missing">
        {{ t.errors?.[usage.unavailableReason] || usage.unavailableReason }}
      </span>
    </div>

    <div class="sm-slot__actions">
      <!-- 清空按钮（仅 resettable 槽位） -->
      <Button
        v-if="slot?.resettable"
        variant="ghost"
        severity="danger"
        size="xsmall"
        dense
        icon="delete"
        :title="t.actions?.reset"
        @click="emit('reset', usage.slotId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StorageSlot } from "@/config/storage"
import Button from "@/components/Button.vue"
import Tag from "@/components/Tag.vue"
import type { SlotUsage } from "../types/model"
import { formatBytes, formatTime } from "../utils"

interface Props {
  usage: SlotUsage
  slot?: StorageSlot
  t: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  reset: [slotId: string]
}>()

const kindVariant = (() => {
  switch (props.usage.kind) {
    case "sqlite":
      return "success"
    case "file":
      return "warning"
    case "localStorage":
      return "secondary"
    default:
      return "primary"
  }
})()
</script>

<style lang="scss" scoped>
@use "../styles/SlotRow.scss";
@use "../styles/index.scss";
</style>
