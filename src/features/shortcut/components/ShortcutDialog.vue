<!-- 添加/编辑快捷键的模态对话框，含名称/描述/按键/分组四个输入字段 -->
<template>
  <div
    v-if="visible"
    class="shortcut-dialog-overlay"
    @click="$emit('close')"
  >
    <div
      class="shortcut-dialog"
      role="dialog"
      aria-modal="true"
      @click.stop
    >
      <!-- 标题栏 -->
      <div class="dialog-header">
        <div class="dialog-title">
          {{ title }}
        </div>
        <Button
          variant="ghost"
          size="xsmall"
          icon="close"
          @click="$emit('close')"
        />
      </div>
      <!-- 表单区 -->
      <div class="dialog-body">
        <!-- 快捷键名称 -->
        <Input
          v-model="localFormData.name"
          :label="i18n.shortcutName"
          :placeholder="i18n.enterName"
          size="small"
        />
        <!-- 功能描述 -->
        <Input
          v-model="localFormData.description"
          :label="i18n.description"
          :placeholder="i18n.enterDescription"
          size="small"
        />
        <!-- 按键组合 -->
        <Input
          v-model="localFormData.keys"
          :label="i18n.shortcutKeys"
          :placeholder="i18n.keysPlaceholder"
          size="small"
        />
        <!-- 分组 -->
        <Input
          v-model="localFormData.group"
          :label="i18n.group"
          :placeholder="i18n.enterGroup"
          size="small"
        />
      </div>
      <!-- 底部操作栏 -->
      <div class="dialog-footer">
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
      </div>
    </div>
  </div>
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
import Input from "@/components/Input.vue"

interface Props {
  visible: boolean
  isEdit: boolean
  initial: ShortcutInfo | null
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  confirm: [shortcut: ShortcutInfo]
  error: [message: string]
}>()

const localFormData = ref<ShortcutFormData>({
  id: "",
  name: "",
  description: "",
  keys: "",
  group: props.i18n.customShortcuts,
})

// initial 变化时同步表单（新增传 null 重置，编辑回填）
watch(
  () => props.initial,
  (val) => {
    localFormData.value = val
      ? {
          id: val.id,
          name: val.name,
          description: val.description,
          keys: val.keys,
          group: val.group || props.i18n.customShortcuts,
        }
      : {
          id: "",
          name: "",
          description: "",
          keys: "",
          group: props.i18n.customShortcuts,
        }
  },
  { immediate: true },
)

const title = computed(() =>
  props.isEdit ? props.i18n.editShortcut : props.i18n.addCustomShortcut,
)

function handleConfirm() {
  if (!localFormData.value.name || !localFormData.value.keys) {
    emit("error", props.i18n.fillRequired)
    return
  }

  const shortcut: ShortcutInfo = {
    id: localFormData.value.id || `custom_${Date.now()}`,
    name: localFormData.value.name,
    description: localFormData.value.description,
    keys: localFormData.value.keys,
    category: "custom",
    group: localFormData.value.group || props.i18n.customShortcuts,
  }

  emit("confirm", shortcut)
}
</script>

<style lang="scss" scoped>
@use "../styles/ShortcutDialog.scss";
</style>
