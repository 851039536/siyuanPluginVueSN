<template>
  <div
    v-if="visible"
    class="shortcut-dialog-overlay"
    @click="$emit('close')"
  >
    <div
      class="shortcut-dialog"
      @click.stop
    >
      <div class="dialog-header">
        <div class="dialog-title">
          {{ title }}
        </div>
        <Button
          variant="ghost"
          size="small"
          icon="close"
          @click="$emit('close')"
        />
      </div>
      <div class="dialog-body">
        <Input
          v-model="localFormData.name"
          :label="nameLabel"
          :placeholder="namePlaceholder"
        />
        <Input
          v-model="localFormData.description"
          :label="descLabel"
          :placeholder="descPlaceholder"
        />
        <Input
          v-model="localFormData.keys"
          :label="keysLabel"
          :placeholder="keysPlaceholder"
        />
        <Input
          v-model="localFormData.group"
          :label="groupLabel"
          :placeholder="groupPlaceholder"
        />
      </div>
      <div class="dialog-footer">
        <Button
          variant="secondary"
          @click="$emit('close')"
        >
          {{ cancelText }}
        </Button>
        <Button
          variant="primary"
          @click="handleConfirm"
        >
          {{ confirmText }}
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
  formData: ShortcutFormData
  titleLabel?: string
  editTitleLabel?: string
  nameLabel?: string
  namePlaceholder?: string
  descLabel?: string
  descPlaceholder?: string
  keysLabel?: string
  keysPlaceholder?: string
  groupLabel?: string
  groupPlaceholder?: string
  cancelText?: string
  confirmText?: string
  fillRequiredText?: string
}

const props = withDefaults(defineProps<Props>(), {
  titleLabel: "添加快捷键",
  editTitleLabel: "编辑快捷键",
  nameLabel: "快捷键名称",
  namePlaceholder: "输入快捷键名称",
  descLabel: "描述",
  descPlaceholder: "输入功能描述",
  keysLabel: "快捷键",
  keysPlaceholder: "例如: Ctrl+K",
  groupLabel: "分组",
  groupPlaceholder: "输入分组名称",
  cancelText: "取消",
  confirmText: "确认",
  fillRequiredText: "请填写必填项",
})

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
  group: "自定义",
})

watch(
  () => props.formData,
  (val) => {
    localFormData.value = { ...val }
  },
  {
    immediate: true,
    deep: true,
  },
)

const title = computed(() =>
  props.isEdit ? props.editTitleLabel : props.titleLabel,
)

function handleConfirm() {
  if (!localFormData.value.name || !localFormData.value.keys) {
    emit("error", props.fillRequiredText)
    return
  }

  const shortcut: ShortcutInfo = {
    id: localFormData.value.id || `custom_${Date.now()}`,
    name: localFormData.value.name,
    description: localFormData.value.description,
    keys: localFormData.value.keys,
    category: "custom",
    group: localFormData.value.group || "自定义",
  }

  emit("confirm", shortcut)
}
</script>

<style scoped lang="scss">
.shortcut-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shortcut-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 450px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.dialog-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.dialog-body::-webkit-scrollbar {
  width: 5px;
}

.dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-body::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
}
</style>
