<!-- 提权助手 - 扫描本机程序并批量加入工具列表 -->
<template>
  <Dialog
    :visible="visible"
    :header="i18n.scanTitle"
    size="large"
    :close-label="i18n.cancel"
    @update:visible="handleVisibleChange"
  >
    <div class="elevation-scan">
      <p class="elevation-scan__desc">
        {{ i18n.scanDescription }}
      </p>

      <div
        v-if="scanning"
        class="elevation-scan__status"
      >
        {{ i18n.scanning }}
      </div>
      <p
        v-else-if="error"
        class="elevation-scan__error"
      >
        {{ error }}
      </p>
      <template v-else-if="outcome && outcome.ok">
        <div class="elevation-scan__meta">
          <span>{{ i18n.scanSelected }} {{ selected.length }}</span>
          <span v-if="outcome.truncated">{{ i18n.scanTruncated }}</span>
        </div>
        <Listbox
          :model-value="selected"
          :options="options"
          multiple
          checkbox
          filter
          :filter-placeholder="i18n.scanFilterPlaceholder"
          :empty-text="i18n.scanEmpty"
          size="xsmall"
          :max-height="340"
          :aria-label="i18n.scanTitle"
          @update:model-value="handleSelection"
        >
          <template #option="{ option }">
            <span class="elevation-scan__option">
              <span
                class="elevation-scan__name"
                :title="String(option.value)"
              >{{ option.label }}</span>
              <Tag
                variant="default"
                size="xsmall"
              >
                {{ sourceLabel(option.source) }}
              </Tag>
            </span>
          </template>
        </Listbox>
        <p
          v-if="outcome.warnings.length > 0"
          class="elevation-scan__warning"
        >
          {{ i18n.scanWarning }} {{ outcome.warnings.length }}
        </p>
      </template>
      <div
        v-else
        class="elevation-scan__status"
      >
        {{ i18n.scanEmpty }}
      </div>
    </div>

    <template #footer>
      <div class="elevation-scan__footer">
        <Button
          variant="secondary"
          size="xsmall"
          :disabled="scanning || options.length === 0"
          @click="handleSelectAll"
        >
          {{ i18n.scanSelectAll }}
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="scanning || selected.length === 0"
          @click="handleClear"
        >
          {{ i18n.scanClear }}
        </Button>
        <Button
          variant="secondary"
          size="xsmall"
          icon="refresh"
          :loading="scanning"
          @click="emit('scan')"
        >
          {{ i18n.scanRefresh }}
        </Button>
        <Button
          variant="primary"
          size="xsmall"
          icon="add"
          :loading="adding"
          :disabled="selected.length === 0 || scanning"
          @click="emit('add', [...selected])"
        >
          {{ i18n.scanAddSelected }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type {
  ProgramScanOutcome,
  ProgramScanSource,
} from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Listbox from "@/components/Listbox.vue"
import Tag from "@/components/Tag.vue"

interface Props {
  visible: boolean
  i18n: Record<string, string>
  outcome: ProgramScanOutcome | null
  scanning: boolean
  adding: boolean
  /** 已在工具列表中的路径（小写比较）：禁用勾选，避免重复添加 */
  existingPaths: string[]
  error?: string
}

interface Emits {
  (e: "update:visible", visible: boolean): void
  (e: "scan"): void
  (e: "add", paths: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selected = ref<string[]>([])

const existingSet = computed(() => new Set(props.existingPaths.map((path) => path.toLowerCase())))

const options = computed(() => {
  if (!props.outcome?.ok) return []
  return props.outcome.programs.map((program) => ({
    value: program.path,
    label: `${program.name} · ${program.path}`,
    keywords: `${program.name} ${program.path}`,
    disabled: existingSet.value.has(program.path.toLowerCase()),
    source: program.source,
  }))
})

watch(() => props.visible, (visible) => {
  if (visible) selected.value = []
})

watch(() => props.outcome, () => {
  selected.value = []
})

function sourceLabel(source: ProgramScanSource): string {
  switch (source) {
    case "startMenu":
      return props.i18n.scanSourceStartMenu
    case "desktop":
      return props.i18n.scanSourceDesktop
    case "appPaths":
      return props.i18n.scanSourceAppPaths
    default:
      return props.i18n.scanSourceProcess
  }
}

function handleSelection(value: unknown): void {
  selected.value = Array.isArray(value) ? value.map(String) : []
}

function handleSelectAll(): void {
  selected.value = options.value
    .filter((option) => !option.disabled)
    .map((option) => String(option.value))
}

function handleClear(): void {
  selected.value = []
}

function handleVisibleChange(visible: boolean): void {
  emit("update:visible", visible)
}
</script>

<style lang="scss">
@use "../styles/ProgramScanDialog.scss";
</style>
