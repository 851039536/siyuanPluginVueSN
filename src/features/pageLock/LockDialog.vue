<template>
  <div v-if="visible" class="page-lock-dialog-mask" @click="handleMaskClick">
    <div class="page-lock-dialog" @click.stop>
      <div class="page-lock-dialog__header">
        <h3>{{ title }}</h3>
        <button class="page-lock-dialog__close" @click="handleClose">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <div class="page-lock-dialog__content">
        <div class="page-lock-dialog__form">
          <div class="page-lock-dialog__field">
            <input
              v-model="password"
              type="password"
              :placeholder="passwordPlaceholder"
              class="page-lock-dialog__input"
              @keyup.enter="handleConfirm"
            />
          </div>

          <div v-if="isLockMode" class="page-lock-dialog__field">
            <input
              v-model="confirmPassword"
              type="password"
              :placeholder="confirmPasswordPlaceholder"
              class="page-lock-dialog__input"
              @keyup.enter="handleConfirm"
            />
          </div>
        </div>
      </div>

      <div class="page-lock-dialog__footer">
        <button class="page-lock-dialog__btn page-lock-dialog__btn--cancel" @click="handleClose">
          {{ cancelText }}
        </button>
        <button class="page-lock-dialog__btn page-lock-dialog__btn--confirm" @click="handleConfirm">
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  visible: boolean
  mode: 'lock' | 'unlock'
  i18n: any
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', password: string, confirmPassword?: string): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const password = ref('')
const confirmPassword = ref('')

const isLockMode = computed(() => props.mode === 'lock')

const title = computed(() => {
  return isLockMode.value ? props.i18n.setPassword : props.i18n.enterPassword
})

const passwordPlaceholder = computed(() => props.i18n.passwordPlaceholder)
const confirmPasswordPlaceholder = computed(() => props.i18n.confirmPasswordPlaceholder)
const confirmText = computed(() => props.i18n.confirm)
const cancelText = computed(() => props.i18n.cancel)

const handleMaskClick = () => {
  handleClose()
}

const handleClose = () => {
  password.value = ''
  confirmPassword.value = ''
  emit('update:visible', false)
  emit('close')
}

const handleConfirm = () => {
  if (isLockMode.value) {
    emit('confirm', password.value, confirmPassword.value)
  } else {
    emit('confirm', password.value)
  }
  password.value = ''
  confirmPassword.value = ''
}
</script>

<style lang="scss" scoped>
.page-lock-dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  pointer-events: auto;
}

.page-lock-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: var(--b3-dialog-shadow);
  width: 360px;
  max-width: 90vw;
  overflow: hidden;
}

.page-lock-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
  }
}

.page-lock-dialog__close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-background);
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  .icon {
    width: 16px;
    height: 16px;
  }
}

.page-lock-dialog__content {
  padding: 16px;
}

.page-lock-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.page-lock-dialog__field {
  display: flex;
  flex-direction: column;
}

.page-lock-dialog__input {
  padding: 7px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: var(--b3-theme-primary);
  }

  &::placeholder {
    color: var(--b3-theme-on-surface-light);
  }
}

.page-lock-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
}

.page-lock-dialog__btn {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  outline: none;
  white-space: nowrap;

  &--cancel {
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);

    &:hover {
      background: var(--b3-theme-surface-hover);
    }
  }

  &--confirm {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);

    &:hover {
      opacity: 0.9;
    }
  }
}
</style>
