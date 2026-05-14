<template>
  <div class="bookmark-marker-settings">
    <label class="setting-label">
      <span class="label-icon">🔖</span>
      {{ i18n?.enableBookmarkMarker || '书签标记' }}
    </label>
    <SiSwitch
      v-model="enableBookmarkMarker"
      @change="handleToggleChange"
    />
    <p class="toggle-description">
      {{ i18n?.bookmarkMarkerDescription || '根据文档书签内容在文件树中显示颜色标记' }}
    </p>

    <!-- 功能说明 -->
    <div class="feature-description">
      <div class="description-title">
        <span class="title-icon">💡</span>
        {{ i18n?.featureDescription || '功能说明' }}
      </div>
      <ul class="description-list">
        <li>{{ i18n?.bookmarkFeature1 || '在文件树中为有书签的文档显示颜色标签' }}</li>
        <li>{{ i18n?.bookmarkFeature2 || '书签为空则不显示标记' }}</li>
        <li>{{ i18n?.bookmarkFeature3 || '可自定义书签名称与对应颜色' }}</li>
        <li>{{ i18n?.bookmarkFeature4 || '支持手机端和桌面端' }}</li>
      </ul>
    </div>

    <!-- 标记规则设置 -->
    <template v-if="enableBookmarkMarker">
      <div class="rules-settings">
        <div class="settings-title">
          <span class="title-icon">🏷️</span>
          {{ i18n?.bookmarkRules || '标记规则' }}
          <button
            class="refresh-btn"
            @click="handleRefresh"
          >
            🔄 {{ i18n?.refreshNow || '立即刷新' }}
          </button>
        </div>

        <div
          v-for="(rule, index) in rules"
          :key="index"
          class="rule-item"
        >
          <div class="rule-header">
            <span class="rule-index">#{{ index + 1 }}</span>
            <button
              class="rule-remove-btn"
              @click="removeRule(index)"
            >
              ✕
            </button>
          </div>
          <div class="rule-fields">
            <div class="rule-row">
              <label class="rule-label">
                {{ i18n?.bookmarkName || '书签名称' }}
              </label>
              <input
                v-model="rule.bookmarkName"
                type="text"
                class="rule-input"
                :placeholder="i18n?.bookmarkNamePlaceholder || '输入书签名称'"
                @change="handleRulesChange"
              />
            </div>
            <div class="rule-row">
              <label class="rule-label">
                {{ i18n?.markerTextColor || '文字颜色' }}
              </label>
              <div class="color-input-wrapper">
                <input
                  v-model="rule.color"
                  type="color"
                  class="color-picker"
                  @input="handleRulesChange"
                />
                <input
                  v-model="rule.color"
                  type="text"
                  class="color-text"
                  placeholder="#ffffff"
                  @change="handleRulesChange"
                />
              </div>
            </div>
            <div class="rule-row">
              <label class="rule-label">
                {{ i18n?.markerBgColor || '背景颜色' }}
              </label>
              <div class="color-input-wrapper">
                <input
                  v-model="rule.backgroundColor"
                  type="color"
                  class="color-picker"
                  @input="handleRulesChange"
                />
                <input
                  v-model="rule.backgroundColor"
                  type="text"
                  class="color-text"
                  placeholder="#52c41a"
                  @change="handleRulesChange"
                />
              </div>
            </div>
          </div>
          <!-- 预览 -->
          <div class="rule-preview">
            <span class="preview-label-text">预览：</span>
            <span
              class="preview-tag"
              :style="{
                color: rule.color,
                backgroundColor: rule.backgroundColor,
              }"
            >{{ rule.bookmarkName || '未命名' }}</span>
          </div>
        </div>

        <button
          class="add-rule-btn"
          @click="addRule"
        >
          + {{ i18n?.addRule || '添加规则' }}
        </button>
      </div>

      <!-- 更新间隔设置 -->
      <div class="update-interval">
        <label class="interval-label">
          {{ i18n?.updateInterval || '更新间隔' }}
        </label>
        <select
          v-model="updateInterval"
          class="interval-select"
          @change="handleIntervalChange"
        >
          <option value="1800000">
            {{ i18n?.interval30min || '30分钟' }}
          </option>
          <option value="3600000">
            {{ i18n?.interval1hour || '1小时' }}
          </option>
          <option value="7200000">
            {{ i18n?.interval2hour || '2小时' }}
          </option>
          <option value="14400000">
            {{ i18n?.interval4hour || '4小时' }}
          </option>
        </select>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import SiSwitch from "@/components/Switch.vue"
import { BookmarkMarker } from "../modules/BookmarkMarker"
import type { BookmarkRule } from "../modules/BookmarkMarker"

import { GeneralSettingsStorage } from "../types/storage"

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const emit = defineEmits<{
  change: [settings: any]
}>()

const enableBookmarkMarker = ref(true)
const rules = ref<BookmarkRule[]>([
  { bookmarkName: "已发布", color: "#ffffff", backgroundColor: "#52c41a" },
  { bookmarkName: "待发布", color: "#ffffff", backgroundColor: "#faad14" },
])
const updateInterval = ref("3600000")

