<template>
  <div
    v-if="visible"
    class="attrs-panel-overlay"
    @click.self="$emit('close')"
  >
    <div class="attrs-panel">
      <div class="attrs-panel-header">
        <div class="header-title">
          <Icon
            icon="mdi:information-outline"
            class="header-icon"
          />
          <span>文档属性</span>
          <span
            v-if="attrs"
            class="header-doc-title"
          >{{ attrs.title || docId }}</span>
        </div>
        <button
          class="close-btn"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>

      <div
        v-if="loading"
        class="attrs-loading"
      >
        <Icon
          icon="mdi:loading"
          class="loading-icon"
        />
        <span>加载属性中...</span>
      </div>

      <div
        v-else-if="error"
        class="attrs-error"
      >
        <Icon
          icon="mdi:alert-circle"
          class="error-icon"
        />
        <span>{{ error }}</span>
      </div>

      <div
        v-else-if="attrs"
        class="attrs-content"
      >
        <div class="publish-status-section">
          <div class="section-title">
            <Icon icon="mdi:cloud-check-outline" />
            平台发布状态
          </div>
          <div class="platform-status-list">
            <div
              v-for="platform in platforms"
              :key="platform.id"
              class="platform-status-item clickable"
              :class="{
                published: platform.published,
                marking: markingPlatform === platform.id,
              }"
              :title="platform.published ? `点击取消 ${platform.name} 发布状态` : `点击标记 ${platform.name} 已发布`"
              @click="handlePlatformClick(platform)"
            >
              <Icon
                v-if="markingPlatform === platform.id"
                icon="mdi:loading"
                class="status-icon spin-icon"
              />
              <Icon
                v-else
                :icon="platform.published ? 'mdi:check-circle' : 'mdi:minus-circle-outline'"
                class="status-icon"
              />
              <span class="platform-name">{{ platform.name }}</span>
              <span class="status-text">{{ platform.published ? '已发布' : '未发布' }}</span>
              <button
                v-if="!platform.published && platform.url"
                class="publish-go-btn"
                title="复制标题和内容后前往发布"
                :disabled="publishGoLoading === platform.id"
                @click.stop="handlePublishGo(platform)"
              >
                <Icon
                  v-if="publishGoLoading === platform.id"
                  icon="mdi:loading"
                  class="spin-icon"
                />
                <Icon
                  v-else
                  icon="mdi:open-in-new"
                />
              </button>
            </div>
          </div>
        </div>

        <div class="attrs-table">
          <div
            v-for="item in displayItems"
            :key="item.key"
            class="attr-row"
          >
            <div class="attr-key">
              {{ item.label }}
            </div>
            <div class="attr-value">
              <template v-if="item.isYaml">
                <div
                  class="yaml-toggle"
                  @click="toggleYaml(item.key)"
                >
                  <Icon
                    :icon="expandedYaml.has(item.key) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
                    class="toggle-icon"
                  />
                  <span class="yaml-label">YAML 内容</span>
                  <span class="yaml-size">({{ countYamlLines(item.value) }} 行)</span>
                </div>
                <pre
                  v-if="expandedYaml.has(item.key)"
                  class="yaml-content"
                >{{ item.value }}</pre>
              </template>
              <template v-else>
                <span
                  v-if="item.value"
                  class="attr-text"
                >{{ item.value }}</span>
                <span
                  v-else
                  class="attr-empty"
                >—</span>
                <button
                  v-if="item.value && COPYABLE_KEYS.has(item.key)"
                  class="attr-copy-btn"
                  title="复制值"
                  @click="copyToClipboard(item.value)"
                >
                  <Icon icon="mdi:content-copy" />
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="attrs-panel-footer">
        <button
          class="footer-btn md-copy-btn"
          :disabled="mdCopyLoading"
          @click="copyMdContent"
        >
          <Icon
            :icon="mdCopyLoading ? 'mdi:loading' : 'mdi:language-markdown'"
            :class="{ 'spin-icon': mdCopyLoading }"
          />
          {{ mdCopyLoading ? '获取中...' : '复制 MD' }}
        </button>
        <div class="footer-spacer" />
        <button
          class="footer-btn"
          @click="copyAllAttrs"
        >
          <Icon icon="mdi:content-copy" />
          复制全部
        </button>
        <button
          class="footer-btn"
          @click="$emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import {
  exportMdContent,
  setBlockAttrs,
} from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import { PLATFORM_META } from "../composables/useDocAnalysis"
import {
  getPlatformIdFromAttrKey,
  getPublishedPlatformIdsFromAttrs,
} from "../utils/platformPublish"

