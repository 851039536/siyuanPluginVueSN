<template>
  <div
    v-if="visible"
    class="platform-manage-overlay"
    @click.self="$emit('close')"
  >
    <div class="platform-manage-panel">
      <!-- 头部 -->
      <div class="platform-manage-header">
        <div class="header-title">
          <Icon icon="mdi:cog-outline" class="header-icon" />
          <span>平台管理</span>
          <span class="header-subtitle">增删改平台，分析结果将同步更新</span>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <Icon icon="mdi:close" />
        </button>
      </div>

      <!-- 平台列表 -->
      <div class="platform-manage-body">
        <div
          v-for="(p, idx) in localPlatforms"
          :key="idx"
          class="platform-row"
        >
          <!-- 拖拽排序手柄 -->
          <span class="platform-row-drag" title="拖拽排序">
            <Icon icon="mdi:drag-vertical" />
          </span>

          <!-- ID（不可编辑） -->
          <div class="platform-row-field field-id">
            <label class="field-label">ID</label>
            <input
              v-model="p.id"
              type="text"
              class="field-input"
              :class="{ error: getError(idx, 'id') }"
              placeholder="如 csdn"
              @input="validate"
            />
          </div>

          <!-- 名称 -->
          <div class="platform-row-field field-name">
            <label class="field-label">名称</label>
            <input
              v-model="p.name"
              type="text"
              class="field-input"
              :class="{ error: getError(idx, 'name') }"
              placeholder="如 CSDN"
              @input="validate"
            />
          </div>

          <!-- 匹配关键词 -->
          <div class="platform-row-field field-matchers">
            <label class="field-label">匹配关键词</label>
            <input
              :value="p.matchers.join(', ')"
              type="text"
              class="field-input"
              placeholder="如 csdn, csdnblog"
              @input="updateMatchers(idx, $event)"
            />
          </div>

          <!-- URL -->
          <div class="platform-row-field field-url">
            <label class="field-label">发布URL</label>
            <input
              v-model="p.url"
              type="text"
              class="field-input"
              placeholder="发布平台链接（可选）"
            />
          </div>

          <!-- 操作按钮 -->
          <div class="platform-row-actions">
            <button
              class="row-btn"
              :disabled="idx === 0"
              title="上移"
              @click="moveUp(idx)"
            >
              <Icon icon="mdi:arrow-up" />
            </button>
            <button
              class="row-btn"
              :disabled="idx === localPlatforms.length - 1"
              title="下移"
              @click="moveDown(idx)"
            >
              <Icon icon="mdi:arrow-down" />
            </button>
            <button
              class="row-btn row-btn--danger"
              title="删除"
              @click="removePlatform(idx)"
            >
              <Icon icon="mdi:delete-outline" />
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="localPlatforms.length === 0" class="platform-manage-empty">
          <Icon icon="mdi:cloud-off-outline" />
          <span>暂未配置任何平台，点击「新增平台」添加</span>
        </div>
      </div>

      <!-- 底部 -->
      <div class="platform-manage-footer">
        <button class="footer-btn" @click="addPlatform">
          <Icon icon="mdi:plus" />
          新增平台
        </button>
        <button
          class="footer-btn"
          title="恢复为默认平台列表"
          @click="resetToDefault"
        >
          <Icon icon="mdi:restore" />
          恢复默认
        </button>
        <div class="footer-spacer" />
        <button class="footer-btn" @click="$emit('close')">
          取消
        </button>
        <button
          class="footer-btn footer-btn--primary"
          :disabled="!isValid || saving"
          @click="handleSave"
        >
          <Icon :icon="saving ? 'mdi:loading' : 'mdi:check'" :class="{ 'spin-icon': saving }" />
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import type { PlatformMeta } from "../types/index"
import { PLATFORM_META, DEFAULT_PLATFORM_META } from "../composables/useDocAnalysis"

interface Props {
  visible: boolean
  /** 平台保存回调：返回 true 表示持久化成功 */
  savePlatformMeta: (meta: PlatformMeta[]) => Promise<boolean>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "saved"): void
}>()

const saving = ref(false)
const localPlatforms = ref<PlatformMeta[]>([])

// 打开时同步最新数据
watch(() => props.visible, (v) => {
  if (v) {
    localPlatforms.value = PLATFORM_META.value.map((p) => ({
      ...p,
      matchers: [...p.matchers],
    }))
    validate()
  }
})

// 校验
const errors = ref<Set<string>>(new Set())

function validate() {
  const ids = new Set<string>()
  const errs = new Set<string>()
  for (let i = 0; i < localPlatforms.value.length; i++) {
    const p = localPlatforms.value[i]
    const idTrim = p.id.trim()
    if (!idTrim) {
      errs.add(`${i}:id:empty`)
    } else if (ids.has(idTrim)) {
      errs.add(`${i}:id:dup`)
    }
    ids.add(idTrim)
    if (!p.name.trim()) {
      errs.add(`${i}:name:empty`)
    }
  }
  errors.value = errs
}

function getError(idx: number, field: string): boolean {
  if (field === "id") return errors.value.has(`${idx}:id:empty`) || errors.value.has(`${idx}:id:dup`)
  if (field === "name") return errors.value.has(`${idx}:name:empty`)
  return false
}

function updateMatchers(idx: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  localPlatforms.value[idx].matchers = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}

const isValid = computed(() =>
  errors.value.size === 0 &&
  localPlatforms.value.length > 0,
)

function addPlatform() {
  localPlatforms.value.push({ id: "", matchers: [], name: "", url: "" })
  validate()
}

function removePlatform(idx: number) {
  localPlatforms.value.splice(idx, 1)
  validate()
}

function moveUp(idx: number) {
  if (idx <= 0) return
  const arr = localPlatforms.value
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
}

function moveDown(idx: number) {
  if (idx >= localPlatforms.value.length - 1) return
  const arr = localPlatforms.value
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
}

function resetToDefault() {
  localPlatforms.value = DEFAULT_PLATFORM_META.map((p) => ({
    ...p,
    matchers: [...p.matchers],
  }))
  validate()
}

async function handleSave() {
  if (!isValid.value || saving.value) return
  saving.value = true
  try {
    const clean = localPlatforms.value.map((p) => ({
      ...p,
      id: p.id.trim(),
      name: p.name.trim(),
      matchers: p.matchers.filter(Boolean),
    }))
    await props.savePlatformMeta(clean)
    emit("saved")
    emit("close")
  } catch (e) {
    console.error("保存平台配置失败:", e)
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/PlatformManageModal.scss";
</style>
