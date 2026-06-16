<template>
  <div
    v-if="visible"
    class="decrypt-overlay"
    @click.self="handleClose"
  >
    <div
      class="decrypt-dialog"
      @click.stop
    >
      <!-- 步骤1：密码输入 -->
      <template v-if="step === 'input'">
        <div class="dialog-section">
          <h3 class="dialog-title">
            🔓 {{ i18n.decryptText }}
          </h3>
          <p class="dialog-desc">
            {{ i18n.enterPasswordToDecrypt }}
          </p>
        </div>

        <div class="dialog-section">
          <label class="field-label">{{ i18n.decryptPassword }}</label>
          <input
            ref="passwordRef"
            v-model="password"
            type="password"
            :placeholder="i18n.enterPassword"
            class="password-input"
            @keydown.enter="handleDecrypt"
          />
          <div
            v-if="errorMsg"
            class="error-msg"
          >
            {{ errorMsg }}
          </div>
        </div>

        <div class="dialog-actions">
          <button
            class="btn btn-secondary"
            @click="handleClose"
          >
            {{ i18n.cancel }}
          </button>
          <button
            class="btn btn-primary"
            :disabled="isDecrypting"
            @click="handleDecrypt"
          >
            {{ isDecrypting ? i18n.decrypting : i18n.decrypt }}
          </button>
        </div>
      </template>

      <!-- 步骤2：解密结果 -->
      <template v-else-if="step === 'result'">
        <div class="dialog-section">
          <h3 class="dialog-title">
            ✅ {{ i18n.decryptSuccess }}
          </h3>
          <p class="dialog-desc">
            {{ i18n.decryptResultHint }}
          </p>
        </div>

        <div class="dialog-section">
          <label class="field-label">{{ i18n.decryptedContent }}</label>
          <textarea
            ref="textareaRef"
            v-model="decryptedText"
            readonly
            class="result-textarea"
          ></textarea>
        </div>

        <div class="dialog-actions">
          <button
            class="btn btn-secondary"
            @click="handleClose"
          >
            {{ i18n.close }}
          </button>
          <button
            class="btn btn-outline"
            @click="copyContent"
          >
            📋 {{ copied ? i18n.copied : i18n.copyContent }}
          </button>
          <button
            class="btn btn-primary"
            @click="replaceContent"
          >
            🔄 {{ i18n.replaceEncrypted }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import {
  nextTick,
  ref,
  watch,
} from "vue"
import {
  decryptText,
  deriveKey,
} from "../types"

interface Props {
  visible: boolean
  encryptedText: string
  i18n: Record<string, string>
}

interface Emits {
  (e: "update:visible", value: boolean): void
  (e: "close"): void
  (e: "replace", decryptedText: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

type Step = "input" | "result"

const step = ref<Step>("input")
const password = ref("")
const decryptedText = ref("")
const errorMsg = ref("")
const isDecrypting = ref(false)
const copied = ref(false)
const passwordRef = ref<HTMLInputElement>()
const textareaRef = ref<HTMLTextAreaElement>()

// 重置状态
const resetState = () => {
  step.value = "input"
  password.value = ""
  decryptedText.value = ""
  errorMsg.value = ""
  isDecrypting.value = false
  copied.value = false
}

// 对话框显示时自动聚焦密码输入框
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      resetState()
      nextTick(() => {
        passwordRef.value?.focus()
      })
    }
  },
)

// 处理解密
const handleDecrypt = async () => {
  const pwd = password.value.trim()
  if (!pwd) {
    errorMsg.value = props.i18n.passwordEmpty
    return
  }

  try {
    isDecrypting.value = true
    errorMsg.value = ""

    const key = await deriveKey(pwd)
    const result = await decryptText(props.encryptedText, key)

    decryptedText.value = result
    step.value = "result"

    nextTick(() => {
      textareaRef.value?.select()
    })
  } catch (_error) {
    errorMsg.value = props.i18n.decryptFailed
    isDecrypting.value = false
  }
}

// 复制内容
const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(decryptedText.value)
    copied.value = true
    showMessage(props.i18n.copySuccess, 2000, "info")
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (_error) {
    showMessage(props.i18n.copyFailed, 2000, "error")
  }
}

// 替换原文
const replaceContent = () => {
  emit("replace", decryptedText.value)
  handleClose()
}

// 关闭
const handleClose = () => {
  emit("update:visible", false)
  emit("close")
}
</script>

<style lang="scss" scoped>
@use "../styles/DecryptDialog.scss";
</style>
