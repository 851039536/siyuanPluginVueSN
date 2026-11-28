<!-- 提权助手 - 权限诊断面板 -->
<template>
  <div class="elevation-diagnostics">
    <div class="elevation-diagnostics__target">
      <Select
        :options="targetOptions"
        :model-value="selectedValue"
        size="xsmall"
        :aria-label="i18n.diagnoseTarget"
        @update:model-value="handleSelect"
      />
      <div
        v-if="!selectedTool"
        class="elevation-diagnostics__free"
      >
        <Input
          v-model="freePath"
          size="xsmall"
          :placeholder="i18n.targetPathPlaceholder"
          @update:model-value="handleFreePathInput"
          @keydown.enter="handleDetectFree"
        />
        <Button
          variant="secondary"
          size="xsmall"
          icon="folder"
          :title="i18n.browse"
          @click="handleBrowseFree"
        />
        <Button
          variant="primary"
          size="xsmall"
          icon="search"
          :loading="diagnosing"
          @click="handleDetectFree"
        >
          {{ i18n.detect }}
        </Button>
      </div>
    </div>

    <div
      v-if="targetPath"
      class="elevation-diagnostics__path"
      :title="targetPath"
    >
      {{ targetPath }}
    </div>

    <div
      v-if="diagnosing"
      class="elevation-diagnostics__empty"
    >
      {{ i18n.diagnosing }}
    </div>
    <DiagnosisReport
      v-else-if="diagnosis"
      :diagnosis="diagnosis"
      :i18n="i18n"
    />
    <div
      v-else
      class="elevation-diagnostics__empty"
    >
      {{ i18n.diagnoseEmpty }}
    </div>

    <div
      v-if="selectedTool"
      class="elevation-diagnostics__actions"
    >
      <Button
        variant="primary"
        size="xsmall"
        icon="shieldCheck"
        :disabled="isBusy(selectedTool.id)"
        @click="emit('createShortcut', selectedTool)"
      >
        {{ i18n.createShortcut }}
      </Button>
      <Button
        variant="success"
        size="xsmall"
        icon="play"
        :disabled="isBusy(selectedTool.id)"
        @click="emit('run', selectedTool)"
      >
        {{ i18n.runAsAdmin }}
      </Button>
      <Button
        variant="secondary"
        size="xsmall"
        icon="refresh"
        :loading="isDiagnosing(selectedTool.id)"
        @click="emit('refresh', selectedTool)"
      >
        {{ i18n.redetect }}
      </Button>
    </div>

    <Button
      v-else-if="freePath.trim() && diagnosis"
      variant="primary"
      size="xsmall"
      icon="add"
      @click="emit('addTool', freePath.trim())"
    >
      {{ i18n.addAsTool }}
    </Button>

    <Card
      v-if="selectedTool && selectedTool.shortcuts.length > 0"
      variant="bordered"
      size="xsmall"
      class="elevation-diagnostics__shortcuts"
    >
      <template #header>
        <span class="elevation-diagnostics__shortcuts-title">
          {{ i18n.shortcutStatus }}
        </span>
      </template>
      <div class="elevation-diagnostics__shortcut-list">
        <div
          v-for="record in selectedTool.shortcuts"
          :key="record.path"
          class="elevation-diagnostics__shortcut"
        >
          <div class="elevation-diagnostics__shortcut-main">
            <span
              class="elevation-diagnostics__shortcut-path"
              :title="record.path"
            >{{ record.path }}</span>
            <div class="elevation-diagnostics__shortcut-tags">
              <Tag
                :variant="shortcutTagVariant(shortcutStatusFor(record.path))"
                size="xsmall"
              >
                {{ shortcutTagLabel(shortcutStatusFor(record.path)) }}
              </Tag>
              <Tag
                :variant="record.runAsAdmin ? 'warning' : 'default'"
                size="xsmall"
                :icon="record.runAsAdmin ? 'shieldCheck' : 'shield'"
              >
                {{ record.runAsAdmin ? (i18n.adminMarked) : (i18n.noAdminMark) }}
              </Tag>
            </div>
          </div>
          <div class="elevation-diagnostics__shortcut-actions">
            <Button
              variant="ghost"
              size="xsmall"
              icon="folder"
              :title="i18n.openLocation"
              @click="emit('openFolder', record.path)"
            />
            <Button
              variant="danger"
              size="xsmall"
              icon="delete"
              :title="i18n.delete"
              @click="emit('deleteShortcut', selectedTool.id, record.path)"
            />
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import type {
  ElevationTool,
  PermissionDiagnosis,
  ShortcutStatus,
} from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Card from "@/components/Card.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Tag from "@/components/Tag.vue"
import { pickFiles } from "@/utils/electronDialog"
import DiagnosisReport from "./DiagnosisReport.vue"

