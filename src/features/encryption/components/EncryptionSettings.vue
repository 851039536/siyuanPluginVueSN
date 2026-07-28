<!-- 内容加密设置卡片：显示密码状态，设置/修改 AES-256-GCM 内容加密密码 -->
<template>
  <div class="encryption-section">
    <div class="section-header">
      <!-- 卡片标题："内容加密" -->
      <span class="section-title">{{ plugin.i18n.contentEncryption }}</span>
    </div>

    <div class="section-content">
      <!-- 密码状态卡："密码已设置" / "尚未设置密码" -->
      <div
        class="status-card"
        :class="{ 'has-password': hasPassword }"
      >
        <IconWrapper
          :name="hasPassword ? 'success' : 'warning'"
          :size="14"
        />
        <span class="status-text">
          {{ hasPassword ? plugin.i18n.passwordSet : plugin.i18n.passwordNotSetYet }}
        </span>
      </div>

      <!-- 新密码输入框（标签："新密码"，占位："请输入密码"） -->
      <Input
        v-model="newPassword"
        size="small"
        type="password"
        :label="plugin.i18n.newPassword"
        :placeholder="plugin.i18n.passwordPlaceholder"
        @keydown.enter="handleSavePassword"
      />

      <!-- 确认密码输入框（标签："确认密码"，占位："请再次输入密码"） -->
      <Input
        v-model="confirmPassword"
        size="small"
        type="password"
        :label="plugin.i18n.confirmPassword"
        :placeholder="plugin.i18n.confirmPasswordPlaceholder"
        @keydown.enter="handleSavePassword"
      />

      <!-- 保存按钮："修改密码" / "保存" -->
      <Button
        size="small"
        @click="handleSavePassword"
      >
        {{ hasPassword ? plugin.i18n.changePassword : plugin.i18n.save }}
      </Button>

      <!-- 使用提示卡：右键菜单加密/解密提示 + 加密算法说明 -->
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
import { showMessage } from "siyuan"
import {
  onActivated,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { getEncryptionInstance } from "../index"

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
