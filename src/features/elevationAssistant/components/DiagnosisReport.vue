<!-- 提权助手 - 单个目标的诊断报告 -->
<template>
  <Card
    v-if="diagnosis"
    variant="bordered"
    size="xsmall"
    class="elevation-report"
  >
    <div class="elevation-report__head">
      <Tag
        :variant="view.variant"
        size="xsmall"
        :icon="view.icon"
      >
        {{ view.label }}
      </Tag>
      <span class="elevation-report__level">{{ levelLabel }}</span>
    </div>

    <div class="elevation-report__grid">
      <div class="elevation-report__item">
        <span class="elevation-report__label">{{ i18n.manifestSource }}</span>
        <span class="elevation-report__value">{{ sourceLabel }}</span>
      </div>
      <div class="elevation-report__item">
        <span class="elevation-report__label">{{ i18n.manifestLevel }}</span>
        <span class="elevation-report__value">{{ levelLabel }}</span>
      </div>
      <div class="elevation-report__item">
        <span class="elevation-report__label">{{ i18n.arch }}</span>
        <span class="elevation-report__value">{{ diagnosis.arch === "unknown" ? "—" : diagnosis.arch }}</span>
      </div>
      <div class="elevation-report__item">
        <span class="elevation-report__label">{{ i18n.size }}</span>
        <span class="elevation-report__value">{{ formatSize(diagnosis.size) }}</span>
      </div>
      <div class="elevation-report__item">
        <span class="elevation-report__label">uiAccess</span>
        <span class="elevation-report__value">{{ diagnosis.uiAccess ? (i18n.yes) : (i18n.no) }}</span>
      </div>
      <div class="elevation-report__item">
        <span class="elevation-report__label">{{ i18n.checkedAt }}</span>
        <span class="elevation-report__value">{{ formatTime(diagnosis.checkedAt) }}</span>
      </div>
    </div>

    <p class="elevation-report__reason">
      {{ view.reason }}
    </p>

    <p
      v-if="diagnosis.manifestSource === 'external'"
      class="elevation-report__warning"
    >
      {{ i18n.externalManifestWarning }}
    </p>

    <p
      v-if="diagnosis.error"
      class="elevation-report__error"
      :title="diagnosis.error"
    >
      {{ diagnosis.error }}
    </p>
  </Card>
</template>

<script setup lang="ts">
import type { PermissionDiagnosis } from "../types"
import { computed } from "vue"
import Card from "@/components/Card.vue"
import Tag from "@/components/Tag.vue"
import { formatFileSize } from "@/utils/format"
import { presentDiagnosis } from "../utils/diagnosisView"

interface Props {
  diagnosis: PermissionDiagnosis | null
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const view = computed(() => presentDiagnosis(props.diagnosis, props.i18n))

const levelLabel = computed(() => {
  const level = props.diagnosis?.manifestLevel
  if (level === "requireAdministrator") return "requireAdministrator"
  if (level === "highestAvailable") return "highestAvailable"
  if (level === "asInvoker") return "asInvoker"
  return props.i18n.manifestUnknown
})

const sourceLabel = computed(() => {
  const source = props.diagnosis?.manifestSource
  if (source === "embedded") return props.i18n.sourceEmbedded
  if (source === "external") return props.i18n.sourceExternal
  if (source === "unreadable") return props.i18n.sourceUnreadable
  return props.i18n.sourceNone
})

function formatSize(size: number): string {
  if (!size) return "—"
  return formatFileSize(size)
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}
</script>

<style lang="scss">
@use "../styles/DiagnosisReport.scss";
</style>