interface Props {
  tools: ElevationTool[]
  selectedTool: ElevationTool | null
  targetPath: string
  diagnosis: PermissionDiagnosis | null
  diagnosing: boolean
  i18n: Record<string, string>
  shortcutStatusFor: (path: string) => ShortcutStatus | undefined
  isBusy: (toolId: string) => boolean
  isDiagnosing: (toolId: string) => boolean
}

interface Emits {
  (e: "selectTool", toolId: string | null): void
  (e: "diagnose", path: string): void
  (e: "update:path", path: string): void
  (e: "addTool", path: string): void
  (e: "createShortcut", tool: ElevationTool): void
  (e: "run", tool: ElevationTool): void
  (e: "openFolder", path: string): void
  (e: "deleteShortcut", toolId: string, path: string): void
  (e: "refresh", tool: ElevationTool): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const freePath = ref(props.targetPath)

watch(() => props.targetPath, (value) => {
  if (!props.selectedTool) freePath.value = value
})

const selectedValue = computed(() => props.selectedTool?.id || "__free__")

const targetOptions = computed(() => [
  ...props.tools.map((tool) => ({
    label: tool.name,
    value: tool.id,
  })),
  {
    label: props.i18n.tempDetect,
    value: "__free__",
  },
])

/** 未检测 / 存在 / 已丢失 / 文件无效 / 无法检测 分别给出颜色与文案 */
function shortcutTagVariant(status: ShortcutStatus | undefined): "default" | "success" | "warning" | "danger" {
  if (!status || status.state === "unknown") return "default"
  if (status.state === "exists" && status.valid) return "success"
  if (status.state === "missing") return "danger"
  return "warning"
}

function shortcutTagLabel(status: ShortcutStatus | undefined): string {
  if (!status || status.state === "unknown") return props.i18n.shortcutUnknown
  if (status.state === "exists") return props.i18n.shortcutExists
  if (status.state === "missing") return props.i18n.shortcutMissing
  if (status.state === "invalid") return props.i18n.shortcutInvalid
  return props.i18n.shortcutUncheckable
}

function handleSelect(value: string | number): void {
  if (value === "__free__") {
    emit("selectTool", null)
    return
  }
  emit("selectTool", String(value))
}

/** 路径改动立即通知父组件清空旧诊断，避免「报告张冠李戴」 */
function handleFreePathInput(value: string | number | null): void {
  if (props.selectedTool) return
  freePath.value = value === null ? "" : String(value)
  emit("update:path", freePath.value)
}

function handleDetectFree(): void {
  if (!freePath.value.trim()) return
  emit("diagnose", freePath.value.trim())
}

async function handleBrowseFree(): Promise<void> {
  const paths = await pickFiles(
    props.i18n.browseTitle,
    [{
      name: props.i18n.exeFilterName,
      extensions: ["exe"],
    }],
  )
  const picked = paths?.[0]
  if (!picked) return
  freePath.value = picked
  emit("update:path", picked)
  emit("diagnose", picked)
}
</script>

<style lang="scss">
@use "../styles/DiagnosticsPanel.scss";
</style>