const getBookmarkMarker = (): BookmarkMarker | null => {
  const generalSettings = props.plugin?.__generalSettings
  return generalSettings?.bookmarkMarker || null
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

const ensureStorage = (): GeneralSettingsStorage => {
  if (!gsStorage.value) throw new Error("插件实例不可用")
  return gsStorage.value
}

const loadSettings = async () => {
  try {
    const data = gsStorage.value ? await gsStorage.value.bookmarkMarker.load() : null
    if (data) {
      enableBookmarkMarker.value = data.enableBookmarkMarker ?? true
      rules.value = data.rules?.length ? data.rules : [
        { bookmarkName: "已发布", color: "#ffffff", backgroundColor: "#52c41a" },
        { bookmarkName: "待发布", color: "#ffffff", backgroundColor: "#faad14" },
      ]
      updateInterval.value = data.updateInterval?.toString() || "3600000"
    }
  } catch (e) {
    console.error("加载书签标记设置失败:", e)
  }
}

const handleToggleChange = async () => {
  try {
    await ensureStorage().bookmarkMarker.save({
      enableBookmarkMarker: enableBookmarkMarker.value,
      rules: rules.value,
      updateInterval: Number(updateInterval.value),
    })

    const marker = getBookmarkMarker()
    if (enableBookmarkMarker.value) {
      if (!marker && props.plugin?.__generalSettings) {
        props.plugin.__generalSettings.bookmarkMarker = new BookmarkMarker()
        const newMarker = getBookmarkMarker()
        newMarker?.start()
        newMarker?.setUpdateInterval(Number.parseInt(updateInterval.value))
        newMarker?.updateOptions({ rules: rules.value })
      } else {
        marker?.start()
      }
    } else {
      marker?.stop()
    }

    showMessage(
      enableBookmarkMarker.value
        ? "书签标记已启用"
        : "书签标记已禁用",
      2000,
      "info",
    )

    emit("change", {
      enableBookmarkMarker: enableBookmarkMarker.value,
      rules: rules.value,
      updateInterval: updateInterval.value,
    })
  } catch (e) {
    console.error("保存书签标记设置失败:", e)
  }
}

const handleRulesChange = async () => {
  try {
    await ensureStorage().bookmarkMarker.save({
      enableBookmarkMarker: enableBookmarkMarker.value,
      rules: rules.value,
      updateInterval: Number(updateInterval.value),
    })

    const marker = getBookmarkMarker()
    marker?.updateOptions({ rules: rules.value })

    showMessage("标记规则已更新", 2000, "info")
  } catch (e) {
    console.error("保存标记规则失败:", e)
  }
}

const handleIntervalChange = async () => {
  try {
    await ensureStorage().bookmarkMarker.save({
      enableBookmarkMarker: enableBookmarkMarker.value,
      rules: rules.value,
      updateInterval: Number(updateInterval.value),
    })

    const marker = getBookmarkMarker()
    marker?.setUpdateInterval(Number.parseInt(updateInterval.value))

    showMessage("更新间隔已修改", 2000, "info")
  } catch (e) {
    console.error("保存更新间隔失败:", e)
  }
}

const addRule = () => {
  rules.value.push({
    bookmarkName: "",
    color: "#ffffff",
    backgroundColor: "#1890ff",
  })
}

const removeRule = (index: number) => {
  rules.value.splice(index, 1)
  handleRulesChange()
}

const handleRefresh = async () => {
  try {
    const marker = getBookmarkMarker()
    if (marker) {
      // 强制刷新缓存并重新应用标记
      marker.updateOptions({ rules: JSON.parse(JSON.stringify(rules.value)) })
      showMessage("书签标记已刷新", 2000, "info")
    } else {
      showMessage("书签标记功能未启动", 2000, "warning")
    }
  } catch (e) {
    console.error("刷新书签标记失败:", e)
  }
}

onMounted(async () => {
  await loadSettings()
})

defineExpose({
  loadSettings,
  enableBookmarkMarker,
})
</script>

<style scoped>
.bookmark-marker-settings {
  padding: 16px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

.toggle-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-top: 8px;
  line-height: 1.4;
}

.feature-description {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.description-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

.title-icon {
  font-size: 14px;
}

.description-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.8;
}

.description-list li {
  margin-bottom: 4px;
}

.description-list li:last-child {
  margin-bottom: 0;
}

.rules-settings {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 14px;
}

.refresh-btn {
  margin-left: auto;
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.refresh-btn:hover {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.05);
}

.rule-item {
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  margin-bottom: 10px;
}

.rule-item:last-of-type {
  margin-bottom: 14px;
}

.rule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.rule-index {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-variant);
}

.rule-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  font-size: 12px;
  opacity: 0.6;
  transition: all 0.2s;
}

.rule-remove-btn:hover {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
  opacity: 1;
}

.rule-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-label {
  flex-shrink: 0;
  width: 70px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.rule-input {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
}

.rule-input:hover {
  border-color: var(--b3-theme-primary);
}

.rule-input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.color-picker {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  background: var(--b3-theme-background);
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-text {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
  font-family: monospace;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.color-text:hover {
  border-color: var(--b3-theme-primary);
}

.color-text:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.rule-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.preview-label-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.preview-tag {
  display: inline-block;
  font-size: 10px;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 3px;
  font-weight: 500;
}

.add-rule-btn {
  display: block;
  width: 100%;
  padding: 8px;
  font-size: 13px;
  border: 1px dashed var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.add-rule-btn:hover {
  border-color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.05);
}

.update-interval {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.interval-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.interval-select {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.interval-select:hover {
  border-color: var(--b3-theme-primary);
}

.interval-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}
</style>
