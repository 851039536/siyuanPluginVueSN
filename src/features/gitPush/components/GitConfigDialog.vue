<!-- gitPush Git 全局配置查询弹窗 -->
<template>
  <div
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-gc-dialog">
      <!-- 头部 -->
      <div class="gp-gc-header">
        <div class="gp-gc-title">
          <Icon
            icon="mdi:information-outline"
            height="14"
          />
          <!-- 弹窗标题：项目级显示项目名，否则"Git 全局配置" -->
          <span>{{ title || i18n.gitConfigTitle }}</span>
        </div>
        <!-- 关闭按钮（tooltip："关闭"） -->
        <button
          class="gp-gc-close"
          :title="i18n.close"
          @click="$emit('close')"
        >
          <Icon
            icon="mdi:close"
            height="16"
          />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="gp-gc-body">
        <div
          v-if="loading"
          class="gp-gc-loading"
        >
          <Icon
            icon="mdi:loading"
            height="16"
            class="gp-spin"
          />
          <!-- 加载提示文案："查询中..." -->
          <span>{{ i18n.gitConfigLoading }}</span>
        </div>

        <div
          v-else-if="error"
          class="gp-gc-error"
        >
          <Icon
            icon="mdi:alert-outline"
            height="20"
          />
          <span>{{ error }}</span>
        </div>

        <div
          v-else-if="configEntries.length === 0"
          class="gp-gc-empty"
        >
          <Icon
            icon="mdi:file-document-outline"
            height="32"
          />
          <!-- 空状态文案："暂未配置全局 Git 信息" -->
          <span>{{ i18n.gitConfigEmpty }}</span>
        </div>

        <div
          v-else
          class="gp-gc-config-block"
        >
          <div
            v-for="(entry, idx) in configEntries"
            :key="idx"
            class="gp-gc-config-item"
          >
            <span class="gp-gc-config-key">{{ entry.key }}</span>
            <span
              v-if="entry.desc"
              class="gp-gc-config-desc"
            >{{ entry.desc }}</span>
            <span class="gp-gc-config-value">{{ entry.value }}</span>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div
        v-if="configEntries.length > 0"
        class="gp-gc-footer"
      >
        <!-- 配置条数统计："N 项配置" -->
        <span class="gp-gc-config-count">{{ i18n.gitConfigCount.replace("{0}", String(configEntries.length)) }}</span>
        <div class="gp-grow" />
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="handleCopy"
        >
          <Icon
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            height="12"
          />
          <!-- 按钮文案："复制全部"，点击后短暂变为"已复制" -->
          <span>{{ copied ? i18n.copied : i18n.gitConfigCopyAll }}</span>
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="handleOpenFile"
        >
          <Icon
            icon="mdi:file-document-edit-outline"
            height="12"
          />
          <!-- 按钮文案："打开配置文件"（用系统编辑器打开 .gitconfig） -->
          <span>{{ i18n.gitConfigOpenFile }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { Icon } from "@iconify/vue"
import { copyToClipboard } from "@/utils/domUtils"
import { openLocalPath } from "../utils"
import { getConfigDesc } from "../types/gitConfigDesc"

interface ConfigEntry {
  key: string
  value: string
  desc: string
}

interface Props {
  configText: string
  loading: boolean
  error: string
  i18n: Record<string, any>
  filePath: string
  title?: string
}

const props = defineProps<Props>()

defineEmits<{
  close: []
}>()

const copied = ref(false)

/** 解析 git config --list 输出为 key-value 数组（含中文说明） */
const configEntries = computed<ConfigEntry[]>(() => {
  if (!props.configText) return []
  return props.configText
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const eqIdx = line.indexOf("=")
      const key = line.substring(0, eqIdx)
      return {
        key,
        value: line.substring(eqIdx + 1),
        desc: getConfigDesc(key),
      }
    })
})

async function handleCopy() {
  if (!props.configText) return
  const ok = await copyToClipboard(props.configText)
  if (ok) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

/** 打开系统默认编辑器编辑 Git 配置文件（复用 utils 的 openLocalPath 统一入口） */
async function handleOpenFile() {
  if (!props.filePath) return
  await openLocalPath(props.filePath)
}
</script>

<style lang="scss" scoped>
@use "../styles/GitConfigDialog";
</style>
