<template>
  <div v-if="visible" class="page-lock-dialog-mask" @click="handleMaskClick">
    <div class="page-lock-dialog" @click.stop>
      <div class="page-lock-dialog__header">
        <div class="header-icon">
          <IconWrapper :name="headerIconName" :size="20" />
        </div>
        <h3>{{ title }}</h3>
        <button class="page-lock-dialog__close" @click="handleClose">
          <IconWrapper name="close" :size="18" />
        </button>
      </div>

      <div class="page-lock-dialog__content">
        <!-- 提示信息 -->
        <div v-if="hintText" class="page-lock-dialog__hint">
          <IconWrapper name="info" :size="16" />
          <span>{{ hintText }}</span>
        </div>

        <div class="page-lock-dialog__form">
          <!-- 更新密码模式：先输入旧密码 -->
          <div v-if="isUpdateMode" class="page-lock-dialog__field">
            <label class="field-label">
              <span class="lock-icon">
                <IconWrapper name="pageLock" :size="15" />
              </span>
              {{ i18n.oldPasswordPlaceholder || '旧密码' }}
            </label>
            <input
              ref="firstInput"
              v-model="oldPassword"
              type="password"
              :placeholder="i18n.oldPasswordPlaceholder"
              class="page-lock-dialog__input"
              @keyup.enter="handleConfirm"
              autocomplete="current-password"
              :autofocus="isUpdateMode"
            />
          </div>

          <!-- 新密码输入 -->
          <div class="page-lock-dialog__field">
            <label class="field-label">
              <span class="lock-icon">
                <IconWrapper name="pageLock" :size="15" />
              </span>
              {{ isUpdateMode ? (i18n.newPasswordPlaceholder || '新密码') : (i18n.passwordPlaceholder || '密码') }}
            </label>
            <input
              :ref="isUpdateMode ? 'secondInput' : 'firstInput'"
              v-model="password"
              type="password"
              :placeholder="passwordPlaceholder"
              class="page-lock-dialog__input"
              @keyup.enter="handleConfirm"
              :autocomplete="isUnlockMode ? 'current-password' : 'new-password'"
              :autofocus="!isUpdateMode"
            />
          </div>

          <!-- 锁定或更新模式：需要确认密码 -->
          <div v-if="isLockMode || isUpdateMode" class="page-lock-dialog__field">
            <label class="field-label">
              <span class="lock-icon">
                <IconWrapper name="pageLock" :size="15" />
              </span>
              {{ i18n.confirmPasswordPlaceholder || '确认密码' }}
            </label>
            <input
              v-model="confirmPassword"
              type="password"
              :placeholder="confirmPasswordPlaceholder"
              class="page-lock-dialog__input"
              @keyup.enter="handleConfirm"
              autocomplete="new-password"
            />
          </div>
        </div>
      </div>

      <div class="page-lock-dialog__footer">
        <button class="page-lock-dialog__btn page-lock-dialog__btn--cancel" @click="handleClose">
          <IconWrapper name="close" :size="15" />
          {{ cancelText }}
        </button>
        <button class="page-lock-dialog__btn page-lock-dialog__btn--confirm" @click="handleConfirm">
          <IconWrapper name="success" :size="15" />
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'

interface Props {
  visible: boolean
  mode: 'lock' | 'unlock' | 'update'
  i18n: any
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', password: string, confirmPassword?: string, oldPassword?: string): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const password = ref('')
const confirmPassword = ref('')
const oldPassword = ref('')
const firstInput = ref<HTMLInputElement>()

const isLockMode = computed(() => props.mode === 'lock')
const isUpdateMode = computed(() => props.mode === 'update')
const isUnlockMode = computed(() => props.mode === 'unlock')

const title = computed(() => {
  if (isUpdateMode.value) return props.i18n.updatePassword || '更新密码'
  if (isLockMode.value) return props.i18n.setPassword || '设置密码'
  return props.i18n.enterPassword || '输入密码'
})

const headerIconName = computed(() => {
  if (isUpdateMode.value) return 'refresh'
  if (isLockMode.value) return 'pageLock'
  return 'pageLock'
})

const hintText = computed(() => {
  if (isUpdateMode.value) return props.i18n.updatePasswordHint || '请先输入旧密码，然后设置新密码'
  if (isLockMode.value) return props.i18n.setPasswordHint || '设置密码后可以锁定文档，保护隐私内容'
  return props.i18n.unlockHint || '请输入密码解锁文档'
})

const passwordPlaceholder = computed(() => {
  if (isUpdateMode.value) return props.i18n.newPasswordPlaceholder || '请输入新密码'
  return props.i18n.passwordPlaceholder || '请输入密码'
})
const confirmPasswordPlaceholder = computed(() => props.i18n.confirmPasswordPlaceholder || '请再次输入密码')
const confirmText = computed(() => props.i18n.confirm || '确认')
const cancelText = computed(() => props.i18n.cancel || '取消')

const handleMaskClick = () => {
  handleClose()
}

// 自动聚焦第一个输入框（作为 autofocus 的备用方案）
const focusFirstInput = () => {
  const getTargetInput = () => {
    if (isUpdateMode.value) {
      return firstInput.value as HTMLInputElement
    }
    return firstInput.value as HTMLInputElement
  }

  // 简单的聚焦备用方案
  setTimeout(() => {
    const input = getTargetInput()
    if (input) {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }, 100)
}

const handleClose = () => {
  // 清空所有输入框
  password.value = ''
  confirmPassword.value = ''
  oldPassword.value = ''
  emit('update:visible', false)
  emit('close')
}

// 监听 visible 变化，自动聚焦
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 立即聚焦，然后延迟再次聚焦确保成功
    setTimeout(() => {
      const input = firstInput.value as HTMLInputElement
      if (input) {
        input.focus()
        input.setSelectionRange(input.value.length, input.value.length)
      }
    }, 100)

    // 延迟聚焦，确保组件完全渲染
    setTimeout(() => {
      focusFirstInput()
    }, 200)
  }
})

