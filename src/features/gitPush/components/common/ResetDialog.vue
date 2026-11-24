<!-- gitPush 重置当前分支弹窗：三种模式说明 + hard 受影响文件 + 自动备份提示 -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="onMaskClick"
    >
      <div class="gp-dialog gp-reset-dialog">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.resetTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            :disabled="busy"
            @click="emit('close')"
          >
            <Icon
              icon="mdi:close"
              height="10"
            />
          </button>
        </div>

        <div class="gp-dialog-body">
          <div
            v-if="loading"
            class="gp-loading"
          >
            <Loader />
          </div>

          <template v-else>
            <!-- 目标提交（hash 可点击复制） -->
            <div class="gp-reset-meta">
              <span class="gp-label">{{ i18n.resetTargetLabel }}</span>
              <span
                class="gp-reset-hash"
                role="button"
                tabindex="0"
                :title="i18n.copyHash"
                :aria-label="i18n.copyHash"
                @click="copyHash"
                @keydown.enter.prevent="copyHash"
                @keydown.space.prevent="copyHash"
              >{{ copied ? i18n.copied : target.hash }}</span>
            </div>
            <pre class="gp-reset-message">{{ target.message }}</pre>

            <!-- 模式选择 -->
            <div class="gp-reset-modes">
              <span class="gp-label">{{ i18n.resetModeLabel }}</span>
              <div
                v-for="item in MODES"
                :key="item.value"
                class="gp-reset-mode"
                :class="{ active: mode === item.value }"
              >
                <RadioButton
                  binary
                  name="gp-reset-mode"
                  size="xsmall"
                  :model-value="mode === item.value"
                  :label="item.label"
                  :disabled="busy || done"
                  @update:model-value="onModeChange(item.value)"
                />
                <span class="gp-reset-mode-hint">{{ item.hint }}</span>
              </div>
            </div>

            <!-- hard：受影响的已跟踪文件 -->
            <div
              v-if="mode === 'hard'"
              class="gp-reset-warning"
            >
              <template v-if="affectedFiles.length > 0">
                <div class="gp-reset-warning-title">
                  <Icon
                    icon="mdi:alert-circle-outline"
                    height="12"
                  />
                  <span>{{ i18n.resetHardWarning }}</span>
                </div>
                <ul class="gp-reset-files">
                  <li
                    v-for="file in visibleFiles"
                    :key="file.path"
                    :title="file.path"
                  >{{ file.path }}</li>
                </ul>
                <span
                  v-if="affectedFiles.length > visibleFiles.length"
                  class="gp-reset-more"
                >{{ fmt(i18n.resetHardWarningMore, affectedFiles.length - visibleFiles.length) }}</span>
              </template>
              <div
                v-else
                class="gp-reset-warning-title"
              >
                <Icon
                  icon="mdi:information-outline"
                  height="12"
                />
                <span>{{ i18n.resetHardNoChanges }}</span>
              </div>
              <div class="gp-reset-backup-hint">{{ i18n.resetBackupHint }}</div>
            </div>

            <!-- 完成态：展示备份路径 -->
            <div
              v-if="done"
              class="gp-reset-done"
            >
              <Icon
                icon="mdi:check-circle-outline"
                height="14"
              />
              <span>{{ i18n.resetDone }}</span>
              <span
                v-if="backupPath"
                class="gp-reset-backup-path"
                :title="backupPath"
              >{{ backupPath }}</span>
            </div>

            <div
              v-if="error"
              class="gp-reset-error"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                height="12"
              />
              <span>{{ error }}</span>
            </div>
          </template>
        </div>

        <div class="gp-dialog-footer">
          <div class="gp-grow" />
          <button
            v-if="!done"
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="busy"
            @click="emit('close')"
          >
            {{ i18n.cancel }}
          </button>
          <button
            v-if="done"
            class="vp-btn vp-btn--primary vp-btn--sm"
            @click="emit('close')"
          >
            {{ i18n.done }}
          </button>
          <button
            v-else
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="loading || busy"
            @click="applyReset"
          >
            <Icon
              :icon="busy ? 'mdi:loading' : 'mdi:history'"
              height="12"
              :class="{ 'gp-spin': busy }"
            />
            <span>{{ i18n.resetConfirm }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 重置弹窗：模式选择 + hard 影响面提示（列出会被丢弃的已跟踪改动）
import type { FileChange } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, inject, onMounted, onUnmounted, ref } from "vue"
import Loader from "@/components/Loader.vue"
import RadioButton from "@/components/RadioButton.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { getErrorMessage } from "@/utils/stringUtils"
import { CARD_SERVICES_KEY } from "../../types"
import type { ResetMode } from "../../types/undo"
import { useCopyFeedback } from "../../composables/useCopyFeedback"
import { fmtTemplate } from "../../utils/i18nFormat"

const props = defineProps<{
  i18n: Record<string, any>
  projectPath: string
  target: { hash: string, message: string }
}>()

const emit = defineEmits<{
  close: []
  /** 重置已生效（父层刷新历史/工作区，并挂撤销 Toast） */
  saved: []
}>()

const services = inject(CARD_SERVICES_KEY)!

/** hard 提示最多列出的文件数（其余以计数概括） */
const MAX_LISTED_FILES = 20

const mode = ref<ResetMode>("soft")
const loading = ref(true)
const busy = ref(false)
const done = ref(false)
const error = ref("")
const backupPath = ref("")
const affectedFiles = ref<FileChange[]>([])

const {
  copied,
  notifyCopied,
} = useCopyFeedback()

const MODES = computed(() => [
  { value: "soft" as const, label: props.i18n.resetModeSoft, hint: props.i18n.resetModeSoftHint },
  { value: "mixed" as const, label: props.i18n.resetModeMixed, hint: props.i18n.resetModeMixedHint },
  { value: "hard" as const, label: props.i18n.resetModeHard, hint: props.i18n.resetModeHardHint },
])

const visibleFiles = computed(() => affectedFiles.value.slice(0, MAX_LISTED_FILES))

function fmt(template: string, n: number): string {
  return fmtTemplate(template, n)
}

async function copyHash() {
  const ok = await copyToClipboard(props.target.hash)
  if (ok) notifyCopied()
}

function onModeChange(value: ResetMode) {
  if (busy.value || done.value) return
  mode.value = value
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && !busy.value) emit("close")
}

function onMaskClick() {
  if (!busy.value) emit("close")
}

async function applyReset() {
  busy.value = true
  error.value = ""
  try {
    const result = await services.manager.resetTo(props.projectPath, mode.value, props.target.hash)
    backupPath.value = result.backupPath ?? ""
    done.value = true
    emit("saved")
  } catch (e: unknown) {
    error.value = getErrorMessage(e) || props.i18n.resetFailed
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  window.addEventListener("keydown", handleKeydown)
  try {
    const tree = await services.manager.getWorkingTreeStatus(props.projectPath)
    // 未跟踪文件不受 reset --hard 影响，不列入「会被丢弃」清单
    affectedFiles.value = tree.files.filter((f) => f.status !== "untracked")
  } catch {
    // 读取失败不阻断重置：影响面提示退化为「无法列出」，硬重置本身仍受 git 保护
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})
</script>

<style lang="scss">
@use "../../styles/ResetDialog.scss";
@use "../../styles/index.scss";
</style>
