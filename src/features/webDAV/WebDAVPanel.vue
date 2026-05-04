<template>
  <div class="webdav-panel">
    <div class="webdav-header">
      <h3>{{ i18n.panelTitle || 'WebDAV同步' }}</h3>
      <div class="header-actions">
        <button
          class="btn btn-secondary btn-small"
          :disabled="testingConnection"
          @click="handleTestConnection"
        >
          <Icon
            :icon="testingConnection ? 'mdi:loading' : 'mdi:link'"
            :class="{ 'spin-icon': testingConnection }"
          />
          {{ i18n.testConnection || '测试连接' }}
        </button>
        <button
          class="btn btn-primary btn-small"
          :disabled="syncing || !isConfigured"
          @click="handleSyncNow"
        >
          <Icon
            :icon="syncing ? 'mdi:loading' : 'mdi:sync'"
            :class="{ 'spin-icon': syncing }"
          />
          {{ i18n.syncNow || '立即同步' }}
        </button>
        <button
          class="btn btn-icon btn-text"
          :title="i18n.close || '关闭'"
          @click="closePanel"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>
    </div>

    <div class="webdav-content">
      <ConnectionStatus
        :status="state.connectionStatus"
        :text="statusText"
      />

      <FileList
        v-if="state.connectionStatus === 'connected'"
        :files="state.fileList"
        :currentPath="state.currentPath"
        :loading="state.loadingFiles"
        :i18n="i18n"
        @refresh="handleRefreshFileList"
        @navigate="handleNavigate"
        @download="handleDownload"
      />

      <div class="config-section">
        <div class="section-title">
          {{ i18n.serverConfig || '服务器配置' }}
        </div>

        <div class="form-group">
          <label>{{ i18n.serverUrl || '服务器地址' }}</label>
          <div class="input-wrapper">
            <input
              v-model="localConfig.serverUrl"
              type="text"
              :placeholder="i18n.serverUrlPlaceholder || 'https://dav.example.com'"
              @input="debouncedSave"
            />
          </div>
          <div class="setting-desc">
            {{ i18n.serverUrlDesc || 'WebDAV服务器完整地址' }}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>{{ i18n.username || '用户名' }}</label>
            <input
              v-model="localConfig.username"
              type="text"
              :placeholder="i18n.usernamePlaceholder || '输入用户名'"
              @input="debouncedSave"
            />
          </div>
          <div class="form-group">
            <label>{{ i18n.password || '密码' }}</label>
            <div class="input-wrapper">
              <input
                v-model="localConfig.password"
                :type="passwordVisible ? 'text' : 'password'"
                :placeholder="i18n.passwordPlaceholder || '输入密码'"
                @input="debouncedSave"
              />
              <button
                class="btn btn-icon btn-text toggle-visibility-btn"
                :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
                @click="passwordVisible = !passwordVisible"
              >
                <Icon :icon="passwordVisible ? 'mdi:eye-off' : 'mdi:eye'" />
              </button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>{{ i18n.basePath || '基础路径' }}</label>
          <input
            v-model="localConfig.basePath"
            type="text"
            :placeholder="i18n.basePathPlaceholder || '/dav'"
            @input="debouncedSave"
          />
          <div class="setting-desc">
            {{ i18n.basePathDesc || 'WebDAV服务的基础路径' }}
          </div>
        </div>
      </div>

      <div class="config-section">
        <div class="section-title">
          {{ i18n.syncSettings || '同步设置' }}
        </div>

        <div class="form-group">
          <div class="checkbox-label">
            <input
              id="autoSync"
              v-model="localConfig.autoSync"
              type="checkbox"
              @change="saveConfig"
            />
            <label for="autoSync">{{ i18n.autoSync || '自动同步' }}</label>
          </div>
          <div class="setting-desc">
            {{ i18n.autoSyncDesc || '启用后自动定期同步数据' }}
          </div>
        </div>

        <div
          v-if="localConfig.autoSync"
          class="form-group"
        >
          <label>{{ i18n.syncInterval || '同步间隔' }}</label>
          <select
            v-model="localConfig.syncInterval"
            @change="saveConfig"
          >
            <option :value="5">
              5 {{ i18n.minutes || '分钟' }}
            </option>
            <option :value="15">
              15 {{ i18n.minutes || '分钟' }}
            </option>
            <option :value="30">
              30 {{ i18n.minutes || '分钟' }}
            </option>
            <option :value="60">
              1 {{ i18n.hour || '小时' }}
            </option>
            <option :value="120">
              2 {{ i18n.hours || '小时' }}
            </option>
          </select>
          <div class="setting-desc">
            {{ i18n.syncIntervalDesc || '自动同步的时间间隔' }}
          </div>
        </div>
      </div>

      <div
        v-if="state.lastSyncTime"
        class="sync-history"
      >
        <div class="history-header">
          <span>{{ i18n.lastSync || '最后同步' }}</span>
          <span class="sync-time">{{ formatTime(state.lastSyncTime) }}</span>
        </div>
      </div>

      <SyncLogs
        v-if="state.syncLogs.length > 0"
        :logs="state.syncLogs"
        :i18n="i18n"
        @clear="clearLogsAction"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WebDAVConfig } from "@/config/settings"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import {
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import {
  ConnectionStatus,
  FileList,
  SyncLogs,
} from "./components"
import { useWebDAV } from "./composables"
import { webDAVService } from "./services/webDAVService"
import { formatTime } from "./utils"

interface Props {
  config: WebDAVConfig
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const localConfig = ref<WebDAVConfig>({ ...props.config })
const i18nRef = ref({ value: props.i18n })
const {
  state,
  testingConnection,
  syncing,
  passwordVisible,
  isConfigured,
  statusText,
  testConnection,
  fetchFileList,
  syncNow,
  clearLogs: clearLogsAction,
} = useWebDAV(i18nRef)

watch(
  () => props.i18n,
  (newI18n) => {
    i18nRef.value.value = newI18n
  },
  { deep: true },
)

let saveTimeout: ReturnType<typeof setTimeout> | null = null

const debouncedSave = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(() => {
    saveConfig()
  }, 500)
}

const saveConfig = () => {
  emitCustomEvent("updateWebDAVConfig", { config: localConfig.value })
}

const handleTestConnection = async () => {
  if (!localConfig.value.serverUrl) {
    showMessage(
      props.i18n.pleaseEnterServerUrl || "请输入服务器地址",
      3000,
      "error",
    )
    return
  }
  await testConnection(localConfig.value)
  if (state.connectionStatus === "connected") {
    showMessage(props.i18n.connectionSuccess || "连接成功", 3000, "info")
  }
}

const handleSyncNow = async () => {
  const success = await syncNow(localConfig.value)
  if (success) {
    // showMessage(props.i18n.syncCompleted || '同步完成', 3000, 'success')
  }
}

const handleRefreshFileList = async () => {
  await fetchFileList(localConfig.value)
}

const handleNavigate = async (path: string) => {
  await fetchFileList(localConfig.value, path)
}

const handleDownload = async (file: any) => {
  try {
    const blob = await webDAVService.downloadFile(localConfig.value, file)

    if (blob) {
      webDAVService.downloadBlob(blob, file.name)
    } else {
      showMessage(props.i18n.downloadFailed || "下载失败", 3000, "error")
    }
  } catch (error) {
    console.error("[WebDAV] 下载错误:", error)
    showMessage(props.i18n.downloadFailed || "下载失败", 3000, "error")
  }
}

const closePanel = () => {
  emitCustomEvent("closeWebDAV")
}

watch(
  () => props.config,
  (newConfig) => {
    localConfig.value = { ...newConfig }
  },
  { deep: true },
)

onMounted(() => {
  state.connectionStatus = "unknown"
  state.fileList = []
  state.currentPath = ""
  state.syncLogs = []
  window.addEventListener("webDAVConfigUpdated", handleConfigUpdate)
})

onUnmounted(() => {
  window.removeEventListener("webDAVConfigUpdated", handleConfigUpdate)
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
})

const handleConfigUpdate = (event: CustomEvent) => {
  const { config } = event.detail
  if (config) {
    localConfig.value = { ...config }
  }
}
</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
