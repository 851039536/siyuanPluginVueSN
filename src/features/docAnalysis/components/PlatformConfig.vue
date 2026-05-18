<template>
  <div class="platform-config">
    <!-- 添加平台按钮 -->
    <div class="add-platform-bar">
      <button
        class="add-btn"
        @click="showAddForm = true"
      >
        <Icon icon="mdi:plus" />
        添加平台
      </button>
    </div>

    <!-- 平台列表 -->
    <div
      v-if="platforms.length === 0 && !showAddForm"
      class="empty-platforms"
    >
      <Icon
        icon="mdi:cloud-off-outline"
        class="empty-icon"
      />
      <p>暂无配置平台</p>
      <p class="empty-desc">
        点击上方「添加平台」配置发布目标
      </p>
    </div>

    <div
      v-for="platform in platforms"
      :key="platform.id"
      class="platform-card"
    >
      <div class="platform-card-header">
        <div class="platform-card-info">
          <Icon
            :icon="platform.icon || 'mdi:cloud-upload-outline'"
            class="platform-card-icon"
          />
          <div class="platform-card-text">
            <span class="platform-card-name">{{ platform.name }}</span>
            <span class="platform-card-type">{{ platform.type }}</span>
          </div>
        </div>
        <div class="platform-card-actions">
          <button
            class="action-btn test-btn"
            title="测试连通性"
            @click="$emit('test', platform.id)"
          >
            <Icon icon="mdi:lan-connect" />
          </button>
          <button
            class="action-btn edit-btn"
            title="编辑"
            @click="startEdit(platform)"
          >
            <Icon icon="mdi:pencil-outline" />
          </button>
          <button
            class="action-btn delete-btn"
            title="删除"
            @click="handleRemove(platform.id)"
          >
            <Icon icon="mdi:delete-outline" />
          </button>
        </div>
      </div>
      <div class="platform-card-url">
        {{ platform.apiUrl || '(未配置)' }}
      </div>
      <div
        v-if="testingId === platform.id"
        class="platform-card-test"
        :class="testResult?.success ? 'test-success' : 'test-error'"
      >
        <Icon :icon="testResult?.success ? 'mdi:check-circle' : 'mdi:alert-circle'" />
        {{ testResult?.message }}
      </div>
    </div>

    <!-- 添加/编辑表单 -->
    <div
      v-if="showAddForm || editingPlatform"
      class="platform-form-overlay"
      @click.self="cancelForm"
    >
      <div class="platform-form">
        <div class="form-header">
          <span>{{ editingPlatform ? '编辑平台' : '添加平台' }}</span>
          <button
            class="close-btn"
            @click="cancelForm"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>

        <!-- 选择平台模板 -->
        <div
          v-if="!editingPlatform"
          class="template-grid"
        >
          <div
            v-for="tpl in PLATFORM_TEMPLATES"
            :key="tpl.type"
            class="template-item"
            :class="{ selected: formType === tpl.type }"
            @click="selectTemplate(tpl)"
          >
            <Icon
              :icon="tpl.icon"
              class="template-icon"
            />
            <span class="template-name">{{ tpl.name }}</span>
          </div>
        </div>

        <!-- 表单字段 -->
        <div class="form-fields">
          <div class="form-field">
            <label>平台名称 *</label>
            <input
              v-model="formName"
              type="text"
              placeholder="如: 我的博客"
              class="form-input"
            >
          </div>
          <div class="form-field">
            <label>API 地址 *</label>
            <input
              v-model="formApiUrl"
              type="text"
              placeholder="如: https://api.github.com"
              class="form-input"
            >
          </div>
          <div class="form-field">
            <label>认证 Token / API Key</label>
            <input
              v-model="formToken"
              type="password"
              placeholder="输入 Token"
              class="form-input"
            >
          </div>

          <!-- Git 类平台额外配置 -->
          <template v-if="isGitPlatform">
            <div class="form-field">
              <label>仓库所有者</label>
              <input
                v-model="formExtra.owner"
                type="text"
                placeholder="username"
                class="form-input"
              >
            </div>
            <div class="form-field">
              <label>仓库名称</label>
              <input
                v-model="formExtra.repo"
                type="text"
                placeholder="repo-name"
                class="form-input"
              >
            </div>
            <div class="form-field">
              <label>分支</label>
              <input
                v-model="formExtra.branch"
                type="text"
                placeholder="main"
                class="form-input"
              >
            </div>
            <div class="form-field">
              <label>文件路径模板</label>
              <input
                v-model="formExtra.pathTemplate"
                type="text"
                placeholder="content/posts/{slug}.md"
                class="form-input"
              >
            </div>
            <div class="form-field">
              <label>提交信息模板</label>
              <input
                v-model="formExtra.commitMessage"
                type="text"
                placeholder="publish: {title}"
                class="form-input"
              >
            </div>
          </template>

          <!-- WordPress 额外配置 -->
          <template v-if="formType === 'wordpress'">
            <div class="form-field">
              <label>XMLRPC 地址</label>
              <input
                v-model="formExtra.xmlrpcUrl"
                type="text"
                placeholder="https://yourblog.com/xmlrpc.php"
                class="form-input"
              >
            </div>
            <div class="form-field">
              <label>用户名</label>
              <input
                v-model="formExtra.username"
                type="text"
                class="form-input"
              >
            </div>
            <div class="form-field">
              <label>密码</label>
              <input
                v-model="formExtra.password"
                type="password"
                class="form-input"
              >
            </div>
          </template>

          <!-- Cookie 认证平台 -->
          <template v-if="isCookiePlatform">
            <div class="form-field">
              <label>Cookie</label>
              <textarea
                v-model="formExtra.cookie"
                placeholder="从浏览器复制 Cookie"
                class="form-textarea"
                rows="3"
              />
            </div>
          </template>

          <!-- Webhook/自定义平台 -->
          <template v-if="formType === 'webhook' || formType === 'custom'">
            <div class="form-field">
              <label>HTTP 方法</label>
              <select
                v-model="formExtra.method"
                class="form-select"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div class="form-field">
              <label>请求体模板</label>
              <textarea
                v-model="formExtra.bodyTemplate"
                placeholder='{"title":"{{title}}","content":"{{content}}"}'
                class="form-textarea"
                rows="4"
              />
            </div>
            <div class="form-field">
              <label>自定义 Headers (JSON)</label>
              <textarea
                v-model="formExtraHeadersStr"
                placeholder='{"Content-Type": "application/json"}'
                class="form-textarea"
                rows="2"
              />
            </div>
          </template>
        </div>

        <div class="form-actions">
          <button
            class="cancel-btn"
            @click="cancelForm"
          >
            取消
          </button>
          <button
            class="save-btn"
            :disabled="!formName || !formApiUrl"
            @click="handleSave"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlatformConfig, PlatformType, PlatformTemplate } from "../types/publish"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { PLATFORM_TEMPLATES } from "../types/publish"

