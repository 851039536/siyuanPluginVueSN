<template>
  <div class="encryption-section">
    <div class="section-header">
      <span class="section-title">{{ plugin.i18n.contentEncryption || '内容加密' }}</span>
    </div>

    <div class="section-content">
      <!-- 密码状态 -->
      <div
        class="status-card"
        :class="{ 'has-password': hasPassword }"
      >
        <IconWrapper
          v-if="hasPassword"
          name="success"
          :size="14"
          class="status-icon"
        />
        <IconWrapper
          v-else
          name="warning"
          :size="14"
          class="status-icon"
        />
        <span class="status-text">
          {{ hasPassword ? plugin.i18n.passwordSet : plugin.i18n.passwordNotSetYet }}
        </span>
      </div>

      <!-- 密码输入 -->
      <div class="form-group">
        <label>{{ plugin.i18n.newPassword }}</label>
        <input
          v-model="newPassword"
          type="password"
          :placeholder="plugin.i18n.passwordPlaceholder"
          @keydown.enter="handleSavePassword"
        >
      </div>

      <div class="form-group">
        <label>{{ plugin.i18n.confirmPassword }}</label>
        <input
          v-model="confirmPassword"
          type="password"
          :placeholder="plugin.i18n.confirmPasswordPlaceholder"
          @keydown.enter="handleSavePassword"
        >
      </div>

      <!-- 保存按钮 -->
      <button
        class="save-btn"
        @click="handleSavePassword"
      >
        {{ hasPassword ? plugin.i18n.changePassword : plugin.i18n.save }}
      </button>

      <!-- 提示信息 -->
      <div class="info-card">
        <IconWrapper
          name="info"
          :size="13"
          class="info-icon"
        />
        <div class="info-content">
          <span class="info-text">{{ plugin.i18n.encryptionTip }}</span>
          <span class="info-sub">{{ plugin.i18n.algorithmInfo }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import {

  showMessage,
} from "siyuan"
import {
  onActivated,
  onMounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { getEncryptionInstance } from "../../encryption"

const props = defineProps<{
  plugin: Plugin
}>()

const newPassword = ref("")
const confirmPassword = ref("")
const hasPassword = ref(false)

onMounted(() => {
  checkPasswordStatus()
})

onActivated(() => {
  checkPasswordStatus()
})

function checkPasswordStatus() {
  const encryption = getEncryptionInstance()
  if (encryption) {
    hasPassword.value = encryption.hasPassword()
  }
}

async function handleSavePassword() {
  const pwd1 = newPassword.value.trim()
  const pwd2 = confirmPassword.value.trim()

  if (!pwd1) {
    showMessage(props.plugin.i18n.passwordEmpty, 3000, "error")
    return
  }

  if (pwd1 !== pwd2) {
    showMessage(props.plugin.i18n.passwordMismatch, 3000, "error")
    return
  }

  const encryption = getEncryptionInstance()
  if (encryption) {
    encryption.setPassword(pwd1)
    await encryption.savePassword()
    showMessage(props.plugin.i18n.passwordSetSuccess, 2000, "info")
    newPassword.value = ""
    confirmPassword.value = ""
    checkPasswordStatus()
  }
}
</script>

<style scoped lang="scss">
@use "../styles/EncryptionSettings.scss";
</style>