const handleConfirm = () => {
  if (isUpdateMode.value) {
    emit('confirm', password.value, confirmPassword.value, oldPassword.value)
  } else if (isLockMode.value) {
    emit('confirm', password.value, confirmPassword.value)
  } else {
    emit('confirm', password.value)
  }
  password.value = ''
  confirmPassword.value = ''
  oldPassword.value = ''
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
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  pointer-events: auto;
  animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.page-lock-dialog {
  background: var(--b3-theme-background);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1);
  width: 420px;
  max-width: 90vw;
  overflow: hidden;
  animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.page-lock-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--b3-theme-surface) 0%, var(--b3-theme-surface-variant) 100%);
  border-bottom: 1px solid var(--b3-border-color);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 24px;
    right: 24px;
    height: 2px;
    background: linear-gradient(90deg, var(--b3-theme-primary) 0%, transparent 100%);
    opacity: 0.6;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--b3-theme-primary) 0%, var(--b3-theme-primary-light) 100%);
    border-radius: 12px;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.3);
    animation: iconPulse 2s ease-in-out infinite;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      transform: rotate(45deg);
      animation: shine 3s linear infinite;
    }

    .icon {
      width: 20px;
      height: 20px;
      color: var(--b3-theme-on-primary);
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
      position: relative;
      z-index: 1;
    }
  }

  @keyframes iconPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.4);
    }
  }

  @keyframes shine {
    0% {
      transform: translateX(-100%) rotate(45deg);
    }
    100% {
      transform: translateX(100%) rotate(45deg);
    }
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    flex: 1;
    letter-spacing: -0.01em;
  }
}

.page-lock-dialog__close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-background);
  opacity: 0.5;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;

  &:hover {
    opacity: 1;
    background: var(--b3-theme-surface-variant);
    transform: rotate(90deg);
  }

  &:active {
    transform: rotate(90deg) scale(0.9);
  }

  .icon {
    width: 18px;
    height: 18px;
  }
}

.page-lock-dialog__content {
  padding: 24px;
}

.page-lock-dialog__hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, var(--b3-theme-primary-container) 0%, var(--b3-theme-primary-lighter) 100%);
  border-radius: 10px;
  border-left: 4px solid var(--b3-theme-primary);
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  line-height: 1.6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  .icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--b3-theme-primary);
  }
}

.page-lock-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-lock-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .field-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
    letter-spacing: -0.01em;

    .icon {
      width: 15px;
      height: 15px;
      color: var(--b3-theme-primary);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      filter: drop-shadow(0 1px 2px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1));
    }
  }
}

/* 锁定图标优化样式 */
.lock-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }
}

.page-lock-dialog__field:focus-within {
  .field-label {
    .icon {
      transform: scale(1.1);
      filter: drop-shadow(0 2px 4px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.2));
    }

    .lock-icon::before {
      opacity: 1;
      transform: scale(1.2);
    }
  }
}

.page-lock-dialog__input {
  padding: 12px 14px;
  border: 2px solid var(--b3-border-color);
  border-radius: 10px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  outline: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;

  &:focus {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-background);
    box-shadow: 0 0 0 4px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.12);
    transform: translateY(-1px);
  }

  &::placeholder {
    color: var(--b3-theme-on-surface-variant);
    opacity: 0.5;
  }

  &:hover:not(:focus) {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-background);
  }
}

.page-lock-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  background: var(--b3-theme-surface);
  border-top: 1px solid var(--b3-border-color);
}

.page-lock-dialog__btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
  outline: none;
  white-space: nowrap;
  letter-spacing: -0.01em;

  .icon {
    width: 15px;
    height: 15px;
  }

  &--cancel {
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border: 2px solid var(--b3-border-color);

    &:hover {
      background: var(--b3-theme-background);
      border-color: var(--b3-theme-on-surface-variant);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }
  }

  &--confirm {
    background: linear-gradient(135deg, var(--b3-theme-primary) 0%, var(--b3-theme-primary-light) 100%);
    color: var(--b3-theme-on-primary);
    box-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.35);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.45);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.3);
    }
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .page-lock-dialog {
    width: 95vw;
    border-radius: 10px;
  }

  .page-lock-dialog__header {
    padding: 14px 16px;

    .header-icon {
      width: 28px;
      height: 28px;
      animation: none; /* 移动端禁用动画以提升性能 */

      .icon {
        width: 16px;
        height: 16px;
      }
    }

    h3 {
      font-size: 15px;
    }
  }

  .page-lock-dialog__field {
    .field-label {
      .icon {
        width: 14px;
        height: 14px;
      }
    }
  }

  /* 移动端锁定图标优化 */
  .lock-icon {
    &::before {
      width: 20px;
      height: 20px;
    }
  }

  .page-lock-dialog__field:focus-within {
    .field-label {
      .icon {
        transform: scale(1.05); /* 移动端减少缩放幅度 */
      }

      .lock-icon::before {
        transform: scale(1.1);
      }
    }
  }

  .page-lock-dialog__content {
    padding: 16px;
  }

  .page-lock-dialog__hint {
    padding: 10px;
    font-size: 11px;
  }

  .page-lock-dialog__form {
    gap: 14px;
  }

  .page-lock-dialog__input {
    padding: 9px 11px;
    font-size: 13px;
  }

  .page-lock-dialog__footer {
    padding: 14px 16px;
  }

  .page-lock-dialog__btn {
    padding: 7px 14px;
    font-size: 13px;
  }
}
</style>
