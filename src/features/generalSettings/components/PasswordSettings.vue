<template>
  <div class="encryption-section">
    <div class="section-header">
      <IconWrapper
        name="pageLock"
        :size="14"
      />
      <span class="section-title">{{ i18n.passwordSetting || '文档加密' }}</span>
    </div>

    <div class="section-content">
      <!-- 密码状态显示 -->
      <div
        class="status-card"
        :class="{ 'has-password': hasPassword }"
      >
        <IconWrapper
          :name="hasPassword ? 'success' : 'warning'"
          :size="14"
        />
        <span class="status-text">
          {{ hasPassword ? (i18n.passwordSet || '密码已设置') : (i18n.passwordNotSet || '尚未设置密码') }}
        </span>
      </div>

      <!-- 密码说明 -->
      <div class="info-card">
        <IconWrapper
          name="info"
          :size="13"
        />
        <span class="info-text">{{ i18n.passwordSettingDesc || '设置全局加密密码，用于锁定文档' }}</span>
      </div>

      <!-- 设置/更新密码按钮 -->
      <button
        class="action-btn"
        @click="openPasswordDialog"
      >
        <IconWrapper
          name="pageLock"
          :size="16"
        />
        <span class="btn-text">
          {{ hasPassword ? (i18n.updatePassword || '更新密码') : (i18n.setPassword || '设置密码') }}
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
  i18n?: any
}

const props = withDefaults(defineProps<Props>(), {
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

// 打开密码设置对话框
function openPasswordDialog() {
  emitCustomEvent("open-password-dialog", { hasPassword: hasPassword.value })
}

const handlePasswordUpdated = () => checkPassword()

onMounted(() => {
  checkPassword()
  window.addEventListener("password-updated", handlePasswordUpdated)
})

onUnmounted(() => {
  window.removeEventListener("password-updated", handlePasswordUpdated)
})

defineExpose({
  checkPassword,
  openPasswordDialog,
})
</script>

<style lang="scss" scoped>
@use "@/variables" as *;

.encryption-section {
  background: var(--b3-theme-surface);
  border-radius: $radius-md;
  border: 1px solid var(--b3-theme-surface-lighter);
  margin: $spacing-4;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-3 $spacing-4;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
}

.section-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--b3-theme-on-surface);
}

.section-content {
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.status-card,
.info-card {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-3;
  border-radius: $radius-base;
}

.info-card {
  align-items: flex-start;
  background: var(--b3-theme-surface-light);
  border-left: 3px solid var(--b3-theme-primary);
}

.status-card {
  font-size: 13px;
  font-weight: $font-weight-medium;
}

.status-card.has-password {
  background: var(--b3-card-success-background);
  color: var(--b3-card-success-color);
}

.status-card:not(.has-password) {
  background: var(--b3-card-warning-background);
  color: var(--b3-card-warning-color);
}

.info-text {
  font-size: $font-size-xs;
  color: var(--b3-theme-on-surface-light);
  line-height: 1.5;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-3;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: $radius-base;
  background: var(--b3-theme-background);
  cursor: pointer;

  &:hover {
    background: var(--b3-theme-primary-lightest);
    border-color: var(--b3-theme-primary);

    .btn-arrow {
      transform: translateX(3px);
      color: var(--b3-theme-primary);
    }
  }
}

.btn-text {
  flex: 1;
  font-size: 13px;
  font-weight: $font-weight-medium;
  color: var(--b3-theme-on-background);
  text-align: left;
}

.btn-arrow {
  color: var(--b3-theme-on-surface-light);
  transition: transform 0.2s ease;
}
</style>
