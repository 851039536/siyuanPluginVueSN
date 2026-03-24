<template>
  <div class="login-page">
    <div class="dialog-header">
      <div class="header-title">
        <IconWrapper name="settings" :size="24" />
        <span>密码箱</span>
      </div>
      <Button icon="close" variant="ghost" size="small" @click="$emit('close')" />
    </div>

    <div class="login-body">
      <div class="login-icon">🔐</div>
      <h2>{{ isFirstTime ? '创建主密码' : '请输入主密码' }}</h2>
      <p class="login-hint">
        {{ isFirstTime ? '首次使用将创建新密码' : '请输入密码以解锁' }}
      </p>

      <!-- 显示保存的密码提示 -->
      <div v-if="!isFirstTime && passwordHint" class="password-hint-display">
        <IconWrapper name="info" :size="14" />
        <span>提示：{{ passwordHint }}</span>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
          <Input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            ref="inputRef"
            @keydown.esc="$emit('close')"
            size="small"
          />

        <!-- 首次设置时显示密码提示输入 -->
        <div v-if="isFirstTime" class="hint-input-group">
          <Button
            type="button"
            variant="ghost"
            size="small"
            @click="showHintInput = !showHintInput"
          >
            <IconWrapper name="info" :size="14" />
            {{ showHintInput ? '取消密码提示' : '设置密码提示（推荐）' }}
          </Button>
          <Input
            v-if="showHintInput"
            v-model="hint"
            type="text"
            placeholder="例如：我的生日、最喜欢的颜色等"
            class="hint-input"
            :maxlength="50"
          />
        </div>

        <div v-if="loginError" class="error-message">
          <IconWrapper name="error" :size="16" />
          {{ loginError }}
        </div>

        <Button type="submit"  variant="primary" :disabled="!password.trim()" block>
          {{ isFirstTime ? '创建密码' : '解锁' }}
        </Button>
      </form>

      <!-- 忘记密码选项 -->
      <div v-if="!isFirstTime" class="forgot-password-section">
        <Button variant="ghost" size="small" @click="$emit('forgotPassword')">
          忘记密码？
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import Button from '@/components/Button.vue'
import Input from '@/components/Input.vue'

// ============================================================
// Props
// ============================================================

interface Props {
  isFirstTime: boolean
  passwordHint?: string
  loginError?: string
}

const props = withDefaults(defineProps<Props>(), {
  passwordHint: '',
  loginError: ''
})

// ============================================================
// Emits
// ============================================================

interface Emits {
  (e: 'login', password: string, hint?: string): void
  (e: 'close'): void
  (e: 'forgotPassword'): void
}

const emit = defineEmits<Emits>()

// ============================================================
// State
// ============================================================

const password = ref('')
const showPassword = ref(false)
const hint = ref('')
const showHintInput = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// ============================================================
// Methods
// ============================================================

const handleSubmit = () => {
  if (!password.value.trim()) return
  // 发送登录事件
  emit('login', password.value.trim(), props.isFirstTime ? hint.value.trim() : undefined)
}

// ============================================================
// Lifecycle
// ============================================================

// 监听首次使用状态变化，重置表单并自动聚焦
watch(() => props.isFirstTime, async () => {
  // 重置表单
  password.value = ''
  hint.value = ''
  showHintInput.value = false
  showPassword.value = false

  // 自动聚焦输入框
  await nextTick()
  inputRef.value?.focus()
}, { immediate: true })
</script>

<style lang="scss" scoped>
@use '../styles/login.scss';
</style>
