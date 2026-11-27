<!-- 提权助手 - 当前进程权限卡 -->
<template>
  <Card
    variant="bordered"
    size="xsmall"
    class="elevation-privilege"
  >
    <div class="elevation-privilege__head">
      <IconWrapper
        name="shieldCheck"
        :size="18"
        class="elevation-privilege__icon"
      />
      <span class="elevation-privilege__title">{{ i18n.privilegeTitle }}</span>
      <Tag
        :variant="statusVariant"
        size="xsmall"
        :icon="statusIcon"
      >
        {{ statusText }}
      </Tag>
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        :title="i18n.privilegeRefresh"
        :aria-label="i18n.privilegeRefresh"
        :loading="loading"
        @click="emit('refresh')"
      />
    </div>

    <div
      v-if="loading && !result"
      class="elevation-privilege__loading"
    >
      {{ i18n.privilegeLoading }}
    </div>

    <div
      v-else-if="!result"
      class="elevation-privilege__empty"
    >
      {{ i18n.privilegeUnknown }}
    </div>

    <div
      v-else-if="!result.ok"
      class="elevation-privilege__error"
    >
      <span>{{ failureText }}</span>
      <span
        v-if="result.message"
        class="elevation-privilege__detail"
        :title="result.message"
      >{{ result.message }}</span>
    </div>

    <template v-else>
      <div class="elevation-privilege__grid">
        <div class="elevation-privilege__item">
          <span class="elevation-privilege__label">{{ i18n.privilegeIntegrity }}</span>
          <span class="elevation-privilege__value">{{ integrityText }}</span>
        </div>
        <div class="elevation-privilege__item">
          <span class="elevation-privilege__label">{{ i18n.privilegeUac }}</span>
          <span class="elevation-privilege__value">{{ uacText }}</span>
        </div>
        <div class="elevation-privilege__item">
          <span class="elevation-privilege__label">{{ i18n.privilegeAccount }}</span>
          <span
            class="elevation-privilege__value"
            :title="result.status.user"
          >{{ result.status.user || "—" }}</span>
        </div>
        <div class="elevation-privilege__item">
          <span class="elevation-privilege__label">{{ i18n.privilegeProcess }}</span>
          <span
            class="elevation-privilege__value elevation-privilege__value--mono"
            :title="processText"
          >{{ processText }}</span>
        </div>
      </div>
      <p class="elevation-privilege__hint">
        {{ hintText }}
      </p>
    </template>
  </Card>
</template>

<script setup lang="ts">
import type { PrivilegeResult } from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Card from "@/components/Card.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Tag from "@/components/Tag.vue"

interface Props {
  result: PrivilegeResult | null
  loading: boolean
  i18n: Record<string, string>
}

interface Emits {
  (e: "refresh"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const statusText = computed(() => {
  if (!props.result?.ok) return props.i18n.privilegeUnknown
  return props.result.status.isAdmin
    ? (props.i18n.privilegeAdmin)
    : (props.i18n.privilegeStandard)
})

const statusVariant = computed(() => {
  if (!props.result?.ok) return "default"
  return props.result.status.isAdmin ? "success" : "warning"
})

const statusIcon = computed(() => {
  if (!props.result?.ok) return "helpCircleOutline"
  return props.result.status.isAdmin ? "shieldCheck" : "shield"
})

const integrityText = computed(() => {
  if (!props.result?.ok) return "—"
  const map: Record<string, string> = {
    low: props.i18n.integrityLow,
    medium: props.i18n.integrityMedium,
    mediumPlus: props.i18n.integrityMediumPlus,
    high: props.i18n.integrityHigh,
    system: props.i18n.integritySystem,
    protected: props.i18n.integrityProtected,
    unknown: props.i18n.integrityUnknown,
  }
  return map[props.result.status.integrity] || map.unknown
})

const uacText = computed(() => {
  if (!props.result?.ok) return "—"
  if (props.result.status.uacEnabled === null) return props.i18n.uacUnknown
  return props.result.status.uacEnabled
    ? (props.i18n.uacEnabled)
    : (props.i18n.uacDisabled)
})

const processText = computed(() => {
  if (typeof process === "undefined") return "—"
  const exe = process.execPath || ""
  return `${process.pid} · ${exe}`
})

const failureText = computed(() => {
  if (!props.result || props.result.ok) return ""
  if (props.result.kind === "env") return props.i18n.envNotSupported
  if (props.result.kind === "timeout") return props.i18n.privilegeTimeout
  return props.i18n.privilegeError
})

const hintText = computed(() => {
  if (!props.result?.ok) return ""
  if (props.result.status.isAdmin) {
    return props.i18n.privilegeAdminHint
  }
  if (props.result.status.uacEnabled === false) {
    return props.i18n.privilegeUacOffHint
  }
  return props.i18n.privilegeStandardHint
})
</script>

<style lang="scss">
@use "../styles/PrivilegeStatusCard.scss";
</style>
