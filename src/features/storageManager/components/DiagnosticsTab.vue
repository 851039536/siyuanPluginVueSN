<!-- 数据管理 - 诊断：增长型槽位超过阈值的迁移提示 -->
<template>
  <div class="sm-diagnostics">
    <!-- 说明："增长型槽位超过 150KB 时提示迁移……" -->
    <p class="sm-desc">{{ t.diagnostics?.desc }}</p>

    <template v-if="warnings.length">
      <!-- 告警项："「{槽位}」已占用 {大小}，建议迁移到 SQLite" -->
      <Message
        v-for="warning in warnings"
        :key="warning.slotId"
        severity="warn"
        icon="databaseRemoveOutline"
      >
        {{ messageFor(warning) }}
      </Message>
    </template>

    <!-- 无告警："没有需要处理的告警" -->
    <Message
      v-else
      severity="success"
      icon="check"
    >
      {{ t.diagnostics?.empty }}
    </Message>

    <!-- 迁移路线文档路径 -->
    <p class="sm-hint">{{ t.diagnostics?.docsHint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Message from "@/components/Message.vue"
import { getSlot } from "@/config/storage"
import type { DiagnosticFinding, StorageInventory } from "../types/model"
import { formatBytes } from "../utils"

interface Props {
  inventory: StorageInventory | null
  t: Record<string, any>
}

const props = defineProps<Props>()

const warnings = computed(() => props.inventory?.warnings || [])

function messageFor(warning: DiagnosticFinding): string {
  const label = getSlot(warning.slotId)?.defaultLabel || warning.slotId
  return (props.t.diagnostics?.growthLarge || "")
    .replace("{0}", label)
    .replace("{1}", formatBytes(warning.bytes))
}
</script>

<style lang="scss" scoped>
@use "../styles/DiagnosticsTab.scss";
@use "../styles/index.scss";
</style>
