<template>
  <div
    v-if="visible"
    class="publish-panel-overlay"
    @click.self="handleClose"
  >
    <div class="publish-panel">
      <!-- 头部 -->
      <div class="publish-panel-header">
        <div class="header-title">
          <Icon
            icon="mdi:publish"
            class="header-icon"
          />
          <span>发布文档</span>
        </div>
        <button
          class="close-btn"
          @click="handleClose"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>

      <!-- 文档信息 -->
      <div class="publish-doc-info">
        <Icon
          icon="mdi:file-document-outline"
          class="doc-icon"
        />
        <span class="doc-title">{{ docTitle }}</span>
      </div>

      <!-- Tab 切换 -->
      <div class="publish-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'publish' }"
          @click="activeTab = 'publish'"
        >
          <Icon icon="mdi:send" />
          发布
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'platforms' }"
          @click="activeTab = 'platforms'"
        >
          <Icon icon="mdi:cog-outline" />
          平台管理
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'history' }"
          @click="activeTab = 'history'"
        >
          <Icon icon="mdi:history" />
          发布记录
        </button>
      </div>

      <!-- 发布 Tab -->
      <div
        v-if="activeTab === 'publish'"
        class="publish-tab-content"
      >
        <!-- 平台选择 -->
        <div class="section">
          <div class="section-title">
            <Icon icon="mdi:target" />
            选择发布平台
          </div>
          <div
            v-if="enabledPlatforms.length === 0"
            class="no-platforms-hint"
          >
            <Icon
              icon="mdi:alert-circle-outline"
              class="hint-icon"
            />
            <span>暂无可用平台，请先在「平台管理」中配置</span>
          </div>
          <div
            v-else
            class="platform-list"
          >
            <label
              v-for="platform in enabledPlatforms"
              :key="platform.id"
              class="platform-item"
              :class="{ selected: selectedPlatforms.includes(platform.id) }"
            >
              <input
                type="checkbox"
                :value="platform.id"
                :checked="selectedPlatforms.includes(platform.id)"
                @change="togglePlatform(platform.id)"
              >
              <Icon
                :icon="platform.icon || 'mdi:cloud-upload-outline'"
                class="platform-icon"
              />
              <span class="platform-name">{{ platform.name }}</span>
              <span class="platform-type-badge">{{ platform.type }}</span>
            </label>
          </div>
        </div>

        <!-- 发布选项 -->
        <div class="section">
          <div class="section-title">
            <Icon icon="mdi:format-list-checks" />
            发布选项
          </div>
          <div class="option-group">
            <!-- 发布格式选择 -->
            <div class="format-selector">
              <span class="format-label">内容格式：</span>
              <label
                class="format-option"
                :class="{ active: publishFormat === 'markdown' }"
              >
                <input
                  v-model="publishFormat"
                  type="radio"
                  value="markdown"
                >
                <Icon icon="mdi:language-markdown" />
                Markdown
              </label>
              <label
                class="format-option"
                :class="{ active: publishFormat === 'richtext' }"
              >
                <input
                  v-model="publishFormat"
                  type="radio"
                  value="richtext"
                >
                <Icon icon="mdi:format-text" />
                富文本
              </label>
            </div>
            <label class="option-label">
              <input
                v-model="publishAsDraft"
                type="checkbox"
              >
              发布为草稿
            </label>
            <label class="option-label">
              <input
                v-model="autoMarkPublished"
                type="checkbox"
              >
              发布后标记为「已发布」
            </label>
          </div>
        </div>

        <!-- 自定义元数据 -->
        <div class="section">
          <div class="section-title">
            <Icon icon="mdi:tag-outline" />
            自定义元数据
          </div>
          <div class="meta-fields">
            <div class="meta-field">
              <label>标题</label>
              <input
                v-model="customTitle"
                type="text"
                placeholder="留空使用原文标题"
                class="meta-input"
              >
            </div>
            <div class="meta-field">
              <label>摘要</label>
              <textarea
                v-model="customSummary"
                placeholder="留空自动截取前 200 字"
                class="meta-textarea"
                rows="2"
              />
            </div>
            <div class="meta-field">
              <label>标签（逗号分隔）</label>
              <input
                v-model="tagsStr"
                type="text"
                placeholder="标签1,标签2"
                class="meta-input"
              >
            </div>
            <div class="meta-field">
              <label>分类（逗号分隔）</label>
              <input
                v-model="categoriesStr"
                type="text"
                placeholder="分类1,分类2"
                class="meta-input"
              >
            </div>
          </div>
        </div>

        <!-- 发布按钮 -->
        <div class="publish-actions">
          <button
            class="publish-btn"
            :disabled="selectedPlatforms.length === 0 || publishing"
            @click="handlePublish"
          >
            <Icon
              :icon="publishing ? 'mdi:loading' : 'mdi:send'"
              :class="{ 'spin-icon': publishing }"
            />
            {{ publishing ? '发布中...' : `发布到 ${selectedPlatforms.length} 个平台` }}
          </button>
        </div>

        <!-- 发布结果 -->
        <div
          v-if="publishResult"
          class="publish-result"
        >
          <div class="result-header">
            <Icon
              :icon="hasPublishError ? 'mdi:alert-circle' : 'mdi:check-circle'"
              :class="hasPublishError ? 'result-error' : 'result-success'"
            />
            <span>{{ hasPublishError ? '部分平台发布失败' : '发布成功' }}</span>
          </div>
          <div class="result-list">
            <div
              v-for="r in publishResult.results"
              :key="r.platformId"
              class="result-item"
              :class="{ success: r.success, error: !r.success }"
            >
              <Icon :icon="r.success ? 'mdi:check-circle' : 'mdi:close-circle'" />
              <span class="result-platform">{{ r.platformName }}</span>
              <a
                v-if="r.remoteUrl"
                :href="r.remoteUrl"
                target="_blank"
                class="result-url"
              >查看</a>
              <span
                v-if="r.errorMessage"
                class="result-error-msg"
              >{{ r.errorMessage }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 平台管理 Tab -->
      <div
        v-if="activeTab === 'platforms'"
        class="platforms-tab-content"
      >
        <PlatformConfig
          :platforms="platforms"
          :test-platform="testPlatform"
          @add="handleAddPlatform"
          @update="handleUpdatePlatform"
          @remove="handleRemovePlatform"
        />
      </div>

      <!-- 发布记录 Tab -->
      <div
        v-if="activeTab === 'history'"
        class="history-tab-content"
      >
        <PublishHistory :doc-id="docId" :plugin="plugin" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  PlatformConfig as PublishPlatformConfig,
  PublishResult,
} from "../types/publish"
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
  watch,
} from "vue"
import { usePublish } from "../composables/usePublish"
import PlatformConfig from "./PlatformConfig.vue"
import PublishHistory from "./PublishHistory.vue"