interface Props {
  visible: boolean
  docId: string
  attrs: Record<string, string> | null
  loading: boolean
  error: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "refresh"): void
}>()

const expandedYaml = ref(new Set<string>())

function toggleYaml(key: string) {
  if (expandedYaml.value.has(key)) {
    expandedYaml.value.delete(key)
  }
  else {
    expandedYaml.value.add(key)
  }
  // 触发响应式
  expandedYaml.value = new Set(expandedYaml.value)
}

function countYamlLines(value: string): number {
  return value.split("\n").length
}

const CORE_ATTRS = new Set([
  "id",
  "type",
  "title",
  "alias",
  "memo",
  "bookmark",
  "tags",
  "icon",
  "updated",
  "created",
])

interface PlatformInfo {
  id: string
  name: string
  published: boolean
  url: string
}

const markingPlatform = ref<string | null>(null)
const mdCopyLoading = ref(false)
const publishGoLoading = ref<string | null>(null)

/** 前往发布：先复制标题+Markdown 内容到剪贴板，再打开平台 URL（类似 SyncCaster） */
async function handlePublishGo(platform: PlatformInfo) {
  if (publishGoLoading.value) return
  publishGoLoading.value = platform.id
  try {
    // 1. 获取文档 Markdown 内容
    const result = await exportMdContent(props.docId)
    const title = props.attrs?.title || ""
    const mdContent = result?.content || ""

    // 2. 组合"标题 + 空行 + 正文"到剪贴板（模仿 SyncCaster 行为）
    const combined = `# ${title}\n\n${mdContent}`
    await copyToClipboard(combined)

    // 3. 提示用户
    showMessage(`标题和内容已复制，即将跳转到 ${platform.name}`, 3000, "info")

    // 4. 稍微延迟后打开平台 URL
    setTimeout(() => {
      window.open(platform.url, "_blank")
    }, 300)
  } catch (e) {
    console.error("前往发布失败:", e)
    showMessage("获取文档内容失败，请重试", 3000, "error")
  } finally {
    publishGoLoading.value = null
  }
}

async function copyMdContent() {
  if (mdCopyLoading.value) return
  mdCopyLoading.value = true
  try {
    const result = await exportMdContent(props.docId)
    if (result?.content) {
      await copyToClipboard(result.content)
    }
  }
  finally {
    mdCopyLoading.value = false
  }
}

async function handlePlatformClick(platform: PlatformInfo) {
  if (platform.published) {
    await unmarkAsPublished(platform.id)
  } else {
    await markAsPublished(platform.id)
  }
}

async function markAsPublished(platformId: string) {
  if (!props.attrs || markingPlatform.value) return

  const config = PLATFORM_META.find((p) => p.id === platformId)
  if (!config) return

  // eslint-disable-next-line no-alert
  if (!confirm(`确认将「${props.attrs.title || props.docId}」标记为已在 ${config.name} 发布？`)) return

  markingPlatform.value = platformId

  try {
    // 查找已有的匹配 YAML key
    const yamlKeys = Object.keys(props.attrs).filter((k) => k.endsWith("-yaml"))
    const matchKey = yamlKeys.find((k) => getPlatformIdFromAttrKey(k) === platformId)

    const attrKey = matchKey || `custom-${config.matchers[0]}-yaml`
    const yamlValue = buildYamlTemplate()

    await setBlockAttrs(props.docId, { [attrKey]: yamlValue })
    emit("refresh")
  }
  catch (e) {
    console.error("标记已发布失败:", e)
  }
  finally {
    markingPlatform.value = null
  }
}

