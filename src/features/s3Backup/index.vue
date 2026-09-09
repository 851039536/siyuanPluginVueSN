<!-- S3 备份主面板 — Tab 壳与初始化编排：备份 Tab 委托 BackupTab，编排状态来自 useBackupOrchestrator -->
<template>
  <div class="s3-backup-panel">
    <!-- 头部 -->
    <div class="s3-backup-header">
      <span class="s3-backup-header-title">{{ i18n.s3Backup }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="close"
        @click="handleClose"
      />
    </div>

    <!-- Tab 栏 -->
    <div class="s3-tab-bar">
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'backup' }"
        @click="activeTab = 'backup'"
      >
        {{ i18n.backupTab }}
      </button>
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'config' }"
        @click="activeTab = 'config'"
      >
        {{ i18n.configTab }}
      </button>
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'log' }"
        @click="activeTab = 'log'"
      >
        {{ i18n.logTab }}
      </button>
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'checksums' }"
        @click="activeTab = 'checksums'"
      >
        {{ i18n.checksumsTab }}
      </button>
    </div>

    <!-- Tab: 备份（视图与操作在 BackupTab） -->
    <BackupTab
      v-if="activeTab === 'backup'"
      :orch="orch"
      :i18n="i18n"
    />

    <!-- Tab: 配置 -->
    <div
      v-if="activeTab === 'config'"
      class="settings-container"
    >
      <BackupModeSelector
        :model-value="orch.backupModeLocal"
        :i18n="i18n"
        @update:model-value="orch.onBackupModeChanged"
      />

      <AutoBackupCard
        v-model:auto-backup-enabled="orch.autoBackupEnabled"
        v-model:backup-frequency="orch.backupFrequency"
        v-model:backup-time="orch.backupTime"
        v-model:keep-backup-count="orch.keepBackupCount"
        :i18n="i18n"
        @update:auto-backup-enabled="orch.saveWorkspaceSettings()"
        @update:backup-frequency="orch.saveWorkspaceSettings()"
        @update:backup-time="orch.saveWorkspaceSettings()"
        @update:keep-backup-count="orch.saveWorkspaceSettings()"
      />

      <section class="card-section">
        <S3ConfigForm
          :config="s3ConfigLocal"
          :i18n="i18n"
          :on-test-connection="orch.testConnection"
          @saved="handleConfigSaved"
        />
      </section>
    </div>

    <!-- Tab: 日志 -->
    <div
      v-if="activeTab === 'log'"
      class="settings-container"
    >
      <BackupLogCard
        :logs="backupLogs"
        :i18n="i18n"
        @clear="clearLogs"
      />
    </div>

    <!-- Tab: 校验 -->
    <div
      v-if="activeTab === 'checksums'"
      class="settings-container"
    >
      <FileChecksumsCard
        :stored-items="checksums"
        :workspace-root="orch.workspaceRoot"
        :i18n="i18n"
        @clear="clearChecksums"
        @remove-one="removeOneChecksum"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { showMessage } from "siyuan"
import { encryptSetting, decryptSetting } from "@/utils/settingsCrypto"
import { useBackupLogs } from "./composables/useBackupLogs"
import { useChecksums } from "./composables/useChecksums"
import { useBackupOrchestrator } from "./composables/useBackupOrchestrator"
import type { BackupOrchestrator } from "./composables/useBackupOrchestrator"
import { getS3BackupInstance } from "./instance"
import type { S3Config, S3BackupStorage } from "./types"
import S3ConfigForm from "./components/S3ConfigForm.vue"
import BackupLogCard from "./components/BackupLogCard.vue"
import FileChecksumsCard from "./components/FileChecksumsCard.vue"
import BackupModeSelector from "./components/BackupModeSelector.vue"
import AutoBackupCard from "./components/AutoBackupCard.vue"
import BackupTab from "./components/BackupTab.vue"
import Button from "@/components/Button.vue"

// ========== Props ==========

interface Props {
  i18n?: Record<string, string>
  onClose?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  onClose: () => {},
})

// ========== Tab 状态 ==========

