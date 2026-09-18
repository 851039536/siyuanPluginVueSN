<!-- 名称输入弹窗 — 新建文件夹 / 重命名共用，Enter 确认、Esc 取消（外壳复用共享 Dialog） -->
<template>
  <Dialog
    :visible="true"
    size="small"
    :header="title"
    @update:visible="$emit('close')"
  >
    <div class="fm-name-body">
      <Input
        ref="inputRef"
        v-model="name"
        size="small"
        autofocus
        :placeholder="i18n.namePlaceholder"
        :error="showError ? i18n.invalidName : undefined"
        @keydown.enter="handleConfirm"
      />
    </div>

    <template #footer>
      <Button
        variant="ghost"
        size="small"
        @click="$emit('close')"
      >
        {{ i18n.cancel }}
      </Button>
      <Button
        variant="primary"
        size="small"
        :disabled="!isValid"
        @click="handleConfirm"
      >
        {{ i18n.confirm }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Input from "@/components/Input.vue"
import type { S3FileManagerI18n } from "../types"
import { isValidEntryName } from "../utils"

const props = defineProps<{
  title: string
  /** 初始名称（重命名时预填当前名） */
  initialName?: string
  i18n: S3FileManagerI18n
}>()

const emit = defineEmits<{
  confirm: [name: string]
  close: []
}>()

const name = ref(props.initialName || "")
const showError = ref(false)
const inputRef = ref<InstanceType<typeof Input> | null>(null)

const isValid = computed(() => isValidEntryName(name.value))

onMounted(async () => {
  await nextTick()
  inputRef.value?.$el?.querySelector("input")?.focus()
})

function handleConfirm(): void {
  if (!isValid.value) {
    showError.value = true
    return
  }
  emit("confirm", name.value.trim())
}
</script>

<style scoped lang="scss">
@use "../styles/FmNameDialog.scss";
</style>
