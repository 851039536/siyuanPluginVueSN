<!-- 提权助手 - 工具列表 -->
<template>
  <div class="elevation-tools">
    <div class="elevation-tools__toolbar">
      <Button
        variant="primary"
        size="xsmall"
        icon="add"
        @click="emit('add')"
      >
        {{ i18n.addTool }}
      </Button>
      <Button
        variant="secondary"
        size="xsmall"
        icon="refresh"
        :loading="refreshing"
        @click="emit('refresh')"
      >
        {{ i18n.refreshAll }}
      </Button>
      <span class="elevation-tools__count">
        {{ i18n.toolCount }} {{ tools.length }}
      </span>
    </div>

    <div
      v-if="tools.length === 0"
      class="elevation-tools__empty"
    >
      <IconWrapper
        name="applicationBrackets"
        :size="44"
      />
      <p>{{ i18n.emptyTools }}</p>
      <Button
        variant="primary"
        size="small"
        icon="add"
        @click="emit('add')"
      >
        {{ i18n.addTool }}
      </Button>
    </div>

    <div
      v-else
      class="elevation-tools__list"
    >
      <Card
        v-for="tool in tools"
        :key="tool.id"
        variant="bordered"
        size="xsmall"
        class="elevation-tools__card"
      >
        <template #header>
          <div class="elevation-tools__card-head">
            <IconWrapper
              name="applicationBrackets"
              :size="16"
              class="elevation-tools__card-icon"
            />
            <span
              class="elevation-tools__card-name"
              :title="tool.name"
            >{{ tool.name }}</span>
            <Tag
              :variant="manifestVariant(tool.id)"
              size="xsmall"
              :icon="manifestIcon(tool.id)"
            >
              {{ manifestLabel(tool.id) }}
            </Tag>
          </div>
        </template>

        <div class="elevation-tools__card-body">
          <p
            class="elevation-tools__path"
            :title="tool.path"
          >{{ tool.path }}</p>
          <div class="elevation-tools__meta">
            <span>
              {{ i18n.shortcutCount }} {{ tool.shortcuts.length }}
              <template v-if="tool.shortcuts.length > 0">
                · {{ tool.shortcuts.some((item) => item.runAsAdmin) ? (i18n.adminMarked) : (i18n.noAdminMark) }}
              </template>
            </span>
            <span v-if="tool.lastRunAt">{{ i18n.lastRun }} {{ formatTime(tool.lastRunAt) }}</span>
          </div>
          <p
            v-if="diagnosisFor(tool.id)?.kind === 'missing'"
            class="elevation-tools__warning"
          >
            {{ i18n.targetMissing }}
          </p>
        </div>

        <template #footer>
          <div class="elevation-tools__actions">
            <Button
              variant="success"
              size="xsmall"
              icon="play"
              :title="i18n.runAsAdmin"
              :aria-label="i18n.runAsAdmin"
              :disabled="isBusy(tool.id) || diagnosisFor(tool.id)?.kind === 'missing'"
              @click="emit('run', tool)"
            />
            <Button
              variant="primary"
              size="xsmall"
              icon="shieldCheck"
              :title="i18n.createShortcut"
              :aria-label="i18n.createShortcut"
              :disabled="isBusy(tool.id)"
              @click="emit('create', tool)"
            />
            <Button
              variant="secondary"
              size="xsmall"
              icon="search"
              :title="i18n.diagnose"
              :aria-label="i18n.diagnose"
              :disabled="isBusy(tool.id)"
              @click="emit('diagnose', tool)"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="folder"
              :title="i18n.openLocation"
              :aria-label="i18n.openLocation"
              :disabled="isBusy(tool.id)"
              @click="emit('openFolder', tool)"
            />
            <Button
              variant="secondary"
              size="xsmall"
              icon="edit"
              :title="i18n.edit"
              :aria-label="i18n.edit"
              :disabled="isBusy(tool.id)"
              @click="emit('edit', tool)"
            />
            <Button
              variant="danger"
              size="xsmall"
              icon="delete"
              :title="i18n.delete"
              :aria-label="i18n.delete"
              :disabled="isBusy(tool.id)"
              @click="emit('delete', tool)"
            />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/components/kit/icons"
import type { ElevationTool, PermissionDiagnosis } from "../types"
import Button from "@/components/Button.vue"
import Card from "@/components/Card.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Tag from "@/components/Tag.vue"

interface Props {
  tools: ElevationTool[]
  i18n: Record<string, string>
  refreshing: boolean
  diagnosisFor: (toolId: string) => PermissionDiagnosis | undefined
  isBusy: (toolId: string) => boolean
}

interface Emits {
  (e: "add"): void
  (e: "refresh"): void
  (e: "edit", tool: ElevationTool): void
  (e: "delete", tool: ElevationTool): void
  (e: "diagnose", tool: ElevationTool): void
  (e: "create", tool: ElevationTool): void
  (e: "run", tool: ElevationTool): void
  (e: "openFolder", tool: ElevationTool): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function manifestVariant(toolId: string): "default" | "success" | "warning" | "danger" | "info" {
  const level = props.diagnosisFor(toolId)?.manifestLevel
  if (level === "requireAdministrator") return "danger"
  if (level === "highestAvailable") return "warning"
  if (level === "asInvoker") return "success"
  return "default"
}

function manifestIcon(toolId: string): IconKey {
  const level = props.diagnosisFor(toolId)?.manifestLevel
  if (level === "requireAdministrator") return "shieldAlert"
  if (level === "highestAvailable") return "shield"
  if (level === "asInvoker") return "shieldCheck"
  return "helpCircleOutline"
}

function manifestLabel(toolId: string): string {
  const diagnosis = props.diagnosisFor(toolId)
  if (!diagnosis) return props.i18n.diagnosing
  if (diagnosis.kind === "missing") return props.i18n.targetMissing
  if (diagnosis.kind === "error") return props.i18n.diagnosisFailed
  if (diagnosis.manifestLevel === "requireAdministrator") return props.i18n.manifestRequireAdministrator
  if (diagnosis.manifestLevel === "highestAvailable") return props.i18n.manifestHighestAvailable
  if (diagnosis.manifestLevel === "asInvoker") return props.i18n.manifestAsInvoker
  return props.i18n.manifestUnknown
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
@use "../styles/ElevationToolList.scss";
</style>
