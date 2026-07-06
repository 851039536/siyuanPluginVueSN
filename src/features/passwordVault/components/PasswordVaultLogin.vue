<template>
  <div class="login-page">
    <div class="login-body">
      <p class="login-title">
        {{ isFirstTime ? '创建主密码' : '解锁密码箱' }}
      </p>

      <!-- 显示保存的密码提示 -->
      <div
        v-if="!isFirstTime && passwordHint"
        class="password-hint-display"
      >
        <span>{{ passwordHint }}</span>
      </div>

      <form
        class="login-form"
        @submit.prevent="handleSubmit"
      >
        <Input
          ref="inputRef"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="输入主密码"
          size="xsmall"
          @keydown.esc="$emit('close')"
        />

        <!-- 首次设置时显示密码提示输入 -->
        <div
          v-if="isFirstTime"
          class="hint-input-group"
        >
          <Button
            type="button"
            variant="ghost"
            size="xsmall"
            @click="showHintInput = !showHintInput"
          >
            {{ showHintInput ? '取消密码提示' : '设置密码提示（推荐）' }}
          </Button>
          <Input
            v-if="showHintInput"
            v-model="hint"
            type="text"
            size="xsmall"
            placeholder="例如：我的生日、最喜欢的颜色等"
            class="hint-input"
            :maxlength="50"
          />
        </div>

        <div
          v-if="loginError"
          class="error-message"
        >
          {{ loginError }}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="xsmall"
          :disabled="!password.trim()"
          class="submit-btn"
        >
          {{ isFirstTime ? '创建密码' : '解锁' }}
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  nextTick,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"

// ============================================================
// Props
// ============================================================

interface Props {
  isFirstTime: boolean
  passwordHint?: string
  loginError?: string
}

const props = withDefaults(defineProps<Props>(), {
  passwordHint: "",
  loginError: "",
})

const emit = defineEmits<Emits>()

// ============================================================
// Emits
// ============================================================

interface Emits {
  (e: "login", password: string, hint?: string): void
  (e: "close"): void
  (e: "forgotPassword"): void
}

// ============================================================
// State
// ============================================================

const password = ref("")
const showPassword = ref(false)
const hint = ref("")
const showHintInput = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// ============================================================
// Methods
// ============================================================

const handleSubmit = () => {
  if (!password.value.trim()) return
  // 发送登录事件
  emit(
    "login",
    password.value.trim(),
    props.isFirstTime ? hint.value.trim() : undefined,
  )
}

// ============================================================
// Lifecycle
// ============================================================

onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()
})
</script>

<style lang="scss" scoped>
@use '../styles/login.scss';
</style>
