<template>
  <div v-if="visible" class="page-lock-dialog-mask" @click="handleMaskClick">
    <div class="page-lock-dialog" @click.stop>
      <div class="page-lock-dialog__header">
        <div class="header-icon">
          <IconWrapper :name="headerIconName" :size="20" />
        </div>
        <h3>{{ title }}</h3>
        <Button class="page-lock-dialog__close" variant="ghost" size="small" @click="handleClose">
          <template #icon>
            <IconWrapper name="close" :size="18" />
          </template>
        </Button>
      </div>

      <div class="page-lock-dialog__content">
        <div v-if="hintText" class="page-lock-dialog__hint">
          <IconWrapper name="info" :size="16" />
          <span>{{ hintText }}</span>
        </div>

        <div class="page-lock-dialog__form">
          <div v-if="isUpdateMode" class="page-lock-dialog__field">
            <Input
              ref="firstInput"
              v-model="oldPassword"
              type="password"
              :label="oldPasswordLabel"
              :placeholder="i18n.oldPasswordPlaceholder"
              :prefix-icon="'pageLock' as IconKey"
              :show-password="true"
              :autocomplete="'current-password'"
              :autofocus="isUpdateMode"
              @keydown.enter="handleConfirm"
            />
          </div>

          <div class="page-lock-dialog__field">
            <Input
              :ref="isUpdateMode ? 'secondInput' : 'firstInput'"
              v-model="password"
              type="password"
              :label="passwordLabel"
              :placeholder="passwordPlaceholder"
              :prefix-icon="'pageLock' as IconKey"
              :show-password="true"
              :autocomplete="!isLockMode && !isUpdateMode ? 'current-password' : 'new-password'"
              :autofocus="!isUpdateMode"
              @keydown.enter="handleConfirm"
            />
          </div>

          <div v-if="isLockMode || isUpdateMode" class="page-lock-dialog__field">
            <Input
              v-model="confirmPassword"
              type="password"
              :label="confirmPasswordLabel"
              :placeholder="confirmPasswordPlaceholder"
              :prefix-icon="'pageLock' as IconKey"
              :show-password="true"
              :autocomplete="'new-password'"
              @keydown.enter="handleConfirm"
            />
          </div>
        </div>
      </div>

      <div class="page-lock-dialog__footer">
        <Button variant="secondary" @click="handleClose">
          <template #icon>
            <IconWrapper name="close" :size="15" />
          </template>
          {{ cancelText }}
        </Button>
        <Button @click="handleConfirm">
          <template #icon>
            <IconWrapper name="success" :size="15" />
          </template>
          {{ confirmText }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import Button from '@/components/Button.vue'
import Input from '@/components/Input.vue'
import type { LockDialogProps, LockDialogEmits } from '../types'
import type { IconKey } from '@/config/icons'

const props = defineProps<LockDialogProps>()
const emit = defineEmits<LockDialogEmits>()

const password = ref('')
const confirmPassword = ref('')
const oldPassword = ref('')
const firstInput = ref<InstanceType<typeof Input>>()

const isLockMode = computed(() => props.mode === 'lock')
const isUpdateMode = computed(() => props.mode === 'update')

const title = computed(() => {
  if (isUpdateMode.value) return props.i18n.updatePassword || '更新密码'
  if (isLockMode.value) return props.i18n.setPassword || '设置密码'
  return props.i18n.enterPassword || '输入密码'
})

const headerIconName = computed(() => isUpdateMode.value ? 'refresh' : 'pageLock')

const hintText = computed(() => {
  if (isUpdateMode.value) return props.i18n.updatePasswordHint || '请先输入旧密码，然后设置新密码'
  if (isLockMode.value) return props.i18n.setPasswordHint || '设置密码后可以锁定文档，保护隐私内容'
  return props.i18n.unlockHint || '请输入密码解锁文档'
})

const oldPasswordLabel = computed(() => {
  return props.i18n.oldPasswordPlaceholder || '旧密码'
})

const passwordLabel = computed(() => {
  return isUpdateMode.value ? (props.i18n.newPasswordPlaceholder || '新密码') : (props.i18n.passwordPlaceholder || '密码')
})

const confirmPasswordLabel = computed(() => {
  return props.i18n.confirmPasswordPlaceholder || '确认密码'
})

const passwordPlaceholder = computed(() =>
  isUpdateMode.value ? props.i18n.newPasswordPlaceholder || '请输入新密码' : props.i18n.passwordPlaceholder || '请输入密码'
)
const confirmPasswordPlaceholder = computed(() => props.i18n.confirmPasswordPlaceholder || '请再次输入密码')
const confirmText = computed(() => props.i18n.confirm || '确认')
const cancelText = computed(() => props.i18n.cancel || '取消')

const clearPasswords = () => {
  password.value = ''
  confirmPassword.value = ''
  oldPassword.value = ''
}

const focusInput = () => {
  if (firstInput.value) {
    nextTick(() => {
      firstInput.value?.focus?.()
    })
  }
}

const handleClose = () => {
  clearPasswords()
  emit('update:visible', false)
  emit('close')
}

const handleMaskClick = () => {
  handleClose()
}

const handleConfirm = () => {
  if (isUpdateMode.value) {
    emit('confirm', password.value, confirmPassword.value, oldPassword.value)
  } else if (isLockMode.value) {
    emit('confirm', password.value, confirmPassword.value)
  } else {
    emit('confirm', password.value)
  }
  clearPasswords()
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    setTimeout(focusInput, 100)
  }
})
</script>

<style lang="scss" scoped>
@use "../styles/index.scss";
</style>
