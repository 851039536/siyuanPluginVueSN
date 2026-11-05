<!-- 数据管理 Dock 面板：总览 / 备份与还原 / 诊断 -->
<template>
  <div class="storage-manager">
    <!-- 头部：标题 / 总占用 / 刷新 -->
    <div class="sm-header">
      <div class="sm-header__title">
        <IconWrapper
          name="storageManager"
          :size="15"
        />
        <!-- 面板标题："数据管理" -->
        <span>{{ t.title }}</span>
      </div>
      <div class="sm-header__actions">
        <!-- 总占用："总占用" -->
        <span class="sm-header__usage">{{ t.totalUsage }} {{ formatBytes(inventory?.totals.bytes || 0) }}</span>
        <!-- 刷新按钮："刷新" -->
        <Button
          variant="ghost"
          size="xsmall"
          icon="refresh"
          :title="t.refresh"
          :loading="loading"
          @click="refresh(true)"
        />
      </div>
    </div>

    <!-- 数据目录：绝对路径，点击可打开 / 复制 -->
    <PathBar
      :label="t.dataDir"
      :path="inventory?.dataDir || ''"
      :empty-text="t.unavailable"
      :open-label="t.openFolder"
      :copy-label="t.copyPath"
      :open-failed-text="t.openFailed"
      :copied-text="t.copied"
      :copy-failed-text="t.copyFailed"
      @notify="(severity, text) => notify(severity, text)"
    />

    <!-- 操作结果提示（成功/失败） -->
    <Message
      v-if="notice"
      :severity="notice.severity"
      closable
      @close="clearNotice"
    >
      {{ notice.text }}
    </Message>
    <!-- 清单读取失败提示 -->
    <Message v-if="error" severity="error">
      {{ t.errors?.[error] || error }}
    </Message>

    <!-- 三个功能区 -->
    <Tabs v-model:value="activeTab" size="small">
      <TabList>
        <!-- Tab："总览" -->
        <Tab value="overview">{{ t.tabs?.overview }}</Tab>
        <!-- Tab："备份与还原" -->
        <Tab value="transfer">{{ t.tabs?.transfer }}</Tab>
        <!-- Tab："诊断" -->
        <Tab value="diagnostics">{{ t.tabs?.diagnostics }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="overview">
          <OverviewTab
            :inventory="inventory"
            :loading="loading"
            :t="t"
            @reset="handleReset"
          />
        </TabPanel>
        <TabPanel value="transfer">
          <BackupTab
            :manager="manager"
            :inventory="inventory"
            :t="t"
            @notify="notify"
            @done="refresh(true)"
          />
        </TabPanel>
        <TabPanel value="diagnostics">
          <DiagnosticsTab :inventory="inventory" :t="t" />
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- 清空槽位确认 -->
    <ConfirmDialog
      v-model:visible="resetVisible"
      :header="t.reset?.title"
      :message="resetMessage"
      :accept-label="t.actions?.resetConfirm"
      :reject-label="t.cancel"
      accept-severity="danger"
      :accept-loading="resetLoading"
      @confirm="confirmReset"
      @cancel="resetVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { StorageManager } from "./types"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Message from "@/components/Message.vue"
import Tab from "@/components/Tab.vue"
import TabList from "@/components/TabList.vue"
import TabPanel from "@/components/TabPanel.vue"
import TabPanels from "@/components/TabPanels.vue"
import Tabs from "@/components/Tabs.vue"
import { getSlot } from "@/config/storage"
import { useStorageManager } from "./composables/useStorageManager"
import { formatBytes } from "./utils"
import BackupTab from "./components/BackupTab.vue"
import DiagnosticsTab from "./components/DiagnosticsTab.vue"
import OverviewTab from "./components/OverviewTab.vue"
import PathBar from "./components/PathBar.vue"

interface Props {
  manager: StorageManager
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const t = computed<Record<string, any>>(() => props.i18n || {})
const {
  inventory,
  loading,
  error,
  notice,
  refresh,
  notify,
  clearNotice,
} = useStorageManager(props.manager)

const activeTab = ref("overview")
const resetVisible = ref(false)
const resetLoading = ref(false)
const pendingSlotId = ref("")

const resetMessage = computed(() => {
  const label = getSlot(pendingSlotId.value)?.defaultLabel || pendingSlotId.value
  return (t.value.reset?.message || "").replace("{0}", label)
})

function handleReset(slotId: string): void {
  pendingSlotId.value = slotId
  resetVisible.value = true
}

async function confirmReset(): Promise<void> {
  if (!pendingSlotId.value || resetLoading.value) return
  resetLoading.value = true
  try {
    const result = await props.manager.resetSlot(pendingSlotId.value)
    if (result.ok) {
      notify("success", t.value.actions?.resetDone || "")
    } else {
      notify("error", t.value.errors?.[result.error || ""] || result.error || "")
    }
    await refresh(true)
  } catch (err) {
    notify("error", err instanceof Error ? err.message : String(err))
  } finally {
    resetLoading.value = false
    resetVisible.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
