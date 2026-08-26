<!-- 文档分析功能 - 设置弹窗平台管理分区（平台增删/上下移/恢复默认/校验） -->
<template>
  <section class="settings-section">
    <div class="settings-section-title">平台管理</div>

    <div
      v-for="(p, idx) in localPlatforms"
      :key="idx"
      class="platform-row"
      :class="{ 'platform-row--hidden': p.hidden }"
    >
      <!-- 完整发布判定切换（undefined 视为参与判定） -->
      <span class="cell-fullcheck">
        <button
          class="row-btn-icon fullcheck-toggle"
          :class="{ active: p.fullCheck !== false }"
          :title="(p.fullCheck !== false) ? '参与完整发布判定' : '不参与完整发布判定'"
          @click="toggleFullCheck(idx)"
        >
          <Icon :icon="(p.fullCheck !== false) ? 'mdi:check-circle' : 'mdi:circle-outline'" />
        </button>
      </span>

      <!-- 可见性切换 -->
      <span class="cell-vis">
        <button
          class="row-btn-icon"
          :title="p.hidden ? '取消隐藏' : '隐藏'"
          @click="toggleHidden(idx)"
        >
          <Icon :icon="p.hidden ? 'mdi:eye-off-outline' : 'mdi:eye-outline'" />
        </button>
      </span>

      <!-- 名称 -->
      <span class="cell-field cell-name">
        <input
          v-model="p.name"
          type="text"
          class="cell-input"
          :class="{ error: getError(idx, 'name') }"
          placeholder="CSDN"
          @input="commit"
        />
      </span>

      <!-- ID -->
      <span class="cell-field cell-id">
        <input
          v-model="p.id"
          type="text"
          class="cell-input cell-input--mono"
          :class="{ error: getError(idx, 'id') }"
          placeholder="csdn"
          @input="commit"
        />
      </span>

      <!-- 匹配关键词 -->
      <span class="cell-field cell-matchers">
        <input
          :value="p.matchers.join(', ')"
          type="text"
          class="cell-input cell-input--mono"
          placeholder="csdn, csdnblog"
          @input="updateMatchers(idx, $event)"
        />
      </span>

      <!-- 操作 -->
      <span class="cell-actions">
        <button
          class="row-btn-icon"
          :disabled="idx === 0"
          title="上移"
          @click="moveUp(idx)"
        >
          <Icon icon="mdi:chevron-up" />
        </button>
        <button
          class="row-btn-icon"
          :disabled="idx === localPlatforms.length - 1"
          title="下移"
          @click="moveDown(idx)"
        >
          <Icon icon="mdi:chevron-down" />
        </button>
        <button
          class="row-btn-icon row-btn-icon--danger"
          title="删除"
          @click="removePlatform(idx)"
        >
          <Icon icon="mdi:delete-outline" />
        </button>
      </span>
    </div>

    <!-- 空状态 -->
    <div
      v-if="localPlatforms.length === 0"
      class="platform-empty"
    >
      <Icon icon="mdi:cloud-off-outline" />
      <span>暂未配置任何平台，点击「新增平台」添加</span>
    </div>

    <!-- 平台操作栏 -->
    <div class="platform-actions">
      <button
        class="platform-btn"
        @click="addPlatform"
      >
        <Icon icon="mdi:plus" />
        新增平台
      </button>
      <button
        class="platform-btn"
        title="恢复为默认平台列表"
        @click="resetToDefault"
      >
        <Icon icon="mdi:restore" />
        恢复默认
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref, watch } from "vue"
import type { PlatformMeta } from "../../types/index"
import { DEFAULT_PLATFORM_META } from "../../types/index"

interface Props {
  visible: boolean
  platforms: PlatformMeta[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:platforms", value: PlatformMeta[]): void
  (e: "update:valid", value: boolean): void
}>()

/** 平台编辑副本（打开/首次挂载时深拷贝初始化，编辑即时回写） */
const localPlatforms = ref<PlatformMeta[]>([])

watch(() => props.visible, (v) => {
  if (v) {
    localPlatforms.value = props.platforms.map((p) => ({ ...p, matchers: [...p.matchers] }))
    validate()
  }
}, { immediate: true })

const errors = ref<Set<string>>(new Set())

/** 校验：id 非空且唯一、name 非空；结果通过 update:valid 同步父级（保存按钮禁用条件） */
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
  emit("update:valid", errs.size === 0 && localPlatforms.value.length > 0)
}

function getError(idx: number, field: string): boolean {
  if (field === "id") return errors.value.has(`${idx}:id:empty`) || errors.value.has(`${idx}:id:dup`)
  if (field === "name") return errors.value.has(`${idx}:name:empty`)
  return false
}

/** 编辑变更统一出口：校验 + 回传父级副本 */
function commit() {
  validate()
  emit("update:platforms", localPlatforms.value.map((p) => ({ ...p, matchers: [...p.matchers] })))
}

function updateMatchers(idx: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  localPlatforms.value[idx].matchers = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  commit()
}

function addPlatform() {
  localPlatforms.value.push({ id: "", matchers: [], name: "", url: "", fullCheck: true })
  commit()
}

function removePlatform(idx: number) {
  localPlatforms.value.splice(idx, 1)
  commit()
}

function toggleHidden(idx: number) {
  localPlatforms.value[idx].hidden = !localPlatforms.value[idx].hidden
  commit()
}

function toggleFullCheck(idx: number) {
  // 默认参与判定（undefined 视为 true），显式置 false 表示不参与
  localPlatforms.value[idx].fullCheck = localPlatforms.value[idx].fullCheck === false
  commit()
}

function moveUp(idx: number) {
  if (idx <= 0) return
  const arr = localPlatforms.value
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  commit()
}

function moveDown(idx: number) {
  if (idx >= localPlatforms.value.length - 1) return
  const arr = localPlatforms.value
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
  commit()
}

function resetToDefault() {
  localPlatforms.value = DEFAULT_PLATFORM_META.map((p) => ({ ...p, matchers: [...p.matchers] }))
  commit()
}
</script>

<style lang="scss" scoped>
@use "../../styles/SettingsPanel.scss";
</style>