const activeTab = ref<"backup" | "config" | "log" | "checksums">("backup")

// ========== 日志 / 校验值管理（composable，仅 log/checksums Tab 使用） ==========

/** 持久化辅助：统一「获取实例 → 存储槽 save」样板 */
async function persistStorage(save: (storage: S3BackupStorage) => Promise<unknown>): Promise<void> {
  const instance = getS3BackupInstance()
  if (instance) { await save(instance.getStorage()) }
}

const { backupLogs, addLog, clearLogs } = useBackupLogs({ persist: persistStorage })
const { checksums, saveChecksum, persistChecksums, clearChecksums, removeOneChecksum } = useChecksums({ persist: persistStorage })

// ========== 备份编排（聚合状态 + 四入口互斥 + 自动备份） ==========

const orch: BackupOrchestrator = useBackupOrchestrator({
  i18n: props.i18n,
  addLog: (entry) => addLog(entry),
  saveChecksum,
  persistChecksums,
})

// ========== S3 配置管理 ==========

const s3ConfigLocal = ref<S3Config | null>(null)

/** 子组件 saved 事件携带完整配置：同步本地引用 + 应用 + 加密持久化 */
async function handleConfigSaved(config: S3Config): Promise<void> {
  s3ConfigLocal.value = config
  orch.applyConfig(config)

  const instance = getS3BackupInstance()
  if (instance) {
    // S3 凭证加密存储，防止 accessKey/secretKey 明文暴露
    const encrypted: S3Config = {
      ...config,
      accessKey: await encryptSetting(config.accessKey),
      secretKey: await encryptSetting(config.secretKey),
    }
    await instance.getStorage().s3Config.save(encrypted)
  }
  showMessage(props.i18n.configSaved, 2000, "info")
  // 首次配置保存后自动加载云端列表，无需再手动点刷新
  void orch.refreshBackupList()
}

// ========== 对话框关闭 ==========

function handleClose(): void {
  if (orch.isAnyTaskRunning) {
    // 关闭确认："正在备份中，关闭窗口不会中断备份。确定要隐藏窗口吗？"
    if (!confirm(props.i18n.closeWhileBackingUp)) { return }
  }
  props.onClose?.()
}

// ========== 初始化 ==========

onMounted(async () => {
  // 加载保存的 S3 配置
  const instance = getS3BackupInstance()
  try {
    if (instance) {
      const savedConfig = await instance.getStorage().s3Config.load()
      if (savedConfig) {
        // 解密 S3 凭证（旧数据无 enc: 前缀则原样返回，向后兼容）
        const decrypted: S3Config = {
          ...savedConfig,
          accessKey: await decryptSetting(savedConfig.accessKey),
          secretKey: await decryptSetting(savedConfig.secretKey),
        }
        orch.loadConfig(decrypted)
        s3ConfigLocal.value = decrypted
      }
    }
  } catch (err) {
    console.error("加载 S3 配置失败:", err)
  }

  // 编排初始化：加载工作区设置 / 检测路径 / 初始化管理器与备份列表
  await orch.init()

  // 并行加载操作日志 / 校验值 / 上传来源映射（复用同一 instance）
  if (instance) {
    const storage = instance.getStorage()
    await Promise.all([
      storage.backupLogs.load().then((data) => {
        if (data?.logs) { backupLogs.value = data.logs }
      }).catch(() => { /* ignore */ }),
      storage.checksums.load().then((data) => {
        if (data?.items) { checksums.value = data.items }
      }).catch(() => { /* ignore */ }),
      storage.uploadHostMap.load().then((data) => {
        // ref 由编排聚合 reactive 解包，直接对属性赋值即写入底层 ref
        if (data?.map) { orch.uploadHostMap = data.map }
      }).catch(() => { /* ignore */ }),
    ])
  }

  // 注册自动备份事件监听
  window.addEventListener("autoBackupTrigger", orch.handleAutoBackupTrigger)
})

onUnmounted(() => {
  window.removeEventListener("autoBackupTrigger", orch.handleAutoBackupTrigger)
  // 卸载时清除状态栏任务，避免残留条目
  orch.statusTask.clear()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
