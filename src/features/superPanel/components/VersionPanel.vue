<template>
  <div class="vp">
    <!-- 头部 -->
    <header class="vp-header">
      <h2 class="vp-title">
        <IconWrapper
          name="mdi:package-variant"
          :size="16"
        />
        {{ featureTitle }}
      </h2>
      <button
        class="vp-close"
        @click="emit('close')"
      >
        <IconWrapper
          name="close"
          :size="14"
        />
      </button>
    </header>

    <!-- 元信息 -->
    <div class="vp-meta">
      <div class="vp-meta-row">
        <span class="vp-meta-key">VERSION</span>
        <code class="vp-meta-val vp-meta-val--primary">{{ currentVersion }}</code>
      </div>
      <div class="vp-meta-row">
        <span class="vp-meta-key">STORE</span>
        <code class="vp-meta-val">{{ storagePath }}</code>
      </div>
    </div>

    <!-- 新增表单 -->
    <section class="vp-form">
      <div class="vp-form-head">
        + New Release
      </div>
      <div class="vp-form-row">
        <div class="vp-field">
          <label class="vp-field-label">Tag</label>
          <input
            v-model="newVersion"
            class="vp-input vp-input--mono"
            type="text"
            placeholder="1.0.0.0"
            @keyup.enter="handleAdd"
          >
        </div>
        <div class="vp-field">
          <label class="vp-field-label">Date</label>
          <input
            v-model="newDate"
            class="vp-input vp-input--mono"
            type="date"
          >
        </div>
      </div>
      <div class="vp-field">
        <label class="vp-field-label">Changes</label>
        <textarea
          v-model="newDescription"
          class="vp-textarea"
          placeholder="新增了什么、修复了什么..."
          rows="10"
        />
      </div>
      <button
        class="vp-btn vp-btn--primary"
        :disabled="!isValid(newVersion, newDescription)"
        @click="handleAdd"
      >
        Publish
      </button>
    </section>

    <!-- 版本列表 -->
    <section
      v-if="sortedVersions.length"
      class="vp-releases"
    >
      <div class="vp-releases-head">
        <span>Releases</span>
        <span class="vp-releases-count">{{ sortedVersions.length }}</span>
      </div>

      <div
        v-for="(entry, index) in sortedVersions"
        :key="index"
        class="vp-release"
        :class="{ 'vp-release--editing': editingIndex === index }"
      >
        <!-- 查看模式 -->
        <template v-if="editingIndex !== index">
          <div class="vp-release-top">
            <code class="vp-release-tag">{{ entry.version }}</code>
            <span class="vp-release-date">{{ entry.date }}</span>
            <div class="vp-release-actions">
              <button
                class="vp-icon-btn"
                title="编辑"
                @click="startEdit(index)"
              >
                <IconWrapper
                  name="mdi:pencil"
                  :size="12"
                />
              </button>
              <button
                class="vp-icon-btn vp-icon-btn--danger"
                title="删除"
                @click="handleDelete(index)"
              >
                <IconWrapper
                  name="mdi:delete-outline"
                  :size="12"
                />
              </button>
            </div>
          </div>
          <pre class="vp-release-body">{{ entry.description }}</pre>
        </template>

        <!-- 编辑模式 -->
        <template v-else>
          <div class="vp-form-row">
            <div class="vp-field">
              <label class="vp-field-label">Tag</label>
              <input
                v-model="editVersion"
                class="vp-input vp-input--mono"
                type="text"
              >
            </div>
            <div class="vp-field">
              <label class="vp-field-label">Date</label>
              <input
                v-model="editDate"
                class="vp-input vp-input--mono"
                type="date"
              >
            </div>
          </div>
          <div class="vp-field">
            <label class="vp-field-label">Changes</label>
            <textarea
              v-model="editDescription"
              class="vp-textarea"
              rows="10"
            />
          </div>
          <div class="vp-edit-bar">
            <button
              class="vp-btn vp-btn--primary"
              :disabled="!isValid(editVersion, editDescription)"
              @click="saveEdit(index)"
            >
              Save
            </button>
            <button
              class="vp-btn vp-btn--ghost"
              @click="cancelEdit"
            >
              Cancel
            </button>
          </div>
        </template>
      </div>
    </section>

    <div
      v-else
      class="vp-empty"
    >
      No releases yet
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeatureVersionEntry } from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { DEFAULT_VERSION } from "../types"

interface Props {
  featureId: string
  featureTitle: string
  versions: FeatureVersionEntry[]
  storagePath?: string
}

interface Emits {
  (e: "addVersion", entry: FeatureVersionEntry): void
  (e: "updateVersion", index: number, entry: FeatureVersionEntry): void
  (e: "deleteVersion", index: number): void
  (e: "close"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// ==================== 工具函数 ====================

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function incrementVersion(ver: string): string {
  const parts = ver.split(".")
  if (parts.length === 0) return "1.0.0.1"
  const last = Number.parseInt(parts[parts.length - 1], 10)
  if (Number.isNaN(last)) return `${ver}.1`
  parts[parts.length - 1] = String(last + 1)
  return parts.join(".")
}

function isValid(version: string, desc: string): boolean {
  return version.trim().length > 0 && desc.trim().length > 0
}

function buildEntry(version: string, date: string, description: string): FeatureVersionEntry {
  return {
    version: version.trim(),
    date: date || today(),
    description: description.trim(),
  }
}

// ==================== 新增表单 ====================

const newVersion = ref("")
const newDate = ref(today())
const newDescription = ref("")

const currentVersion = computed(() =>
  props.versions.length > 0 ? props.versions[0].version : DEFAULT_VERSION,
)

watch(
  () => currentVersion.value,
  (ver) => {
    if (!newVersion.value) newVersion.value = incrementVersion(ver)
  },
  { immediate: true },
)

const sortedVersions = computed(() => [...props.versions])

const handleAdd = (): void => {
  if (!isValid(newVersion.value, newDescription.value)) return
  emit("addVersion", buildEntry(newVersion.value, newDate.value, newDescription.value))
  newVersion.value = incrementVersion(newVersion.value.trim())
  newDescription.value = ""
  newDate.value = today()
}

// ==================== 编辑模式 ====================

const editingIndex = ref<number | null>(null)
const editVersion = ref("")
const editDate = ref("")
const editDescription = ref("")

const startEdit = (index: number): void => {
  const entry = props.versions[index]
  if (!entry) return
  editingIndex.value = index
  editVersion.value = entry.version
  editDate.value = entry.date
  editDescription.value = entry.description
}

const cancelEdit = (): void => {
  editingIndex.value = null
}

const saveEdit = (index: number): void => {
  if (!isValid(editVersion.value, editDescription.value)) return
  emit("updateVersion", index, buildEntry(editVersion.value, editDate.value, editDescription.value))
  editingIndex.value = null
}

const handleDelete = (index: number): void => {
  emit("deleteVersion", index)
}
</script>