interface Props {
  visible: boolean
  docId: string
  docTitle: string
  plugin: Plugin
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: "close"): void
  (e: "published"): void
}>()

const {
  platforms,
  publishing,
  loadPublishConfig,
  publishDoc,
  testPlatform,
  addPlatform,
  updatePlatform,
  removePlatform,
  markAsPublished,
} = usePublish(props.plugin)

const activeTab = ref<"publish" | "platforms" | "history">("publish")
const selectedPlatforms = ref<string[]>([])
const publishFormat = ref<"markdown" | "richtext">("markdown")
const publishAsDraft = ref(false)
const autoMarkPublished = ref(true)
const customTitle = ref("")
const customSummary = ref("")
const tagsStr = ref("")
const categoriesStr = ref("")
const publishResult = ref<PublishResult | null>(null)

const enabledPlatforms = computed(() => platforms.value.filter(p => p.enabled))
const hasPublishError = computed(() => publishResult.value?.results.some(r => !r.success) ?? false)

// 面板打开时加载配置
watch(() => props.visible, async (val) => {
  if (val) {
    await loadPublishConfig()
    publishResult.value = null
    selectedPlatforms.value = []
    customTitle.value = ""
    customSummary.value = ""
    tagsStr.value = ""
    categoriesStr.value = ""
    activeTab.value = "publish"
  }
})

function togglePlatform(id: string) {
  const idx = selectedPlatforms.value.indexOf(id)
  if (idx >= 0) {
    selectedPlatforms.value.splice(idx, 1)
  } else {
    selectedPlatforms.value.push(id)
  }
}

async function handlePublish() {
  if (selectedPlatforms.value.length === 0) return

  publishResult.value = await publishDoc({
    docId: props.docId,
    platformIds: selectedPlatforms.value,
    customTitle: customTitle.value || undefined,
    customSummary: customSummary.value || undefined,
    tags: tagsStr.value ? tagsStr.value.split(",").map(t => t.trim()).filter(Boolean) : undefined,
    categories: categoriesStr.value ? categoriesStr.value.split(",").map(c => c.trim()).filter(Boolean) : undefined,
    asDraft: publishAsDraft.value,
    format: publishFormat.value,
  })

  if (autoMarkPublished.value && publishResult.value?.results.some(r => r.success)) {
    await markAsPublished([props.docId])
  }

  emit("published")
}

function handleClose() {
  emit("close")
}

async function handleAddPlatform(platform: Omit<PublishPlatformConfig, "id" | "createdAt" | "updatedAt">) {
  await addPlatform(platform)
}

async function handleUpdatePlatform(id: string, updates: Partial<PublishPlatformConfig>) {
  await updatePlatform(id, updates)
}

async function handleRemovePlatform(id: string) {
  await removePlatform(id)
}

</script>

<style lang="scss" scoped>
@use "../styles/publish";
</style>