interface Props {
  platforms: PlatformConfig[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: "add", platform: Omit<PlatformConfig, "id" | "createdAt" | "updatedAt">): void
  (e: "update", id: string, updates: Partial<PlatformConfig>): void
  (e: "remove", id: string): void
  (e: "test", id: string): void
}>()

const showAddForm = ref(false)
const editingPlatform = ref<PlatformConfig | null>(null)
const testingId = ref<string | null>(null)
const testResult = ref<{ success: boolean, message: string } | null>(null)

// 表单状态
const formType = ref<PlatformType>("webhook")
const formName = ref("")
const formApiUrl = ref("")
const formToken = ref("")
const formExtra = ref<Record<string, any>>({})
const formExtraHeadersStr = ref("{}")

const isGitPlatform = computed(() => ["github", "gitlab", "hexo", "hugo", "jekyll", "vuepress", "vitepress"].includes(formType.value))
const isCookiePlatform = computed(() => ["zhihu", "csdn", "juejin", "wechat"].includes(formType.value))

function selectTemplate(tpl: PlatformTemplate) {
  formType.value = tpl.type
  formName.value = formName.value || tpl.name
  formApiUrl.value = formApiUrl.value || tpl.defaultConfig.apiUrl || ""
  formExtra.value = { ...(tpl.defaultConfig.extraConfig || {}) }
  formExtraHeadersStr.value = JSON.stringify(formExtra.value.headers || {}, null, 2)
}

function startEdit(platform: PlatformConfig) {
  editingPlatform.value = platform
  formType.value = platform.type
  formName.value = platform.name
  formApiUrl.value = platform.apiUrl
  formToken.value = platform.token
  formExtra.value = { ...platform.extraConfig }
  formExtraHeadersStr.value = JSON.stringify(platform.extraConfig.headers || {}, null, 2)
}

function cancelForm() {
  showAddForm.value = false
  editingPlatform.value = null
  resetForm()
}

function resetForm() {
  formType.value = "webhook"
  formName.value = ""
  formApiUrl.value = ""
  formToken.value = ""
  formExtra.value = {}
  formExtraHeadersStr.value = "{}"
}

function handleSave() {
  let headers: Record<string, string> = {}
  try {
    headers = JSON.parse(formExtraHeadersStr.value)
  } catch {
    // 忽略
  }

  const extraConfig = { ...formExtra.value }
  if (formType.value === "webhook" || formType.value === "custom") {
    extraConfig.headers = headers
  }

  if (editingPlatform.value) {
    emit("update", editingPlatform.value.id, {
      type: formType.value,
      name: formName.value,
      apiUrl: formApiUrl.value,
      token: formToken.value,
      extraConfig,
    })
  } else {
    const tpl = PLATFORM_TEMPLATES.find(t => t.type === formType.value)
    emit("add", {
      type: formType.value,
      name: formName.value,
      enabled: true,
      icon: tpl?.icon || "mdi:cloud-upload-outline",
      apiUrl: formApiUrl.value,
      token: formToken.value,
      extraConfig,
    })
  }

  cancelForm()
}

function handleRemove(id: string) {
  if (confirm("确定删除此平台配置？")) {
    emit("remove", id)
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/publish";
</style>