async function unmarkAsPublished(platformId: string) {
  if (!props.attrs || markingPlatform.value) return

  const config = PLATFORM_META.find((p) => p.id === platformId)
  if (!config) return

  // eslint-disable-next-line no-alert
  if (!confirm(`确认取消「${props.attrs.title || props.docId}」在 ${config.name} 的发布状态？`)) return

  markingPlatform.value = platformId

  try {
    const yamlKeys = Object.keys(props.attrs).filter((k) => k.endsWith("-yaml"))
    const matchKey = yamlKeys.find((k) => getPlatformIdFromAttrKey(k) === platformId)
    if (matchKey) {
      await setBlockAttrs(props.docId, { [matchKey]: null as unknown as string })
      emit("refresh")
    }
  } catch (e) {
    console.error("取消发布状态失败:", e)
  } finally {
    markingPlatform.value = null
  }
}

function buildYamlTemplate(): string {
  if (!props.attrs) return ""

  const lines: string[] = [
    "---",
    `created: '${props.attrs.created || ""}'`,
    `updated: '${props.attrs.updated || ""}'`,
    `title: ${props.attrs.title || ""}`,
    `permalink: siyuan://blocks/${props.docId}`,
    `desc: ${props.attrs.alias || props.attrs.memo || props.attrs.title || ""}`,
  ]

  if (props.attrs.tags) {
    const tagList = props.attrs.tags.split(",").filter(Boolean)
    if (tagList.length > 0) {
      lines.push("tags:")
      tagList.forEach((t) => { lines.push(`  - ${t.trim()}`) })
    }
  }

  if (props.attrs.bookmark && props.attrs.bookmark !== "无") {
    lines.push("categories:")
    lines.push(`  - ${props.attrs.bookmark}`)
  }
  else {
    lines.push("categories: []")
  }

  lines.push("---")
  return lines.join("\n")
}

const platforms = computed<PlatformInfo[]>(() => {
  const publishedIds = getPublishedPlatformIdsFromAttrs(props.attrs)

  return PLATFORM_META.map((config) => ({
    id: config.id,
    name: config.name,
    published: publishedIds.has(config.id),
    url: config.url,
  }))
})

const COPYABLE_KEYS = new Set(["id", "title", "alias", "memo", "bookmark"])

const ATTR_LABELS: Record<string, string> = {
  id: "ID",
  type: "类型",
  title: "标题",
  alias: "别名",
  memo: "备注",
  bookmark: "书签",
  tags: "标签",
  icon: "图标",
  updated: "更新时间",
  created: "创建时间",
}

interface DisplayItem {
  key: string
  label: string
  value: string
  isYaml: boolean
}

const displayItems = computed<DisplayItem[]>(() => {
  if (!props.attrs) return []

  const items: DisplayItem[] = []

  const sortedKeys = Object.keys(props.attrs).sort((a, b) => {
    const aCore = CORE_ATTRS.has(a) ? 0 : 1
    const bCore = CORE_ATTRS.has(b) ? 0 : 1
    return aCore - bCore
  })

  for (const key of sortedKeys) {
    const value = props.attrs[key]
    const isYaml = key.startsWith("custom-") && key.endsWith("-yaml")

    let label = key
    if (isYaml) {
      // 提取平台名：custom-csdn-yaml -> CSDN
      const platformName = key
        .replace(/^custom-/, "")
        .replace(/-yaml$/, "")
      label = `${platformName} 配置`
    }
    else if (ATTR_LABELS[key]) {
      label = ATTR_LABELS[key]
    }

    items.push({
      key,
      label,
      value,
      isYaml,
    })
  }

  return items
})

async function copyAllAttrs() {
  if (!props.attrs) return
  const text = Object.entries(props.attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
  await copyToClipboard(text)
}
</script>

<style lang="scss" scoped>
@use "../styles/AttrsPanel.scss";
</style>
