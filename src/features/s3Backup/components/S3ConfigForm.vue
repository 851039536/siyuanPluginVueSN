<!-- S3 配置表单组件 — Endpoint/AccessKey/SecretKey/Bucket 等字段输入、连接测试、配置保存 -->
<template>
  <div class="s3-config-form">
    <!-- 区块标题 + 连接状态徽章 + 指引按钮 -->
    <div class="section-header">
      <!-- 标题："S3 配置" -->
      <h4>{{ i18n.s3Config }}</h4>
      <div class="header-actions">
        <!-- 徽章："已连接" / "未连接" -->
        <span
          v-if="connectionStatus"
          class="connection-status"
          :class="connectionStatusClass"
        >
          {{ connectionStatus }}
        </span>
        <!-- 按钮提示："配置指引" -->
        <Button
          variant="ghost"
          size="xsmall"
          icon="help"
          :title="i18n.configGuide"
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
          <!-- 面板标题："配置指引" -->
          <span>{{ i18n.configGuide }}</span>
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
            <!-- 指引："S3 服务地址，不含 http:// 前缀…" -->
            <span class="guide-desc">{{ i18n.guideEndpoint }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Access Key / Secret Key</span>
            <!-- 指引："从 S3 服务管理后台获取…" -->
            <span class="guide-desc">{{ i18n.guideKeys }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Bucket</span>
            <!-- 指引："存储桶名称，需与 S3 服务端创建的桶名一致" -->
            <span class="guide-desc">{{ i18n.guideBucket }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Region</span>
            <!-- 指引："区域标识…通常填 us-east-1 即可" -->
            <span class="guide-desc">{{ i18n.guideRegion }}</span>
          </div>
          <div class="guide-item">
            <span class="guide-label">Path Style</span>
            <!-- 指引："自建服务必须勾选；AWS S3 / Cloudflare R2 通常不勾选" -->
            <span class="guide-desc">{{ i18n.guidePathStyle }}</span>
          </div>
          <div class="guide-item">
            <!-- 标签："使用 HTTPS" -->
            <span class="guide-label">{{ i18n.useSSL }}</span>
            <!-- 指引："服务端配了 HTTPS 证书或反代时勾选…" -->
            <span class="guide-desc">{{ i18n.guideSSL }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <div class="form-grid">
      <!-- Endpoint -->
      <div class="form-group">
        <!-- 输入框标签："Endpoint"，占位："S3 服务地址…" -->
        <Input
          v-model="localConfig.endpoint"
          size="xsmall"
          :label="i18n.endpoint"
          :placeholder="i18n.endpointHint"
        />
      </div>

      <!-- Access Key -->
      <div class="form-group">
        <!-- 输入框标签："Access Key" -->
        <Input
          v-model="localConfig.accessKey"
          size="xsmall"
          :label="i18n.accessKey"
          placeholder="AKIAIOSFODNN7EXAMPLE"
        />
      </div>

      <!-- Secret Key -->
      <div class="form-group">
        <!-- 输入框标签："Secret Key" -->
        <Input
          v-model="localConfig.secretKey"
          type="password"
          show-password
          size="xsmall"
          :label="i18n.secretKey"
          placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        />
      </div>

      <!-- Bucket -->
      <div class="form-group">
        <!-- 输入框标签："Bucket"，占位："存储桶名称" -->
        <Input
          v-model="localConfig.bucket"
          size="xsmall"
          :label="i18n.bucket"
          :placeholder="i18n.bucketHint"
        />
      </div>

      <!-- Region -->
      <div class="form-group">
        <!-- 输入框标签："Region"，占位："区域，如 us-east-1" -->
        <Input
          v-model="localConfig.region"
          size="xsmall"
          :label="i18n.region"
          :placeholder="i18n.regionHint"
        />
      </div>

      <!-- Prefix -->
      <div class="form-group">
        <!-- 输入框标签："目录前缀"，占位："备份文件在桶中的目录路径…" -->
        <Input
          v-model="localConfig.prefix"
          size="xsmall"
          :label="i18n.prefix"
          :placeholder="i18n.prefixHint"
        />
      </div>

      <!-- Path Style -->
      <div class="form-group form-group-checkbox">
        <!-- 开关标签："Path Style" -->
        <Switch
          v-model="localConfig.pathStyle"
          size="xsmall"
          :label="i18n.pathStyle"
        />
        <!-- 提示："使用路径风格访问…" -->
        <span class="form-hint">{{ i18n.pathStyleHint }}</span>
      </div>

      <!-- Use SSL -->
      <div class="form-group form-group-checkbox">
        <!-- 开关标签："使用 HTTPS" -->
        <Switch
          v-model="localConfig.useSSL"
          size="xsmall"
          :label="i18n.useSSL"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="form-actions">
      <!-- 按钮："测试连接" -->
      <Button
        variant="ghost"
        size="xsmall"
        :disabled="isConnecting"
        :loading="isConnecting"
        @click="handleTestConnection"
      >
        {{ i18n.testConnection }}
      </Button>
      <!-- 按钮："保存配置" -->
      <Button
        variant="primary"
        size="xsmall"
        @click="handleSave"
      >
        {{ i18n.saveConfig }}
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
import { computed, reactive, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Switch from "@/components/Switch.vue"
import { getErrorMessage } from "@/utils/stringUtils"
import type { S3Config } from "../types"
import { DEFAULT_S3_CONFIG } from "../types"

// ========== Props ==========

const props = defineProps<{
  /** 当前已保存的 S3 配置（父组件异步加载，挂载时可能为 null） */
  config: S3Config | null
  /** i18n 翻译对象 */
  i18n: Record<string, string>
  /** 测试连接回调（父传服务函数） */
  onTestConnection: (config: S3Config) => Promise<{ success: boolean; message: string }>
}>()

// ========== Emits ==========

const emit = defineEmits<{
  (e: "saved", config: S3Config): void
}>()

// ========== 状态 ==========

const showGuide = ref(false)
const isConnecting = ref(false)
const lastTestResult = ref<{ success: boolean; message: string } | null>(null)

const localConfig = reactive<S3Config>({ ...DEFAULT_S3_CONFIG })

// ========== 计算属性 ==========

const connectionStatus = computed(() => {
  if (!lastTestResult.value) return ""
  // 徽章短文案："已连接" / "未连接"
  return lastTestResult.value.success
    ? props.i18n.statusConnected
    : props.i18n.statusDisconnected
})

const connectionStatusClass = computed(() => {
  if (!lastTestResult.value) return ""
  return lastTestResult.value.success
    ? "status-connected"
    : "status-disconnected"
})

// ========== 方法 ==========

function handleSave(): void {
  // 单事件携带完整配置，父组件负责同步状态 + 持久化
  emit("saved", { ...localConfig })
  lastTestResult.value = null
}

async function handleTestConnection(): Promise<void> {
  if (isConnecting.value) return
  isConnecting.value = true
  lastTestResult.value = null

  try {
    // 仅测试连接，不修改父组件状态（父组件仅在用户点击"保存配置"时更新）
    lastTestResult.value = await props.onTestConnection({ ...localConfig })
  } catch (err: unknown) {
    // 错误前缀："测试异常"
    lastTestResult.value = { success: false, message: `${props.i18n.testException}: ${getErrorMessage(err)}` }
  } finally {
    isConnecting.value = false
  }
}

// ========== 初始化 ==========

// 回填 props.config（immediate 覆盖首次挂载；父组件异步加载完成后再次触发）
watch(
  () => props.config,
  (newConfig) => {
    if (newConfig) {
      Object.assign(localConfig, newConfig)
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use "../styles/S3ConfigForm.scss";
@use "../styles/index.scss";
</style>
