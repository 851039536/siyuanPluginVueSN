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
        :variant="variant"
        size="xsmall"
        :icon="icon"
      >
        {{ recommendationLabel }}
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
      {{ reasonText }}
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
import type { IconKey } from "@/components/kit/icons"
import type { PermissionDiagnosis } from "../types"
import { computed } from "vue"
import Card from "@/components/Card.vue"
import Tag from "@/components/Tag.vue"
import { formatFileSize } from "@/utils/format"

interface Props {
  diagnosis: PermissionDiagnosis | null
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const variant = computed<"default" | "success" | "warning" | "danger">(() => {
  if (!props.diagnosis) return "default"
  if (props.diagnosis.kind === "missing" || props.diagnosis.kind === "error") return "default"
  if (props.diagnosis.recommendation === "required") return "danger"
  if (props.diagnosis.recommendation === "recommended") return "warning"
  if (props.diagnosis.recommendation === "notRequired") return "success"
  return "default"
})

const icon = computed<IconKey>(() => {
  if (!props.diagnosis) return "helpCircleOutline"
  if (props.diagnosis.recommendation === "required") return "shieldAlert"
  if (props.diagnosis.recommendation === "recommended") return "shield"
  if (props.diagnosis.recommendation === "notRequired") return "shieldCheck"
  return "helpCircleOutline"
})

const recommendationLabel = computed(() => {
  if (!props.diagnosis) return props.i18n.manifestUnknown
  if (props.diagnosis.kind === "missing") return props.i18n.targetMissing
  if (props.diagnosis.kind === "error") return props.i18n.diagnosisFailed
  if (props.diagnosis.recommendation === "required") return props.i18n.required
  if (props.diagnosis.recommendation === "recommended") return props.i18n.recommended
  if (props.diagnosis.recommendation === "notRequired") return props.i18n.notRequired
  return props.i18n.manifestUnknown
})

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

const reasonText = computed(() => {
  if (!props.diagnosis) return ""
  if (props.diagnosis.kind === "missing") return props.i18n.reasonTargetMissing
  if (props.diagnosis.kind === "error") return props.i18n.reasonReadError
  switch (props.diagnosis.reasonCode) {
    case "manifestRequireAdministrator":
      return props.i18n.reasonRequireAdministrator
    case "manifestHighestAvailable":
      return props.i18n.reasonHighestAvailable
    case "manifestAsInvoker":
      return props.i18n.reasonAsInvoker
    case "manifestUiAccess":
      return props.i18n.reasonUiAccess
    case "manifestMissing":
      return props.i18n.reasonManifestMissing
    case "parseError":
      return props.i18n.reasonParseError
    default:
      return props.i18n.reasonReadError
  }
})

function formatSize(size: number): string {
  if (!size) return "—"
  try {
    return formatFileSize(size)
  } catch {
    return `${size} B`
  }
}

function formatTime(value: number): string {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return "—"
  }
}
</script>

<style lang="scss">
@use "../styles/DiagnosisReport.scss";
</style>
