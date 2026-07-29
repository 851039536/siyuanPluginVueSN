<!-- 自动备份设置卡片组件 — 启用/频率/时间/保留份数 -->
<template>
  <section class="card-section auto-backup-section">
    <!-- 区块标题 -->
    <div class="section-header">
      <!-- 标题："自动备份设置" -->
      <h4>{{ i18n.autoBackupSettings }}</h4>
    </div>
    <div class="settings-row">
      <!-- 行内标签："自动备份" -->
      <span class="inline-label">{{ i18n.autoBackup }}</span>
      <Select
        v-model="autoBackupEnabled"
        :options="autoBackupOptions"
        size="xsmall"
      />
      <!-- 自动备份已启用时的设置区域 -->
      <template v-if="autoBackupEnabled">
        <!-- 行内标签："备份频率" -->
        <span class="inline-label">{{ i18n.backupFrequency }}</span>
        <Select
          v-model="backupFrequency"
          :options="frequencyOptions"
          size="xsmall"
        />
        <!-- 每日备份时显示时间输入 -->
        <template v-if="backupFrequency === 'daily'">
          <!-- 行内标签："备份时间" -->
          <span class="inline-label">{{ i18n.backupTime }}</span>
          <Input
            v-model="backupTime"
            type="text"
            size="xsmall"
            placeholder="03:00"
          />
        </template>
        <!-- 行内标签："保留" -->
        <span class="inline-label">{{ i18n.keepBackupCount }}</span>
        <Input
          :model-value="keepBackupCount"
          type="number"
          size="xsmall"
          class="keep-count-input"
          @update:model-value="keepBackupCount = sanitizeKeepCount($event)"
        />
        <!-- 行内标签："份" -->
        <span class="inline-label">{{ i18n.keepBackupCountHint }}</span>
      </template>
    </div>
    <!-- 自动备份状态提示 -->
    <p class="backup-hint">
      {{ autoBackupEnabled
        ? i18n.autoBackupEnabledHint
        : i18n.autoBackupDisabledHint
      }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

// 保留份数输入值清洗 — 防止 NaN/0 持久化导致本地备份保留清理失效
function sanitizeKeepCount(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1) {
    return 1
  }
  return n
}

const autoBackupEnabled = defineModel<boolean>("autoBackupEnabled", { required: true })
const backupFrequency = defineModel<string>("backupFrequency", { required: true })
const backupTime = defineModel<string>("backupTime", { required: true })
const keepBackupCount = defineModel<number>("keepBackupCount", { required: true })

const props = defineProps<{
  i18n: Record<string, string>
}>()

const autoBackupOptions = computed(() => [
  { value: false, label: props.i18n.disabled },
  { value: true, label: props.i18n.enabled },
])

const frequencyOptions = computed(() => [
  { value: "minute", label: props.i18n.everyMinute },
  { value: "hourly", label: props.i18n.everyHour },
  { value: "daily", label: props.i18n.everyDay },
])
</script>

<style scoped lang="scss">
@use "../styles/AutoBackupCard.scss";
@use "../styles/index.scss";
</style>
