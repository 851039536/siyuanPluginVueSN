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
        <div
          class="dialog-section"
          style="margin-bottom: 20px;"
        >
          <h3 class="dialog-title">
            🔓 {{ i18n.decryptText }}
          </h3>
          <p class="dialog-desc">
            {{ i18n.enterPasswordToDecrypt || "请输入密码以解密内容" }}
          </p>
        </div>

        <div
          class="dialog-section"
          style="margin-bottom: 20px;"
        >
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
            {{ isDecrypting ? (i18n.decrypting || "解密中...") : (i18n.decrypt || "解密") }}
          </button>
        </div>
      </template>

      <!-- 步骤2：解密结果 -->
      <template v-else-if="step === 'result'">
        <div
          class="dialog-section"
          style="margin-bottom: 20px;"
        >
          <h3 class="dialog-title">
            ✅ {{ i18n.decryptSuccess }}
          </h3>
          <p class="dialog-desc">
            {{ i18n.decryptResultHint || "解密成功，您可以复制内容或替换原文" }}
          </p>
        </div>

        <div
          class="dialog-section"
          style="margin-bottom: 20px;"
        >
          <label class="field-label">{{ i18n.decryptedContent || "解密内容" }}</label>
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
            📋 {{ copied ? (i18n.copied || "已复制") : (i18n.copyContent || "复制内容") }}
          </button>
          <button
            class="btn btn-primary"
            @click="replaceContent"
          >
            🔄 {{ i18n.replaceEncrypted || "替换加密文本" }}
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

<style scoped>
.decrypt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  /* 父容器 .plugin-app-main 设置了 pointer-events: none，
     需在遮罩层重新启用，否则点击事件无法触发关闭 */
  pointer-events: auto;
}

.decrypt-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  display: flex;
  align-items: center;
  gap: 8px;
}

.dialog-desc {
  margin: 0;
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.password-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  box-sizing: border-box;
  font-size: 14px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  outline: none;
}

.password-input:focus {
  border-color: var(--b3-theme-primary);
}

.error-msg {
  margin-top: 8px;
  color: var(--b3-card-error-color);
  font-size: 12px;
}

.result-textarea {
  width: 100%;
  min-height: 150px;
  max-height: 300px;
  padding: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  box-sizing: border-box;
  font-size: 14px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-family: var(--b3-font-family-code);
  line-height: 1.6;
  resize: vertical;
  outline: none;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.btn-secondary {
  border: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
}

.btn-outline {
  border: 1px solid var(--b3-theme-primary);
  background: transparent;
  color: var(--b3-theme-primary);
}
</style>
