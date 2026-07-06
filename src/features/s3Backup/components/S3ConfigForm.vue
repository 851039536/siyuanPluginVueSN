<template>
  <div class="s3-config-form">
    <div class="section-header">
      <h4>{{ i18n.s3Config || "S3 配置" }}</h4>
      <div class="header-actions">
        <span
          v-if="connectionStatus"
          class="connection-status"
          :class="connectionStatusClass"
        >
          {{ connectionStatus }}
        </span>
        <button
          class="guide-toggle-btn"
          type="button"
          :title="i18n.configGuide || '配置指引'"
          @click="showGuide = !showGuide"
        >
          <Icon :icon="showGuide ? 'mdi:help-circle' : 'mdi:help-circle-outline'" />
        </button>
      </div>
    </div>

    <!-- 配置指引面板 -->
    <Transition name="guide-fade">
      <div
        v-if="showGuide"
        class="config-guide-panel"
      >
        <div class="guide-title">
          <Icon icon="mdi:lightbulb-outline" />
          <span>{{ i18n.configGuide || "配置指引" }}</span>
          <button
            class="guide-close-btn"
            type="button"
            @click="showGuide = false"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="guide-content">
          <div class="guide-item">
            <span class="guide-label">Endpoint</span>
            <span class="guide-desc">{{ i18n.guideEndpoint || "S3 服务地址，不含 http:// 前缀。如 192.168.1.100:5244" }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Access Key / Secret Key</span>
            <span class="guide-desc">{{ i18n.guideKeys || "从 S3 服务管理后台获取。OpenList 在「对象存储」设置中生成" }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Bucket</span>
            <span class="guide-desc">{{ i18n.guideBucket || "存储桶名称，需与 S3 服务端创建的桶名一致" }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Region</span>
            <span class="guide-desc">{{ i18n.guideRegion || "区域标识。MinIO / OpenList 等自建服务通常填 us-east-1 即可" }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Path Style</span>
            <span class="guide-desc">{{ i18n.guidePathStyle || "自建服务（MinIO、OpenList、Ceph）必须勾选；AWS S3 / Cloudflare R2 通常不勾选" }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">{{ i18n.useSSL || "使用 HTTPS" }}</span>
            <span class="guide-desc">{{ i18n.guideSSL || "服务端配了 HTTPS 证书或反代时勾选，本地服务通常不勾选" }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <div class="form-grid">
      <!-- Endpoint -->
      <div class="form-group">
        <label class="form-label">{{ i18n.endpoint || "Endpoint" }}</label>
        <input
          v-model="localConfig.endpoint"
          type="text"
          class="form-input"
          :placeholder="i18n.endpointHint || 'S3 服务地址，如 http://localhost:9000'"
        />
      </div>

      <!-- Access Key -->
      <div class="form-group">
        <label class="form-label">{{ i18n.accessKey || "Access Key" }}</label>
        <input
          v-model="localConfig.accessKey"
          type="text"
          class="form-input"
          placeholder="AKIAIOSFODNN7EXAMPLE"
        />
      </div>

      <!-- Secret Key -->
      <div class="form-group">
        <label class="form-label">{{ i18n.secretKey || "Secret Key" }}</label>
        <div class="password-input-wrapper">
          <input
            v-model="localConfig.secretKey"
            :type="showSecret ? 'text' : 'password'"
            class="form-input"
            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
          />
          <button
            class="toggle-password-btn"
            type="button"
            @click="showSecret = !showSecret"
            :title="showSecret ? '隐藏' : '显示'"
          >
            <Icon :icon="showSecret ? 'mdi:eye-off' : 'mdi:eye'" />
          </button>
        </div>
      </div>

      <!-- Bucket -->
      <div class="form-group">
        <label class="form-label">{{ i18n.bucket || "Bucket" }}</label>
        <input
          v-model="localConfig.bucket"
          type="text"
          class="form-input"
          :placeholder="i18n.bucketHint || '存储桶名称'"
        />
      </div>

      <!-- Region -->
      <div class="form-group">
        <label class="form-label">{{ i18n.region || "Region" }}</label>
        <input
          v-model="localConfig.region"
          type="text"
          class="form-input"
          :placeholder="i18n.regionHint || '区域，如 us-east-1'"
        />
      </div>

      <!-- Prefix -->
      <div class="form-group">
        <label class="form-label">{{ i18n.prefix || "目录前缀" }}</label>
        <input
          v-model="localConfig.prefix"
          type="text"
          class="form-input"
          :placeholder="i18n.prefixHint || 'siyuan-backup/'"
        />
      </div>

      <!-- Path Style -->
      <div class="form-group form-group-checkbox">
        <label class="form-checkbox-label">
          <input
            v-model="localConfig.pathStyle"
            type="checkbox"
            class="form-checkbox"
          />
          <span>{{ i18n.pathStyle || "Path Style" }}</span>
        </label>
        <span class="form-hint">{{ i18n.pathStyleHint || "使用路径风格访问 (bucket 在路径中而非域名中)" }}</span>
      </div>

      <!-- Use SSL -->
      <div class="form-group form-group-checkbox">
        <label class="form-checkbox-label">
          <input
            v-model="localConfig.useSSL"
            type="checkbox"
            class="form-checkbox"
          />
          <span>{{ i18n.useSSL || "使用 HTTPS" }}</span>
        </label>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="form-actions">
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :disabled="isConnecting"
        @click="handleTestConnection"
      >
        <span
          v-if="isConnecting"
          class="vp-spin"
        />
        <span>{{ i18n.testConnection || "测试连接" }}</span>
      </button>
      <button
        class="vp-btn vp-btn--primary vp-btn--sm"
        @click="handleSave"
      >
        {{ i18n.saveConfig || "保存配置" }}
      </button>
    </div>

    <!-- 连接状态消息 -->
    <div
      v-if="lastTestResult"
      class="connection-result"
      :class="lastTestResult.success ? 'success' : 'error'"
    >
      {{ lastTestResult.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import type { S3Config } from "../types"
import { DEFAULT_S3_CONFIG } from "../types"

// ========== Props ==========

interface Props {
  /** 当前已保存的 S3 配置 */
  config?: S3Config | null
  /** i18n 翻译对象 */
  i18n?: Record<string, string>
  /** 测试连接回调 */
  onTestConnection?: (config: S3Config) => Promise<{ success: boolean; message: string }>
}

const props = withDefaults(defineProps<Props>(), {
  config: null,
  i18n: () => ({}),
  onTestConnection: undefined,
})

// ========== Emits ==========

const emit = defineEmits<{
  (e: "configChanged", config: S3Config): void
  (e: "saved"): void
}>()

// ========== 状态 ==========

const showSecret = ref(false)
const showGuide = ref(false)
const isConnecting = ref(false)
const lastTestResult = ref<{ success: boolean; message: string } | null>(null)

const localConfig = reactive<S3Config>({ ...DEFAULT_S3_CONFIG })

// ========== 计算属性 ==========

const connectionStatus = computed(() => {
  if (!lastTestResult.value) return ""
  return lastTestResult.value.success
    ? (props.i18n.connectionSuccess || "已连接")
    : (props.i18n.connectionFailed || "未连接")
})

const connectionStatusClass = computed(() => {
  if (!lastTestResult.value) return ""
  return lastTestResult.value.success
    ? "status-connected"
    : "status-disconnected"
})

// ========== 方法 ==========

function handleSave(): void {
  emit("configChanged", { ...localConfig })
  emit("saved")
  lastTestResult.value = null
}

async function handleTestConnection(): Promise<void> {
  if (isConnecting.value) return
  isConnecting.value = true
  lastTestResult.value = null

  try {
    // 先保存配置再测试
    emit("configChanged", { ...localConfig })

    if (props.onTestConnection) {
      lastTestResult.value = await props.onTestConnection({ ...localConfig })
    } else {
      lastTestResult.value = { success: false, message: "未提供连接测试功能" }
    }
  } catch (err: any) {
    lastTestResult.value = { success: false, message: `测试异常: ${err.message}` }
  } finally {
    isConnecting.value = false
  }
}

// ========== 初始化 ==========

onMounted(() => {
  if (props.config) {
    Object.assign(localConfig, props.config)
  }
})

// 监听 props.config 异步加载（父组件 onMounted 是异步的，子组件挂载时可能还为 null）
watch(
  () => props.config,
  (newConfig) => {
    if (newConfig) {
      Object.assign(localConfig, newConfig)
    }
  },
)
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.s3-config-form {
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-4;

    h4 {
      margin: 0;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
    }

    .connection-status {
      font-size: $font-size-xs;
      padding: 2px $spacing-2;
      border-radius: $vp-radius;

      &.status-connected {
        color: $brand-success;
        background: hsl(142, 76%, 36%, 0.1);
      }

      &.status-disconnected {
        color: $brand-destructive;
        background: hsl(0, 72%, 51%, 0.1);
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: $spacing-2;
    }

    .guide-toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: none;
      cursor: pointer;
      color: var(--b3-theme-on-surface-light);
      font-size: 18px;
      transition: color 0.15s, background 0.15s;

      &:hover {
        color: var(--b3-theme-primary);
        background: hsl(210, 80%, 50%, 0.08);
      }
    }
  }

  .config-guide-panel {
    margin-bottom: $spacing-4;
    padding: $spacing-3;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: $vp-radius;
    background: hsl(45, 90%, 50%, 0.04);

    .guide-title {
      display: flex;
      align-items: center;
      gap: $spacing-1;
      font-size: $font-size-sm;
      font-weight: $font-weight-semibold;
      color: var(--b3-theme-on-surface);
      margin-bottom: $spacing-2;

      .guide-close-btn {
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: none;
        cursor: pointer;
        color: var(--b3-theme-on-surface-light);
        font-size: 14px;

        &:hover {
          color: var(--b3-theme-on-surface);
          background: hsl(0, 0%, 50%, 0.1);
        }
      }
    }

    .guide-content {
      display: flex;
      flex-direction: column;
      gap: $spacing-1;
    }

    .guide-item {
      display: flex;
      align-items: baseline;
      gap: $spacing-2;
      font-size: $font-size-xs;
      line-height: 1.5;

      .guide-label {
        flex-shrink: 0;
        min-width: 120px;
        font-weight: $font-weight-medium;
        color: var(--b3-theme-on-surface);
      }

      .guide-desc {
        color: var(--b3-theme-on-surface-light);
      }
    }
  }

  .guide-fade-enter-active,
  .guide-fade-leave-active {
    transition: opacity 0.2s ease, max-height 0.25s ease;
    overflow: hidden;
  }

  .guide-fade-enter-from,
  .guide-fade-leave-to {
    opacity: 0;
    max-height: 0;
  }

  .guide-fade-enter-to,
  .guide-fade-leave-from {
    opacity: 1;
    max-height: 400px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $spacing-3;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
    min-width: 0;

    &.form-group-checkbox {
      grid-column: 1 / -1;
    }
  }

  .form-label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: var(--b3-theme-on-surface);
  }

  .form-input {
    width: 100%;
    padding: $spacing-2 $spacing-3;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: $vp-radius;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: $font-size-sm;
    box-sizing: border-box;
    transition: border-color 0.15s;

    &:focus {
      outline: none;
      border-color: var(--b3-theme-primary);
    }
  }

  .password-input-wrapper {
    position: relative;
    box-sizing: border-box;

    .form-input {
      padding-right: 36px;
    }

    .toggle-password-btn {
      position: absolute;
      right: $spacing-2;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--b3-theme-on-surface-light);
      padding: 2px;
      display: flex;
      align-items: center;

      &:hover {
        color: var(--b3-theme-on-surface);
      }
    }
  }

  .form-checkbox-label {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    font-size: $font-size-sm;
    cursor: pointer;

    .form-checkbox {
      width: 16px;
      height: 16px;
      accent-color: var(--b3-theme-primary);
    }
  }

  .form-hint {
    font-size: $font-size-xs;
    color: var(--b3-theme-on-surface-light);
    margin-top: 2px;
  }

  .form-actions {
    display: flex;
    gap: $spacing-2;
    margin-top: $spacing-4;
  }

  .connection-result {
    margin-top: $spacing-3;
    padding: $spacing-2 $spacing-3;
    border-radius: $vp-radius;
    font-size: $font-size-sm;

    &.success {
      color: $brand-success;
      background: hsl(142, 76%, 36%, 0.08);
    }

    &.error {
      color: $brand-destructive;
      background: hsl(0, 72%, 51%, 0.08);
    }
  }
}
</style>
