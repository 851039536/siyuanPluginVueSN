<template>
  <div class="encryption-section">
    <div class="section-header">
      <span class="section-title">{{ plugin.i18n.contentEncryption || '内容加密' }}</span>
    </div>

    <div class="section-content">
      <!-- 密码状态 -->
      <div class="status-card" :class="{ 'has-password': hasPassword }">
        <span class="status-icon">{{ hasPassword ? '✓' : '⚠' }}</span>
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
      <button class="save-btn" @click="handleSavePassword">
        {{ hasPassword ? plugin.i18n.changePassword : plugin.i18n.save }}
      </button>

      <!-- 提示信息 -->
      <div class="info-card">
        <span class="info-icon">ℹ</span>
        <div class="info-content">
          <span class="info-text">{{ plugin.i18n.encryptionTip }}</span>
          <span class="info-sub">{{ plugin.i18n.algorithmInfo }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated } from "vue";
import { showMessage, type Plugin } from "siyuan";
import { getEncryptionInstance } from "../../encryption";

const props = defineProps<{
  plugin: Plugin;
}>();

const newPassword = ref("");
const confirmPassword = ref("");
const hasPassword = ref(false);

onMounted(() => {
  checkPasswordStatus();
});

onActivated(() => {
  checkPasswordStatus();
});

function checkPasswordStatus() {
  const encryption = getEncryptionInstance();
  if (encryption) {
    hasPassword.value = encryption.hasPassword();
  }
}

async function handleSavePassword() {
  const pwd1 = newPassword.value.trim();
  const pwd2 = confirmPassword.value.trim();

  if (!pwd1) {
    showMessage(props.plugin.i18n.passwordEmpty, 3000, "error");
    return;
  }

  if (pwd1 !== pwd2) {
    showMessage(props.plugin.i18n.passwordMismatch, 3000, "error");
    return;
  }

  const encryption = getEncryptionInstance();
  if (encryption) {
    encryption.setPassword(pwd1);
    await encryption.savePassword();
    showMessage(props.plugin.i18n.passwordSetSuccess, 2000, "info");
    newPassword.value = "";
    confirmPassword.value = "";
    checkPasswordStatus();
  }
}
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

.status-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
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

.status-icon {
  font-size: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  font-size: 13px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.form-group input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
}

.save-btn {
  padding: 10px 16px;
  border: none;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.save-btn:hover {
  opacity: 0.9;
}

.info-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--b3-theme-surface-light);
  border-radius: 6px;
  border-left: 3px solid var(--b3-theme-primary);
}

.info-icon {
  font-size: 13px;
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  line-height: 1.5;
}

.info-sub {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.8;
}
</style>
