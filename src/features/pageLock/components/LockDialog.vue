<!-- 页面锁定密码弹窗：锁定/解锁/更新密码三模式表单 -->
<template>
  <div
    class="page-lock-dialog"
    @click.stop
  >
    <div class="page-lock-dialog__header">
      <div class="header-icon">
        <IconWrapper
          :name="headerIconName"
          :size="20"
        />
      </div>
      <!-- 弹窗标题："更新密码" / "文档密码" / "输入密码" -->
      <h3>{{ title }}</h3>
      <Button
        class="page-lock-dialog__close"
        variant="ghost"
        size="xsmall"
        @click="handleClose"
      >
        <template #icon>
          <IconWrapper
            name="close"
            :size="18"
          />
        </template>
      </Button>
    </div>

    <div class="page-lock-dialog__content">
      <div
        v-if="hintText"
        class="page-lock-dialog__hint"
      >
        <IconWrapper
          name="info"
          :size="16"
        />
        <!-- 提示文案：更新/设置/解锁密码引导语 -->
        <span>{{ hintText }}</span>
      </div>

      <div class="page-lock-dialog__form">
        <div
          v-if="isUpdateMode"
          class="page-lock-dialog__field"
        >
          <Input
            v-model="oldPassword"
            type="password"
            :label="oldPasswordLabel"
            :placeholder="i18n.oldPasswordPlaceholder"
            :prefix-icon="'pageLock' as IconKey"
            :show-password="true"
            autocomplete="current-password"
            :autofocus="isUpdateMode"
            @keydown.enter="handleConfirm"
          />
        </div>

        <div class="page-lock-dialog__field">
          <Input
            v-model="password"
            type="password"
            :label="passwordPlaceholder"
            :placeholder="passwordPlaceholder"
            :prefix-icon="'pageLock' as IconKey"
            :show-password="true"
            autocomplete="new-password"
            :autofocus="!isUpdateMode"
            @keydown.enter="handleConfirm"
          />
        </div>

        <div
          class="page-lock-dialog__field"
        >
          <Input
            v-model="confirmPassword"
            type="password"
            :label="confirmPasswordPlaceholder"
            :placeholder="confirmPasswordPlaceholder"
            :prefix-icon="'pageLock' as IconKey"
            :show-password="true"
            autocomplete="new-password"
            @keydown.enter="handleConfirm"
          />
        </div>
      </div>
    </div>

    <div class="page-lock-dialog__footer">
      <Button
        variant="secondary"
        @click="handleClose"
      >
        <template #icon>
          <IconWrapper
            name="close"
            :size="15"
          />
        </template>
        <!-- 取消按钮："取消" -->
        {{ cancelText }}
      </Button>
      <Button @click="handleConfirm">
        <template #icon>
          <IconWrapper
            name="success"
            :size="15"
          />
        </template>
        <!-- 确认按钮："确定" -->
        {{ confirmText }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  LockDialogEmits,
  LockDialogProps,
} from "../types"
import type { IconKey } from "@/config/icons"
import {
  computed,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"

const props = defineProps<LockDialogProps>()
const emit = defineEmits<LockDialogEmits>()

const password = ref("")
const confirmPassword = ref("")
const oldPassword = ref("")

const isUpdateMode = computed(() => props.mode === "update")

const title = computed(() =>
  isUpdateMode.value ? props.i18n.updatePassword : props.i18n.setPassword,
)

const headerIconName = computed(() =>
  isUpdateMode.value ? "refresh" : "pageLock",
)

const hintText = computed(() =>
  isUpdateMode.value
    ? props.i18n.updatePasswordHint
    : props.i18n.setPasswordHint,
)

const oldPasswordLabel = props.i18n.oldPasswordPlaceholder
// 更新模式下密码栏显示"新密码"，其余模式显示"请输入密码"（label 与 placeholder 共用）
const passwordPlaceholder = computed(() =>
  isUpdateMode.value
    ? props.i18n.newPasswordPlaceholder
    : props.i18n.passwordPlaceholder,
)
const confirmPasswordPlaceholder = props.i18n.confirmPasswordPlaceholder
const confirmText = props.i18n.confirm
const cancelText = props.i18n.cancel

const clearPasswords = () => {
  password.value = ""
  confirmPassword.value = ""
  oldPassword.value = ""
}

const handleClose = () => {
  clearPasswords()
  emit("close")
}

const handleConfirm = () => {
  if (isUpdateMode.value) {
    emit("confirm", password.value, confirmPassword.value, oldPassword.value)
  } else {
    emit("confirm", password.value, confirmPassword.value)
  }
  clearPasswords()
}
</script>

<style lang="scss">
@use "../styles/index.scss";
</style>
