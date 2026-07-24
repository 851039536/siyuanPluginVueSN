<!-- S3 配置表单组件 — Endpoint/AccessKey/SecretKey/Bucket 等字段输入、连接测试、配置保存 -->
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
        <Button
          variant="ghost"
          size="xsmall"
          icon="help"
          :title="i18n.configGuide || '配置指引'"
          @click="showGuide = !showGuide"
        />
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
          <Button
            variant="ghost"
            size="xsmall"
            icon="close"
            @click="showGuide = false"
          />
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
        <Input
          v-model="localConfig.endpoint"
          size="xsmall"
          :label="i18n.endpoint || 'Endpoint'"
          :placeholder="i18n.endpointHint || 'S3 服务地址，如 http://localhost:9000'"
        />
      </div>

      <!-- Access Key -->
      <div class="form-group">
        <Input
          v-model="localConfig.accessKey"
          size="xsmall"
          :label="i18n.accessKey || 'Access Key'"
          placeholder="AKIAIOSFODNN7EXAMPLE"
        />
      </div>

      <!-- Secret Key -->
      <div class="form-group">
        <Input
          v-model="localConfig.secretKey"
          type="password"
          show-password
          size="xsmall"
          :label="i18n.secretKey || 'Secret Key'"
          placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        />
      </div>

      <!-- Bucket -->
      <div class="form-group">
        <Input
          v-model="localConfig.bucket"
          size="xsmall"
          :label="i18n.bucket || 'Bucket'"
          :placeholder="i18n.bucketHint || '存储桶名称'"
        />
      </div>

      <!-- Region -->
      <div class="form-group">
        <Input
          v-model="localConfig.region"
          size="xsmall"
          :label="i18n.region || 'Region'"
          :placeholder="i18n.regionHint || '区域，如 us-east-1'"
        />
      </div>

      <!-- Prefix -->
      <div class="form-group">
        <Input
          v-model="localConfig.prefix"
          size="xsmall"
          :label="i18n.prefix || '目录前缀'"
          :placeholder="i18n.prefixHint || 'siyuan-backup/'"
        />
      </div>

      <!-- Path Style -->
      <div class="form-group form-group-checkbox">
        <Switch
          :model-value="localConfig.pathStyle"
          size="xsmall"
          :label="i18n.pathStyle || 'Path Style'"
          @update:model-value="localConfig.pathStyle = $event"
        />
        <span class="form-hint">{{ i18n.pathStyleHint || "使用路径风格访问 (bucket 在路径中而非域名中)" }}</span>
      </div>

      <!-- Use SSL -->
      <div class="form-group form-group-checkbox">
        <Switch
          :model-value="localConfig.useSSL"
          size="xsmall"
          :label="i18n.useSSL || '使用 HTTPS'"
          @update:model-value="localConfig.useSSL = $event"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="form-actions">
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isConnecting"
        :loading="isConnecting"
        @click="handleTestConnection"
      >
        {{ i18n.testConnection || "测试连接" }}
      </Button>
      <Button
        variant="primary"
        size="xsmall"
        @click="handleSave"
      >
        {{ i18n.saveConfig || "保存配置" }}
      </Button>
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
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Switch from "@/components/Switch.vue"
import { getErrorMessage } from "@/utils/stringUtils"
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
    // 仅测试连接，不修改父组件状态（父组件仅在用户点击"保存配置"时更新）
    if (props.onTestConnection) {
      lastTestResult.value = await props.onTestConnection({ ...localConfig })
    } else {
      lastTestResult.value = { success: false, message: "未提供连接测试功能" }
    }
  } catch (err: unknown) {
    lastTestResult.value = { success: false, message: `测试异常: ${getErrorMessage(err)}` }
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
@use "../styles/S3ConfigForm.scss";
@use "../styles/index.scss";
</style>
