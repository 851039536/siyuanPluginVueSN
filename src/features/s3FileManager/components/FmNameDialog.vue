<!-- 名称输入弹窗 — 新建文件夹 / 重命名共用，Enter 确认、Esc 取消（全局生效）、实时校验非法名称 -->
<template>
  <div
    class="fm-dialog-mask"
    @click.self="$emit('close')"
  >
    <div class="fm-dialog fm-name-dialog">
      <!-- 弹窗标题：由父传入（"新建文件夹" / "重命名"） -->
      <div class="fm-dialog-header">
        <span class="fm-dialog-title">{{ title }}</span>
        <Button
          variant="ghost"
          size="xsmall"
          icon="close"
          :icon-size="14"
          @click="$emit('close')"
        />
      </div>

      <div class="fm-dialog-body">
        <Input
          ref="inputRef"
          v-model="name"
          size="small"
          :placeholder="i18n.namePlaceholder"
          @keydown.enter="handleConfirm"
        />
        <!-- 校验错误："名称不能包含斜杠等非法字符" -->
        <span
          v-if="showError"
          class="fm-name-error"
        >{{ i18n.invalidName }}</span>
      </div>

      <!-- 底部操作栏 -->
      <div class="fm-dialog-footer">
        <div class="fm-dialog-footer-right">
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import type { S3FileManagerI18n } from "../types"
import { isValidEntryName } from "../utils"
import { useEscClose } from "../composables/useEscClose"

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

// Esc 关闭弹窗（全局监听，不依赖输入框聚焦）
useEscClose(() => emit("close"))

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
@use "../styles/index.scss";
</style>
