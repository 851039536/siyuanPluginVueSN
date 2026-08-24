<!-- 文档属性面板 - 属性查看 + 平台发布状态标记 + 前往发布 -->
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
            <!-- 行式卡片：左侧状态图标 + 平台名 -->
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
              <div class="platform-info">
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
              </div>
              <!-- 中间状态徽章："已发布/未发布" -->
              <span
                class="status-badge"
                :class="platform.published ? 'is-published' : 'is-unpublished'"
              >{{ platform.published ? '已发布' : '未发布' }}</span>
              <!-- 右侧操作按钮组：排版发布 / 前往发布 -->
              <div
                v-if="!platform.published && platform.url"
                class="platform-actions"
              >
                <button
                  class="publish-go-btn publish-format-btn"
                  title="排版发布：在编辑器内格式化后复制发布"
                  @click.stop="handlePublishFormat"
                >
                  <Icon icon="mdi:brush" />
                </button>
                <button
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
        </div>

        <div class="attrs-table">
          <!-- 表格表头："属性 / 值" -->
          <div class="attr-row attr-head">
            <div class="attr-key">属性</div>
            <div class="attr-value">值</div>
          </div>
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
          class="footer-btn doocs-btn"
          title="复制 Markdown 内容后跳转到 md.doocs.org"
          :disabled="doocsLoading"
          @click="goToDoocs"
        >
          <Icon
            :icon="doocsLoading ? 'mdi:loading' : 'mdi:open-in-new'"
            :class="{ 'spin-icon': doocsLoading }"
          />
          doocs.org
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
  watch,
} from "vue"
import {
  setBlockAttrs,
} from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import { PLATFORM_META } from "../../composables/platformMeta"
import {
  getPlatformIdFromAttrKey,
  getPublishedPlatformIdsFromAttrs,
} from "../../utils/platformPublish"
import { copyDocForPublish, openExternalPublish } from "../../utils/publishActions"
import type { DocI18n, PlatformMeta } from "../../types/index"

interface Props {
  visible: boolean
  docId: string
  attrs: Record<string, string> | null
  loading: boolean
  error: string
  /** docAnalysis 分片 i18n（提供发布操作提示文案） */
  i18n: DocI18n
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "refresh"): void
  (e: "publish", docId: string): void
}>()

const expandedYaml = ref(new Set<string>())

function toggleYaml(key: string) {
  const next = new Set(expandedYaml.value)
  if (next.has(key)) {
    next.delete(key)
  }
  else {
    next.add(key)
  }
  expandedYaml.value = next
}

/** 切换文档时重置 YAML 折叠状态，避免跨文档残留 */
watch(() => props.docId, () => {
  expandedYaml.value = new Set()
})

function countYamlLines(value: string): number {
  return value.split("\n").length
}

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

const CORE_ATTRS = new Set(Object.keys(ATTR_LABELS))

interface PlatformInfo extends Pick<PlatformMeta, "id" | "name" | "url"> {
  published: boolean
}

const docTitle = computed(() => props.attrs?.title || "")

const markingPlatform = ref<string | null>(null)
const mdCopyLoading = ref(false)
const publishGoLoading = ref<string | null>(null)
const doocsLoading = ref(false)

/** 排版发布：打开发布页 */
function handlePublishFormat() {
  emit("publish", props.docId)
}

/** 前往发布：先复制标题+Markdown 内容到剪贴板，再打开平台 URL（类似 SyncCaster） */
async function handlePublishGo(platform: PlatformInfo) {
  if (publishGoLoading.value) return
  publishGoLoading.value = platform.id
  const ok = await copyDocForPublish(props.docId, docTitle.value, props.i18n)
  if (ok) openExternalPublish(platform.url, platform.name, props.i18n)
  publishGoLoading.value = null
}

async function copyMdContent() {
  if (mdCopyLoading.value) return
  mdCopyLoading.value = true
  const ok = await copyDocForPublish(props.docId, docTitle.value, props.i18n)
  if (ok) showMessage(props.i18n.publishCopied, 2000, "info")
  mdCopyLoading.value = false
}

async function handlePlatformClick(platform: PlatformInfo) {
  await togglePublished(platform, !platform.published)
}

/** 标记/取消标记平台发布状态（共用「查找 config → confirm → 写入属性 → 刷新」流程） */
async function togglePublished(platform: PlatformInfo, publish: boolean) {
  if (!props.attrs || markingPlatform.value) return

  const config = PLATFORM_META.value.find((p) => p.id === platform.id)
  if (!config) return

  const docLabel = docTitle.value || props.docId
  const message = publish
    ? `确认将「${docLabel}」标记为已在 ${config.name} 发布？`
    : `确认取消「${docLabel}」在 ${config.name} 的发布状态？`
  // eslint-disable-next-line no-alert
  if (!confirm(message)) return

  markingPlatform.value = platform.id

  try {
    // 查找已有的匹配 YAML key
    const yamlKeys = Object.keys(props.attrs).filter((k) => k.endsWith("-yaml"))
    const matchKey = yamlKeys.find((k) => getPlatformIdFromAttrKey(k, PLATFORM_META.value) === platform.id)

    if (publish) {
      const attrKey = matchKey || `custom-${config.matchers[0]}-yaml`
      await setBlockAttrs(props.docId, { [attrKey]: buildYamlTemplate() })
    }
    else if (matchKey) {
      await setBlockAttrs(props.docId, { [matchKey]: null })
    }
    emit("refresh")
  }
  catch (e) {
    console.error("标记发布状态失败:", e)
    showMessage(props.i18n.publishMarkFailed, 3000, "error")
  }
  finally {
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
  const publishedIds = getPublishedPlatformIdsFromAttrs(props.attrs, PLATFORM_META.value)

  return PLATFORM_META.value.map((config) => ({
    id: config.id,
    name: config.name,
    published: publishedIds.has(config.id),
    url: config.url,
  }))
})

const COPYABLE_KEYS = new Set(["id", "title", "alias", "memo", "bookmark"])

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
    .map(([k, v]) => {
      // 多行值（如 YAML）以冒号换行 + 两空格缩进拼接，保持可读性
      if (v.includes("\n")) {
        const indented = v.split("\n").map((line) => `  ${line}`).join("\n")
        return `${k}:\n${indented}`
      }
      return `${k}: ${v}`
    })
    .join("\n")
  await copyToClipboard(text)
}

async function goToDoocs() {
  if (doocsLoading.value) return
  doocsLoading.value = true
  try {
    const ok = await copyDocForPublish(props.docId, docTitle.value, props.i18n)
    if (ok) openExternalPublish("https://md.doocs.org/", "md.doocs.org", props.i18n, 400)
  }
  finally {
    doocsLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "../../styles/AttrsPanel.scss";
</style>
