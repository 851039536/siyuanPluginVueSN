<!-- S3 备份主面板 — Tab 壳与初始化编排：各 Tab 视图独立，编排状态来自 useBackupOrchestrator -->
<template>
  <div class="s3-backup-panel">
    <!-- 头部 -->
    <div class="s3-backup-header">
      <!-- 标题："S3 备份" -->
      <span class="s3-backup-header-title">{{ i18n.s3Backup }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="close"
        @click="handleClose"
      />
    </div>

    <!-- Tab 栏：元数据驱动渲染；lazy 保持「进入即挂载、离开即卸载」的既有语义 -->
    <Tabs
      v-model:value="activeTab"
      class="s3-tabs"
      lazy
      size="small"
    >
      <TabList :aria-label="i18n.s3Backup">
        <Tab
          v-for="tab in TABS"
          :key="tab.value"
          :value="tab.value"
        >
          {{ i18n[tab.labelKey] }}
          <!-- 实验性徽标："实验"（仅增量 Tab） -->
          <Tag v-if="tab.experimental" variant="warning" size="xsmall">
            {{ i18n.experimentalBadge }}
          </Tag>
        </Tab>
      </TabList>

      <TabPanels>
        <!-- Tab: 备份 -->
        <TabPanel value="backup">
          <BackupTab :orch="orch" :i18n="i18n" />
        </TabPanel>

        <!-- Tab: 配置 -->
        <TabPanel value="config">
          <ConfigTab :orch="orch" :i18n="i18n" />
        </TabPanel>

        <!-- Tab: 日志 -->
        <TabPanel value="log">
          <LogTab :orch="orch" :i18n="i18n" />
        </TabPanel>

        <!-- Tab: 校验 -->
        <TabPanel value="checksums">
          <ChecksumsTab :orch="orch" :i18n="i18n" />
        </TabPanel>

        <!-- Tab: 增量（实验性） -->
        <TabPanel value="incremental">
          <IncrementalTab :orch="orch" :i18n="i18n" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { useBackupOrchestrator } from "./composables/useBackupOrchestrator"
import type { BackupOrchestrator } from "./composables/useBackupOrchestrator"
import { AUTO_BACKUP_TRIGGER_EVENT } from "./types"
import BackupTab from "./components/BackupTab.vue"
import ConfigTab from "./components/ConfigTab.vue"
import LogTab from "./components/LogTab.vue"
import ChecksumsTab from "./components/ChecksumsTab.vue"
import IncrementalTab from "./components/IncrementalTab.vue"
import Button from "@/components/Button.vue"
import Tabs from "@/components/Tabs.vue"
import TabList from "@/components/TabList.vue"
import Tab from "@/components/Tab.vue"
import TabPanels from "@/components/TabPanels.vue"
import TabPanel from "@/components/TabPanel.vue"
import Tag from "@/components/Tag.vue"

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

/** Tab 渲染元数据：值 → i18n 标签键（experimental 决定是否附实验性徽标） */
type TabValue = "backup" | "config" | "log" | "checksums" | "incremental"

interface TabMeta {
  value: TabValue
  labelKey: string
  experimental?: boolean
}

const TABS: TabMeta[] = [
  { value: "backup", labelKey: "backupTab" },
  { value: "config", labelKey: "configTab" },
  { value: "log", labelKey: "logTab" },
  { value: "checksums", labelKey: "checksumsTab" },
  { value: "incremental", labelKey: "incrementalTab", experimental: true },
]

/** 当前激活 Tab（Tabs 的 value 载荷为 string | number，保持宽类型以匹配 v-model） */
const activeTab = ref<string>("backup")

// ========== 备份编排（聚合状态 + 四入口互斥 + 自动备份） ==========

const orch: BackupOrchestrator = useBackupOrchestrator({ i18n: props.i18n })

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
  // 配置/设置/记录水合与列表初始化统一由编排层完成
  await orch.init()

  // 注册自动备份事件监听（定时器在插件实例侧派发）
  window.addEventListener(AUTO_BACKUP_TRIGGER_EVENT, orch.handleAutoBackupTrigger)
})

onUnmounted(() => {
  window.removeEventListener(AUTO_BACKUP_TRIGGER_EVENT, orch.handleAutoBackupTrigger)
  // 卸载时清除状态栏任务，避免残留条目
  orch.statusTask.clear()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
@use "./styles/TabsShell.scss";
</style>
