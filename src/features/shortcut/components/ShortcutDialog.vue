<!-- 添加/编辑快捷键对话框：共享 Dialog 承载，四字段表单 + 必填校验 -->
<template>
  <Dialog
    :visible="visible"
    :header="title"
    size="small"
    :close-label="i18n.cancel"
    dismissable-mask
    class="shortcut-dialog"
    @update:visible="handleVisibleChange"
  >
    <div class="shortcut-dialog__body">
      <Input
        v-model="form.name"
        :label="i18n.shortcutName"
        :placeholder="i18n.enterName"
        :error="errors.name"
        size="small"
        @update:model-value="errors.name = ''"
      />
      <Input
        v-model="form.description"
        :label="i18n.description"
        :placeholder="i18n.enterDescription"
        size="small"
      />
      <Input
        v-model="form.keys"
        :label="i18n.shortcutKeys"
        :placeholder="i18n.keysPlaceholder"
        :error="errors.keys"
        size="small"
        @update:model-value="errors.keys = ''"
      />
      <Input
        v-model="form.group"
        :label="i18n.group"
        :placeholder="i18n.enterGroup"
        size="small"
      />
    </div>

    <template #footer>
      <Button
        variant="secondary"
        size="small"
        @click="$emit('close')"
      >
        {{ i18n.cancel }}
      </Button>
      <Button
        variant="primary"
        size="small"
        @click="handleConfirm"
      >
        {{ i18n.confirm }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type {
  ShortcutFormData,
  ShortcutInfo,
} from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Input from "@/components/Input.vue"
import { buildCustomShortcut } from "../utils"

interface Props {
  visible: boolean
  /** 编辑目标（为 null 表示新增，表单重置） */
  initial: ShortcutInfo | null
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  confirm: [shortcut: ShortcutInfo]
  error: [message: string]
}>()

const form = ref<ShortcutFormData>({
  id: "",
  name: "",
  description: "",
  keys: "",
  group: "",
})

const errors = ref({ name: "", keys: "" })

const title = computed(() =>
  props.initial ? props.i18n.editShortcut : props.i18n.addCustomShortcut,
)

// initial 变化时同步表单（新增传 null 重置，编辑回填）
watch(
  () => props.initial,
  (value) => {
    form.value = value
      ? {
          id: value.id,
          name: value.name,
          description: value.description,
          keys: value.keys,
          group: value.group || props.i18n.customShortcuts,
        }
      : {
          id: "",
          name: "",
          description: "",
          keys: "",
          group: props.i18n.customShortcuts,
        }
    errors.value = { name: "", keys: "" }
  },
  { immediate: true },
)

/** 关闭请求（Esc / 遮罩 / 右上角关闭按钮）统一转为 close */
function handleVisibleChange(value: boolean): void {
  if (!value) {
    emit("close")
  }
}

function handleConfirm(): void {
  const name = form.value.name.trim()
  const keys = form.value.keys.trim()
  errors.value = {
    name: name ? "" : props.i18n.fillRequired,
    keys: keys ? "" : props.i18n.fillRequired,
  }

  if (!name || !keys) {
    emit("error", props.i18n.fillRequired)
    return
  }

  emit("confirm", buildCustomShortcut(form.value, props.i18n.customShortcuts))
}
</script>

<style scoped lang="scss">
@use "../styles/ShortcutDialog.scss";
</style>
