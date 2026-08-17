<!--
  RSS 设置面板 — 刷新间隔/单源最大文章数/排序 + OPML 导入导出
-->
<template>
  <div class="rss-settings-panel">
    <div class="settings-header">
      <!-- 设置面板标题 -->
      <span class="settings-title">{{ i18n.settings }}</span>
      <button
        class="close-btn"
        @click="emit('close')"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>
    <div class="settings-body">
      <!-- 自动刷新间隔 -->
      <div class="setting-item">
        <div class="setting-label">
          <!-- 设置项："自动刷新间隔" -->
          {{ i18n.refreshInterval }}
        </div>
        <div class="setting-desc">
          <!-- 设置描述："0表示不自动刷新" -->
          {{ i18n.refreshIntervalDesc }}
        </div>
        <select
          :value="settings.refreshInterval"
          @change="handleSettingChange('refreshInterval', Number(($event.target as HTMLSelectElement).value))"
        >
          <option :value="0">
            <!-- 选项："禁用" -->
            {{ i18n.disabled }}
          </option>
          <option :value="15">
            <!-- 15 分钟 -->
            15 {{ i18n.minutes }}
          </option>
          <option :value="30">
            <!-- 30 分钟 -->
            30 {{ i18n.minutes }}
          </option>
          <option :value="60">
            <!-- 1 小时 -->
            1 {{ i18n.hour }}
          </option>
          <option :value="120">
            <!-- 2 小时 -->
            2 {{ i18n.hours }}
          </option>
          <option :value="360">
            <!-- 6 小时 -->
            6 {{ i18n.hours }}
          </option>
        </select>
      </div>

      <!-- 每源最大文章数 -->
      <div class="setting-item">
        <div class="setting-label">
          <!-- 设置项："每源最大文章数" -->
          {{ i18n.maxItems }}
        </div>
        <div class="setting-desc">
          <!-- 设置描述 -->
          {{ i18n.maxItemsDesc }}
        </div>
        <input
          type="number"
          :value="settings.maxItemsPerFeed"
          min="10"
          max="500"
          @change="handleSettingChange('maxItemsPerFeed', Number(($event.target as HTMLInputElement).value))"
        >
      </div>

      <!-- 排序方式 -->
      <div class="setting-item">
        <div class="setting-label">
          <!-- 设置项："排序方式" -->
          {{ i18n.sortOrder }}
        </div>
        <select
          :value="settings.sortOrder"
          @change="handleSettingChange('sortOrder', ($event.target as HTMLSelectElement).value)"
        >
          <option value="newest">
            <!-- 选项："最新优先" -->
            {{ i18n.newestFirst }}
          </option>
          <option value="oldest">
            <!-- 选项："最早优先" -->
            {{ i18n.oldestFirst }}
          </option>
        </select>
      </div>

      <!-- OPML 导出 -->
      <div class="opml-section">
        <div class="setting-label">
          <!-- 设置项："OPML 导出" -->
          {{ i18n.opmlExport }}
        </div>
        <div class="setting-desc">
          <!-- 设置描述 -->
          {{ i18n.opmlExportDesc }}
        </div>
        <button
          class="opml-btn"
          @click="emit('exportOpml')"
        >
          <Icon icon="mdi:export-variant" />
          <!-- 导出按钮："导出订阅源列表" -->
          {{ i18n.exportFeedList }}
        </button>
      </div>

      <!-- OPML 导入 -->
      <div class="opml-section">
        <div class="setting-label">
          <!-- 设置项："OPML 导入" -->
          {{ i18n.opmlImport }}
        </div>
        <div class="setting-desc">
          <!-- 设置描述 -->
          {{ i18n.opmlImportDesc }}
        </div>
        <div class="opml-import-row">
          <input
            ref="fileInput"
            type="file"
            accept=".opml,.xml"
            :disabled="importing"
            @change="handleFile"
          >
          <span
            v-if="importing"
            class="opml-importing"
          >
            <Icon
              icon="mdi:loading"
              class="loading-icon"
            />
            <!-- 导入中状态文案 -->
            {{ i18n.importing }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import { ref } from "vue"
import { getErrorMessage } from "@/utils/stringUtils"
import type { RssSettings } from "../../types"

interface Props {
  i18n: Record<string, string>
  settings: RssSettings
  /** 导入 OPML（父级提供，子组件自行调用并管理 importing 状态） */
  importOpml: (xml: string) => Promise<void>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  settingChange: [key: string, value: unknown]
  exportOpml: []
}>()

const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleSettingChange(key: string, value: unknown) {
  emit("settingChange", key, value)
}

async function handleFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    await props.importOpml(text)
  } catch (err: unknown) {
    showMessage(`${props.i18n.opmlImportFailed}: ${getErrorMessage(err)}`, 5000, "error")
  } finally {
    importing.value = false
    if (fileInput.value) fileInput.value.value = ""
  }
}
</script>

<style lang="scss">
@use "../../styles/SettingsPanel.scss";
@use "../../styles/index.scss";
</style>
