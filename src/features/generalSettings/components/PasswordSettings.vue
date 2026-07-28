<!-- 文档加密密码设置卡片：显示全局锁定密码状态，触发 pageLock 的密码设置/更新对话框 -->
<template>
  <div class="password-section">
    <div class="section-header">
      <IconWrapper
        name="pageLock"
        :size="14"
      />
      <!-- 卡片标题："文档加密设置" -->
      <span class="section-title">{{ i18n.passwordSetting }}</span>
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
          {{ hasPassword ? i18n.passwordSet : i18n.passwordNotSet }}
        </span>
      </div>

      <!-- 说明卡："设置全局加密密码，用于锁定文档" -->
      <div class="info-card">
        <IconWrapper
          name="info"
          :size="13"
        />
        <span class="info-text">{{ i18n.passwordSettingDesc }}</span>
      </div>

      <!-- 设置/更新密码按钮："更新密码" / "文档密码" -->
      <button
        class="action-btn"
        @click="openPasswordDialog"
      >
        <IconWrapper
          name="pageLock"
          :size="16"
        />
        <span class="btn-text">
          {{ hasPassword ? i18n.updatePassword : i18n.setPassword }}
        </span>
        <IconWrapper
          name="chevronRight"
          :size="14"
          class="btn-arrow"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type PluginSample from "@/index"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { usePlugin } from "@/main"
import { emitCustomEvent } from "@/utils/eventBus"

import { GeneralSettingsStorage } from "../types/storage"

interface Props {
  i18n?: Record<string, string>
}

withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const plugin = usePlugin() as PluginSample
const hasPassword = ref(false)

const gsStorage = new GeneralSettingsStorage(plugin)

// 检查是否已设置密码
async function checkPassword() {
  try {
    const password = await gsStorage.password.load()
    hasPassword.value = !!password
  } catch (error) {
    console.error("检查密码失败:", error)
    hasPassword.value = false
  }
}

// 打开密码设置对话框（pageLock 监听该事件）
function openPasswordDialog() {
  emitCustomEvent("openPasswordDialog", { hasPassword: hasPassword.value })
}

const handlePasswordUpdated = () => checkPassword()

onMounted(() => {
  checkPassword()
  window.addEventListener("passwordUpdated", handlePasswordUpdated)
})

onUnmounted(() => {
  window.removeEventListener("passwordUpdated", handlePasswordUpdated)
})
</script>

<style lang="scss" scoped>
@use "../styles/PasswordSettings.scss";
</style>
