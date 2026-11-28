<!-- 提权助手 - 添加/编辑工具 -->
<template>
  <Dialog
    :visible="visible"
    :header="editing ? (i18n.editTool) : (i18n.addTool)"
    size="medium"
    :close-label="i18n.cancel"
    @update:visible="handleVisibleChange"
  >
    <div class="elevation-editor">
      <FormField
        :label="i18n.targetPath"
        :hint="i18n.targetPathHint"
        size="xsmall"
      >
        <div class="elevation-editor__row">
          <Input
            v-model="draft.path"
            size="xsmall"
            :placeholder="i18n.targetPathPlaceholder"
            @blur="handlePathBlur"
            @input="emit('pathChange')"
          />
          <Button
            variant="secondary"
            size="xsmall"
            icon="folder"
            :title="i18n.browse"
            @click="handleBrowseFile"
          />
          <Button
            variant="ghost"
            size="xsmall"
            icon="search"
            :title="i18n.diagnose"
            :loading="diagnosing"
            @click="handleDiagnose"
          />
        </div>
      </FormField>

      <div
        v-if="diagnosing"
        class="elevation-editor__diagnosis"
      >
        {{ i18n.diagnosing }}
      </div>
      <div
        v-else-if="diagnosis"
        class="elevation-editor__diagnosis"
      >
        <Tag
          :variant="view.variant"
          size="xsmall"
          :icon="view.icon"
        >
          {{ view.label }}
        </Tag>
        <span class="elevation-editor__diagnosis-text">{{ view.reason }}</span>
      </div>

      <FormField
        :label="i18n.name"
        size="xsmall"
        :hint="i18n.nameHint"
      >
        <Input
          v-model="draft.name"
          size="xsmall"
          :placeholder="i18n.namePlaceholder"
          @input="nameTouched = true"
        />
      </FormField>

      <FormField
        :label="i18n.arguments"
        size="xsmall"
        :hint="i18n.argumentsHint"
      >
        <Input
          v-model="draft.args"
          size="xsmall"
          :placeholder="i18n.argumentsPlaceholder"
        />
      </FormField>

      <FormField
        :label="i18n.workingDir"
        size="xsmall"
        :hint="i18n.workingDirHint"
      >
        <div class="elevation-editor__row">
          <Input
            v-model="draft.workingDir"
            size="xsmall"
            :placeholder="i18n.workingDirPlaceholder"
            @input="workingDirTouched = true"
          />
          <Button
            variant="secondary"
            size="xsmall"
            icon="folder"
            :title="i18n.browse"
            @click="handleBrowseWorkingDir"
          />
        </div>
      </FormField>

      <div class="elevation-editor__admin">
        <Switch
          v-model="draft.requireAdmin"
          size="xsmall"
          :label="i18n.requireAdmin"
          @change="adminTouched = true"
        />
        <p class="elevation-editor__hint">
          {{ i18n.requireAdminHint }}
        </p>
        <p
          v-if="diagnosis?.requiresAdmin && !draft.requireAdmin"
          class="elevation-editor__warning"
        >
          {{ i18n.requireAdminWarning }}
        </p>
      </div>

      <FormField
        :label="i18n.shortcutLocation"
        size="xsmall"
      >
        <Select
          v-model="draft.location"
          :options="locationOptions"
          size="xsmall"
        />
      </FormField>

      <FormField
        v-if="draft.location === 'custom'"
        :label="i18n.customDir"
        size="xsmall"
      >
        <div class="elevation-editor__row">
          <Input
            v-model="draft.customDir"
            size="xsmall"
            :placeholder="i18n.customDirPlaceholder"
          />
          <Button
            variant="secondary"
            size="xsmall"
            icon="folder"
            :title="i18n.browse"
            @click="handleBrowseCustomDir"
          />
        </div>
      </FormField>

      <p
        v-if="error"
        class="elevation-editor__error"
      >
        {{ error }}
      </p>
    </div>

    <template #footer>
      <div class="elevation-editor__footer">
        <Button
          variant="secondary"
          size="xsmall"
          :disabled="saving"
          @click="handleSave(false)"
        >
          {{ i18n.saveOnly }}
        </Button>
        <Button
          variant="primary"
          size="xsmall"
          icon="shieldCheck"
          :loading="saving"
          @click="handleSave(true)"
        >
          {{ i18n.saveAndCreate }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type {
  PermissionDiagnosis,
  ToolDraft,
} from "../types"
import {
  computed,
  reactive,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import FormField from "@/components/FormField.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"
import Tag from "@/components/Tag.vue"
import {
  pickDirectory,
  pickFiles,
} from "@/utils/electronDialog"
import { presentDiagnosis } from "../utils/diagnosisView"
import { suggestToolName } from "../utils/shortcut"
import {
  defaultWorkingDir,
  normalizeTargetPath,
} from "../utils/validation"

interface Props {
  visible: boolean
  i18n: Record<string, string>
  initial: ToolDraft
  editing: boolean
  diagnosis: PermissionDiagnosis | null
  /** diagnosis 对应的目标路径；与当前输入不一致时不套用推荐值 */
  diagnosisPath?: string
  diagnosing: boolean
  saving: boolean
  error?: string
}

interface Emits {
  (e: "update:visible", visible: boolean): void
  (e: "save", draft: ToolDraft, createShortcut: boolean): void
  (e: "diagnose", path: string): void
  (e: "pathChange"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const draft = reactive<ToolDraft>({ ...props.initial })
const nameTouched = ref(false)
const workingDirTouched = ref(false)
const adminTouched = ref(false)

function reset(): void {
  Object.assign(draft, props.initial)
  nameTouched.value = false
  workingDirTouched.value = false
  adminTouched.value = false
}

watch(() => props.visible, (visible) => {
  if (visible) reset()
})

watch(() => props.diagnosis, (diagnosis) => {
  if (!diagnosis) return
  // 旧路径的诊断不能改写当前表单（用户可能在检测期间改了路径）
  const diagnosedPath = normalizeTargetPath(props.diagnosisPath || "")
  if (diagnosedPath && diagnosedPath !== normalizeTargetPath(draft.path)) return
  if (!adminTouched.value) draft.requireAdmin = diagnosis.recommendedElevate
  if (!nameTouched.value) draft.name = suggestToolName(draft.path, props.i18n.defaultToolName)
  if (!workingDirTouched.value) draft.workingDir = defaultWorkingDir(draft.path)
})

const view = computed(() => presentDiagnosis(props.diagnosis, props.i18n))

const locationOptions = computed(() => [
  {
    label: props.i18n.locationDesktop,
    value: "desktop",
  },
  {
    label: props.i18n.locationPrograms,
    value: "programs",
  },
  {
    label: props.i18n.locationCustom,
    value: "custom",
  },
])

function handleVisibleChange(visible: boolean): void {
  emit("update:visible", visible)
}

function handlePathBlur(): void {
  if (!draft.path.trim()) return
  emit("diagnose", draft.path)
}

function handleDiagnose(): void {
  if (!draft.path.trim()) return
  emit("diagnose", draft.path)
}

async function handleBrowseFile(): Promise<void> {
  const paths = await pickFiles(
    props.i18n.browseTitle,
    [{
      name: props.i18n.exeFilterName,
      extensions: ["exe"],
    }],
  )
  const picked = paths?.[0]
  if (!picked) return
  draft.path = picked
  if (!nameTouched.value) draft.name = suggestToolName(picked, props.i18n.defaultToolName)
  if (!workingDirTouched.value) draft.workingDir = defaultWorkingDir(picked)
  emit("diagnose", picked)
}

async function handleBrowseWorkingDir(): Promise<void> {
  const dir = await pickDirectory(props.i18n.browseTitle)
  if (!dir) return
  draft.workingDir = dir
  workingDirTouched.value = true
}

async function handleBrowseCustomDir(): Promise<void> {
  const dir = await pickDirectory(props.i18n.browseTitle)
  if (!dir) return
  draft.customDir = dir
}

function handleSave(createShortcut: boolean): void {
  emit("save", { ...draft }, createShortcut)
}
</script>

<style lang="scss">
@use "../styles/ToolEditorDialog.scss";
</style>
