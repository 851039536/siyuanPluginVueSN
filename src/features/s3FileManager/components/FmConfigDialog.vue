<!-- S3 配置弹窗 — 自包含：onMounted 自加载、保存自持久化（加密凭证）、支持测试连接与从 S3 备份导入（外壳复用共享 Dialog） -->
<template>
  <Dialog
    :visible="true"
    size="medium"
    :header="i18n.configTitle"
    @update:visible="$emit('close')"
  >
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

    <template #footer>
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
        <!-- 按钮："测试连接"（Button 内部已把 loading 并入 disabled） -->
        <Button
          variant="ghost"
          size="small"
          :loading="testing"
          @click="handleTest"
        >
          {{ i18n.testConnection }}
        </Button>
        <!-- 按钮："保存" -->
        <Button
          variant="primary"
          size="small"
          :loading="saving"
          @click="handleSave"
        >
          {{ i18n.save }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue"
import { showMessage } from "siyuan"
import type { S3Config } from "@/utils/s3/types"
import { DEFAULT_S3_CONFIG } from "@/utils/s3/types"
import { S3Client } from "@/utils/s3/s3Client"
import { encryptSettingStrict, decryptSetting } from "@/utils/settingsCrypto"
import { getErrorMessage } from "@/utils/stringUtils"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Input from "@/components/Input.vue"
import Switch from "@/components/Switch.vue"
import type { S3FileManagerI18n } from "../types"
import type { S3FileManagerStorage } from "../types/storage"

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

// 全文件统一用解构后的 i18n，不再与 props.i18n 混写
const { i18n } = props

/** 归一化超时字段（空值/非法值回退默认） */
function normalizeTimeout(value: unknown): number {
  const timeout = Number(value)
  return Number.isFinite(timeout) && timeout > 0 ? Math.round(timeout) : DEFAULT_S3_CONFIG.uploadTimeoutSec
}

/** 归一化并快照当前表单为 S3Config */
function snapshot(): S3Config {
  return { ...form, uploadTimeoutSec: normalizeTimeout(form.uploadTimeoutSec) }
}

/** 挂载时自加载已保存配置（解密凭证）；失败时明确告知，不让表单静默停在默认值 */
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
    const msg = getErrorMessage(err)
    console.error("[S3文件管理] 配置加载失败:", msg)
    showMessage(`${i18n.configLoadFailed}: ${msg}`, 4000, "error")
  }
})

/** 测试连接：S3Client.testConnection 内部已收敛所有异常为结果对象，故无需 try/catch */
async function handleTest(): Promise<void> {
  if (testing.value) { return }
  testing.value = true
  testResult.value = null
  testResult.value = await new S3Client(snapshot()).testConnection()
  testing.value = false
}

/** 从 s3Backup 配置键导入（只读，解密后回填表单，不自动保存） */
async function handleImport(): Promise<void> {
  // 存储读取与解密均在各自实现内收敛失败（返回 null / 原值），此处无异常路径
  const backupConfig = await props.storage.backupConfigReadonly.load()
  if (!backupConfig || !backupConfig.endpoint) {
    showMessage(i18n.importNoBackupConfig, 3000, "info")
    return
  }
  Object.assign(form, {
    ...backupConfig,
    accessKey: await decryptSetting(backupConfig.accessKey),
    secretKey: await decryptSetting(backupConfig.secretKey),
    uploadTimeoutSec: normalizeTimeout(backupConfig.uploadTimeoutSec),
  })
  showMessage(i18n.importSuccess, 2000, "info")
}

/** 保存到自有配置键（凭证加密）并通知父组件应用 */
async function handleSave(): Promise<void> {
  if (saving.value) { return }
  saving.value = true
  try {
    const config = snapshot()
    // 凭证类数据用严格版加密：加密失败直接走 catch 提示保存失败，
    // 绝不静默回退明文落盘（encryptSetting 的明文回退只适合普通设置项）
    const encrypted: S3Config = {
      ...config,
      accessKey: await encryptSettingStrict(config.accessKey),
      secretKey: await encryptSettingStrict(config.secretKey),
    }
    // PluginStorage.save 失败时返回 false 而不抛，必须显式转成异常，
    // 否则落盘失败仍会提示"配置已保存"并把未保存的配置应用到运行时
    if (!await props.storage.config.save(encrypted)) {
      throw new Error(i18n.saveFailed)
    }
    showMessage(i18n.configSaved, 2000, "info")
    // 仅发 saved：父组件 handleConfigSaved 会关闭弹窗，重复 emit("close") 会形成两条关闭路径
    emit("saved", config)
  } catch (err) {
    showMessage(`${i18n.saveFailed}: ${getErrorMessage(err)}`, 4000, "error")
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use "../styles/FmConfigDialog.scss";
</style>
