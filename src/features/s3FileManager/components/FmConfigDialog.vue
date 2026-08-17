<!-- S3 配置弹窗 — 自包含：onMounted 自加载、保存自持久化（加密凭证）、支持测试连接与从 S3 备份导入 -->
<template>
  <div
    class="fm-dialog-mask"
    @click.self="$emit('close')"
  >
    <div class="fm-dialog fm-config-dialog">
      <!-- 弹窗标题："S3 配置" -->
      <div class="fm-dialog-header">
        <span class="fm-dialog-title">{{ i18n.configTitle }}</span>
        <Button
          variant="ghost"
          size="xsmall"
          icon="close"
          :icon-size="14"
          @click="$emit('close')"
        />
      </div>

      <div class="fm-dialog-body">
        <div class="fm-config-grid">
          <!-- Endpoint -->
          <Input
            v-model="form.endpoint"
            size="small"
            :label="i18n.endpoint"
            :placeholder="i18n.endpointHint"
          />
          <!-- Access Key -->
          <Input
            v-model="form.accessKey"
            size="small"
            :label="i18n.accessKey"
            placeholder="AKIAIOSFODNN7EXAMPLE"
          />
          <!-- Secret Key -->
          <Input
            v-model="form.secretKey"
            type="password"
            show-password
            size="small"
            :label="i18n.secretKey"
            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
          />
          <!-- Bucket -->
          <Input
            v-model="form.bucket"
            size="small"
            :label="i18n.bucket"
            :placeholder="i18n.bucketHint"
          />
          <!-- Region -->
          <Input
            v-model="form.region"
            size="small"
            :label="i18n.region"
            :placeholder="i18n.regionHint"
          />
          <!-- 目录前缀（浏览根） -->
          <Input
            v-model="form.prefix"
            size="small"
            :label="i18n.prefix"
            :placeholder="i18n.prefixHint"
          />
          <!-- 上传超时（秒） -->
          <Input
            v-model="form.uploadTimeoutSec"
            type="number"
            size="small"
            :label="i18n.uploadTimeoutSec"
            :placeholder="String(DEFAULT_S3_CONFIG.uploadTimeoutSec)"
          />
        </div>

        <div class="fm-config-switches">
          <!-- 开关："Path Style" -->
          <Switch
            v-model="form.pathStyle"
            size="small"
            :label="i18n.pathStyle"
          />
          <!-- 开关："使用 HTTPS" -->
          <Switch
            v-model="form.useSSL"
            size="small"
            :label="i18n.useSSL"
          />
          <!-- 开关："允许自签名证书" -->
          <Switch
            v-model="form.allowSelfSigned"
            size="small"
            :label="i18n.allowSelfSigned"
          />
        </div>

        <!-- 连接测试结果 -->
        <div
          v-if="testResult"
          class="fm-config-result"
          :class="testResult.success ? 'success' : 'error'"
        >
          {{ testResult.message }}
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="fm-dialog-footer">
        <!-- 按钮："从 S3 备份导入" -->
        <Button
          variant="ghost"
          size="small"
          :title="i18n.importFromBackupHint"
          @click="handleImport"
        >
          {{ i18n.importFromBackup }}
        </Button>
        <div class="fm-dialog-footer-right">
          <!-- 按钮："测试连接" -->
          <Button
            variant="ghost"
            size="small"
            :loading="testing"
            :disabled="testing"
            @click="handleTest"
          >
            {{ i18n.testConnection }}
          </Button>
          <!-- 按钮："保存" -->
          <Button
            variant="primary"
            size="small"
            :loading="saving"
            :disabled="saving"
            @click="handleSave"
          >
            {{ i18n.save }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue"
import { showMessage } from "siyuan"
import type { S3Config } from "@/utils/s3/types"
import { DEFAULT_S3_CONFIG } from "@/utils/s3/types"
import { S3Client } from "@/utils/s3/s3Client"
import { encryptSetting, decryptSetting } from "@/utils/settingsCrypto"
import { getErrorMessage } from "@/utils/stringUtils"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Switch from "@/components/Switch.vue"
import type { S3FileManagerI18n } from "../types"
import type { S3FileManagerStorage } from "../types/storage"
import { useEscClose } from "../composables/useEscClose"

const props = defineProps<{
  storage: S3FileManagerStorage
  i18n: S3FileManagerI18n
}>()

const emit = defineEmits<{
  /** 保存成功（携带应用后的配置，父组件据此重建客户端并刷新） */
  saved: [config: S3Config]
  close: []
}>()

const form = reactive<S3Config>({ ...DEFAULT_S3_CONFIG })
const testing = ref(false)
const saving = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// Esc 关闭弹窗
useEscClose(() => emit("close"))

/** 归一化超时字段（空值/非法值回退默认） */
function normalizeTimeout(value: unknown): number {
  const timeout = Number(value)
  return Number.isFinite(timeout) && timeout > 0 ? Math.round(timeout) : DEFAULT_S3_CONFIG.uploadTimeoutSec
}

/** 归一化并快照当前表单为 S3Config */
function snapshot(): S3Config {
  return { ...form, uploadTimeoutSec: normalizeTimeout(form.uploadTimeoutSec) }
}

/** 挂载时自加载已保存配置（解密凭证） */
onMounted(async () => {
  try {
    const saved = await props.storage.config.loadOrDefault()
    Object.assign(form, {
      ...saved,
      accessKey: await decryptSetting(saved.accessKey),
      secretKey: await decryptSetting(saved.secretKey),
      uploadTimeoutSec: normalizeTimeout(saved.uploadTimeoutSec),
    })
  } catch (err) {
    console.error("[S3文件管理] 配置加载失败:", getErrorMessage(err))
  }
})

async function handleTest(): Promise<void> {
  if (testing.value) { return }
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await new S3Client(snapshot()).testConnection()
  } catch (err) {
    testResult.value = { success: false, message: `${i18n.testException}: ${getErrorMessage(err)}` }
  } finally {
    testing.value = false
  }
}

