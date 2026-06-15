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

<style lang="scss" scoped>
@use "../styles/ShortcutDialog.scss";
</style>
