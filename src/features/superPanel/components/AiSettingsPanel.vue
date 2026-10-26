<!-- AI 设置面板外壳：Tab 分页（模型 / 配置档案），联网搜索并入模型页展示；各分区拆分至独立子组件 -->
<template>
  <div class="ai-settings-panel">
    <div class="ai-settings-header">
      <!-- 面板标题："AI大模型配置" -->
      <span>{{ i18n.aiSettings }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="close"
        :icon-size="14"
        @click="handleClose"
      />
    </div>

    <!-- ====== Tab 分页 ====== -->
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="model">
          <IconWrapper
            name="settings"
            :size="13"
          />{{ i18n.tabModel }}
        </Tab>
        <Tab value="profile">
          <IconWrapper
            name="folder"
            :size="13"
          />{{ i18n.tabProfile }}
        </Tab>
      </TabList>
      <TabPanels>
        <!-- 「模型」：供应商 / 模型 / 思考模式 / 密钥 / 端点 / 联网搜索 -->
        <TabPanel value="model">
          <AiModelSettings
            :settings="settings"
            :i18n="i18n"
            @update="handleSettingUpdate"
            @provider-change="handleProviderChange"
          />

          <!-- 联网搜索：与请求链路相关，并入模型页（分隔线由组件自身样式承载） -->
          <AiSearchSettings
            :deepseek-api-key="settings.apiKeys['deepseek'] || ''"
            :i18n="i18n"
          />
        </TabPanel>

        <!-- 「配置档案」：整套 AI 配置的命名快照 -->
        <TabPanel value="profile">
          <AiProfileSettings
            :profiles="profileList"
            :i18n="i18n"
            @save="handleProfileSave"
            @apply="handleProfileApply"
            @delete="handleProfileDelete"
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import type { AiSettings } from "../types"
import type {
  AiProfileConfig,
  AiProvider,
} from "@/types/ai"
import { showMessage } from "siyuan"
import {
  onUnmounted,
  reactive,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Tab from "@/components/Tab.vue"
import TabList from "@/components/TabList.vue"
import TabPanel from "@/components/TabPanel.vue"
import TabPanels from "@/components/TabPanels.vue"
import Tabs from "@/components/Tabs.vue"
import { TimerRegistry } from "@/utils/timerRegistry"
import AiModelSettings from "./AiModelSettings.vue"
import AiProfileSettings from "./AiProfileSettings.vue"
import AiSearchSettings from "./AiSearchSettings.vue"
import { getDefaultModel } from "./providers"

interface Props {
  settings: AiSettings
  profiles: AiProfileConfig[]
  i18n: {
    aiSettings?: string
    apiProvider?: string
    aiModel?: string
    apiKey?: string
    customEndpoint?: string
    tongyiQianwen?: string
    deepSeek?: string
    xiaomiMiMo?: string
    customApi?: string
    [key: string]: any
  }
}

interface Emits {
  (e: "close"): void
  (e: "update:settings", settings: AiSettings): void
  (e: "update:profiles", profiles: AiProfileConfig[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 当前激活的 Tab
const activeTab = ref("model")

// 本地响应式副本。apiKeys 必须深拷贝切断与 plugin.settings.aiApiKeys 的引用别名：
// 管理器每次保存都会重建 aiApiKeys map 并整体替换 plugin.settings，
// 若共享引用，首次保存后本副本即永久过期，切换供应商会读到旧值，
// 极端路径下回切再保存会删除已存密钥（docs/super-panel-code-review.md P1-1）
const settings = reactive<AiSettings>({
  ...props.settings,
  apiKeys: { ...(props.settings.apiKeys || {}) },
})

// 已保存档案列表（本地唯一事实源，变更后整体上抛持久化）
const profileList = ref<AiProfileConfig[]>(
  props.profiles ? [...props.profiles] : [],
)

// ---- 持久化上抛（防抖）----
// 逐键 emit 会触发全量 AES-GCM 加密 + 落盘 + settingsUpdated 广播（docs/super-panel-code-review.md P2-1），
// 对连续输入做 400ms 防抖；离散操作（切换供应商 / 应用档案 / 关闭）立即 flush，保持「即改即存」语义。
const SAVE_DEBOUNCE_MS = 400
const timers = new TimerRegistry()
let saveHandle: number | null = null

const flushSettingsSave = () => {
  timers.clear(saveHandle)
  saveHandle = null
  emit("update:settings", { ...settings })
}

const debouncedSettingsSave = () => {
  timers.clear(saveHandle)
  saveHandle = timers.setTimeout(flushSettingsSave, SAVE_DEBOUNCE_MS)
}

onUnmounted(() => {
  // 卸载时若有未落盘的修改，同步 flush，避免静默丢配置
  if (saveHandle !== null) {
    flushSettingsSave()
  }
  timers.clearAll()
})

const handleClose = () => {
  flushSettingsSave()
  emit("close")
}

/** 子组件粒度更新：写回本地副本后防抖上抛持久化 */
const handleSettingUpdate = (field: keyof AiSettings, value: string | boolean) => {
  (settings as any)[field] = value
  if (field === "apiKey") {
    // 密钥镜像进本地 map：切换供应商时能读回刚输入的值，不依赖可能过期的外部快照
    settings.apiKeys[settings.provider] = value as string
  }
  debouncedSettingsSave()
}

const handleProviderChange = (provider: string) => {
  settings.provider = provider
  settings.model = getDefaultModel(provider)
  settings.apiKey = settings.apiKeys[provider] || ""
  flushSettingsSave()
  showMessage(props.i18n.providerUpdatedMsg || "供应商已更新", 2000, "info")
}

/**
 * 保存当前整套 AI 配置为命名档案（同名覆盖），变更后整体上抛持久化
 */
const handleProfileSave = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) {
    return
  }
  const snapshot: AiProfileConfig = {
    name: trimmed,
    provider: settings.provider as AiProvider,
    model: settings.model,
    customModel: settings.customModel,
    apiKey: settings.apiKey,
    customEndpoint: settings.customEndpoint,
    enableThinking: settings.enableThinking,
  }
  const next = [...profileList.value]
  const existingIndex = next.findIndex((p) => p.name === trimmed)
  if (existingIndex >= 0) {
    next[existingIndex] = snapshot
  } else {
    next.push(snapshot)
  }
  profileList.value = next
  emit("update:profiles", next)
}

/**
 * 应用所选档案：整组字段回填本地 settings 后单次上抛，直接覆盖生效（沿用自动保存机制）
 */
const handleProfileApply = (name: string) => {
  const profile = profileList.value.find((p) => p.name === name)
  if (!profile) {
    return
  }
  settings.provider = profile.provider
  settings.model = profile.model
  settings.customModel = profile.customModel
  settings.apiKey = profile.apiKey
  settings.customEndpoint = profile.customEndpoint
  settings.enableThinking = profile.enableThinking
  if (profile.apiKey) {
    settings.apiKeys[profile.provider] = profile.apiKey
  } else {
    delete settings.apiKeys[profile.provider]
  }
  // 应用档案属离散操作，立即上抛（不等防抖）
  flushSettingsSave()
}

/**
 * 删除所选档案，变更后整体上抛持久化
 */
const handleProfileDelete = (name: string) => {
  profileList.value = profileList.value.filter((p) => p.name !== name)
  emit("update:profiles", profileList.value)
}
</script>

<style lang="scss" scoped>
@use "../styles/AiSettingsPanel.scss";
</style>