/** 从 s3Backup 配置键导入（只读，解密后回填表单，不自动保存） */
async function handleImport(): Promise<void> {
  try {
    const backupConfig = await props.storage.backupConfigReadonly.load()
    if (!backupConfig || !backupConfig.endpoint) {
      showMessage(props.i18n.importNoBackupConfig, 3000, "info")
      return
    }
    Object.assign(form, {
      ...backupConfig,
      accessKey: await decryptSetting(backupConfig.accessKey),
      secretKey: await decryptSetting(backupConfig.secretKey),
      uploadTimeoutSec: normalizeTimeout(backupConfig.uploadTimeoutSec),
    })
    showMessage(props.i18n.importSuccess, 2000, "info")
  } catch (err) {
    showMessage(`${props.i18n.importFailed}: ${getErrorMessage(err)}`, 4000, "error")
  }
}

/** 保存到自有配置键（凭证加密）并通知父组件应用 */
async function handleSave(): Promise<void> {
  if (saving.value) { return }
  saving.value = true
  try {
    const config = snapshot()
    const encrypted: S3Config = {
      ...config,
      accessKey: await encryptSetting(config.accessKey),
      secretKey: await encryptSetting(config.secretKey),
    }
    await props.storage.config.save(encrypted)
    showMessage(props.i18n.configSaved, 2000, "info")
    emit("saved", config)
    emit("close")
  } catch (err) {
    showMessage(`${props.i18n.saveFailed}: ${getErrorMessage(err)}`, 4000, "error")
  } finally {
    saving.value = false
  }
}

const i18n = props.i18n
</script>

<style scoped lang="scss">
@use "../styles/FmConfigDialog.scss";
@use "../styles/index.scss";
</style>
