<template>
  <div class="encryption-section">
    <div class="section-header">
      <span class="section-title">{{ i18n.passwordSetting || '文档加密' }}</span>
    </div>

    <div class="section-content">
      <!-- 密码状态显示 -->
      <div class="status-card" :class="{ 'has-password': hasPassword }">
        <span class="status-icon">{{ hasPassword ? '✓' : '⚠' }}</span>
        <span class="status-text">
          {{ hasPassword ? (i18n.passwordSet || '密码已设置') : (i18n.passwordNotSet || '尚未设置密码') }}
        </span>
      </div>

      <!-- 密码说明 -->
      <div class="info-card">
        <span class="info-icon">ℹ</span>
        <span class="info-text">{{ i18n.passwordSettingDesc || '设置全局加密密码，用于锁定文档' }}</span>
      </div>

      <!-- 设置/更新密码按钮 -->
      <button class="action-btn" @click="openPasswordDialog">
        <span class="btn-icon">🔑</span>
        <span class="btn-text">
          {{ hasPassword ? (i18n.updatePassword || '更新密码') : (i18n.setPassword || '设置密码') }}
        </span>
        <span class="btn-arrow">→</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { usePlugin } from "@/main";
import { emitCustomEvent } from "@/utils/eventBus";
import type PluginSample from "@/index";

interface Props {
	i18n?: any;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
});

const plugin = usePlugin() as PluginSample;
const hasPassword = ref(false);

import { GeneralSettingsStorage } from "../types/storage";

const gsStorage = new GeneralSettingsStorage(plugin);

// 检查是否已设置密码
async function checkPassword() {
	try {
		const password = await gsStorage.password.load();
		hasPassword.value = !!password;
	} catch (error) {
		console.error("检查密码失败:", error);
		hasPassword.value = false;
	}
}

// 打开密码设置对话框
function openPasswordDialog() {
	emitCustomEvent("open-password-dialog", { hasPassword: hasPassword.value });
}

const handlePasswordUpdated = () => checkPassword();

onMounted(() => {
	checkPassword();
	window.addEventListener("password-updated", handlePasswordUpdated);
});

onUnmounted(() => {
	window.removeEventListener("password-updated", handlePasswordUpdated);
});

defineExpose({
	checkPassword,
	openPasswordDialog,
});
</script>

<style scoped>
.encryption-section {
  background: var(--b3-theme-surface);
  border-radius: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  margin: 16px;
  overflow: hidden;
}

.section-header {
  padding: 12px 16px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.section-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-card,
.info-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
}

.info-card {
  align-items: flex-start;
  background: var(--b3-theme-surface-light);
  border-left: 3px solid var(--b3-theme-primary);
}

.status-card {
  font-size: 13px;
  font-weight: 500;
}

.status-card.has-password {
  background: var(--b3-card-success-background);
  color: var(--b3-card-success-color);
}

.status-card:not(.has-password) {
  background: var(--b3-card-warning-background);
  color: var(--b3-card-warning-color);
}

.status-icon,
.info-icon {
  flex-shrink: 0;
}

.status-icon {
  font-size: 14px;
}

.info-icon {
  font-size: 13px;
  color: var(--b3-theme-primary);
}

.info-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  line-height: 1.5;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  cursor: pointer;
}

.action-btn:hover {
  background: var(--b3-theme-primary-lightest);
  border-color: var(--b3-theme-primary);
}

.btn-icon {
  font-size: 16px;
}

.btn-text {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  text-align: left;
}

.btn-arrow {
  font-size: 14px;
  color: var(--b3-theme-on-surface-light);
}

.action-btn:hover .btn-arrow {
  transform: translateX(3px);
  color: var(--b3-theme-primary);
}
</style>
