<!-- 自动备份设置卡片组件 — 启用/频率/时间/保留份数 -->
<template>
  <section class="card-section auto-backup-section">
    <div class="section-header">
      <h4>{{ i18n.autoBackupSettings || "自动备份设置" }}</h4>
    </div>
    <div class="settings-row">
      <span class="inline-label">{{ i18n.autoBackup || "自动备份" }}</span>
      <Select
        :model-value="autoBackupEnabled"
        :options="autoBackupOptions"
        size="xsmall"
        @update:model-value="$emit('update:autoBackupEnabled', $event as boolean)"
      />
      <template v-if="autoBackupEnabled">
        <span class="inline-label">{{ i18n.backupFrequency || "频率" }}</span>
        <Select
          :model-value="backupFrequency"
          :options="frequencyOptions"
          size="xsmall"
          @update:model-value="$emit('update:backupFrequency', $event as string)"
        />
        <template v-if="backupFrequency === 'daily'">
          <span class="inline-label">{{ i18n.backupTime || "时间" }}</span>
          <Input
            :model-value="backupTime"
            type="text"
            size="xsmall"
            @update:model-value="$emit('update:backupTime', $event as string)"
          />
        </template>
        <span class="inline-label">{{ i18n.keepBackupCount || "保留" }}</span>
        <Input
          :model-value="keepBackupCount"
          type="number"
          size="xsmall"
          style="width: 3rem;"
          @update:model-value="$emit('update:keepBackupCount', Number($event))"
        />
        <span class="inline-label">{{ i18n.keepBackupCountHint || "份" }}</span>
      </template>
    </div>
    <p class="backup-hint">
      {{ autoBackupEnabled
        ? (i18n.autoBackupEnabledHint || "自动备份已启用，将按设定频率自动执行")
        : (i18n.autoBackupDisabledHint || "启用后按设定频率自动备份工作区")
      }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

const props = defineProps<{
  autoBackupEnabled: boolean
  backupFrequency: string
  backupTime: string
  keepBackupCount: number
  i18n: Record<string, string>
}>()

defineEmits<{
  (e: "update:autoBackupEnabled", value: boolean): void
  (e: "update:backupFrequency", value: string): void
  (e: "update:backupTime", value: string): void
  (e: "update:keepBackupCount", value: number): void
}>()

const autoBackupOptions = computed(() => [
  { value: false, label: props.i18n.disabled || "禁用" },
  { value: true, label: props.i18n.enabled || "启用" },
])

const frequencyOptions = computed(() => [
  { value: "minute", label: props.i18n.everyMinute || "每分钟" },
  { value: "hourly", label: props.i18n.everyHour || "每小时" },
  { value: "daily", label: props.i18n.everyDay || "每天" },
])
</script>

<style scoped lang="scss">
@use "../styles/AutoBackupCard.scss";
@use "../styles/index.scss";
</style>
