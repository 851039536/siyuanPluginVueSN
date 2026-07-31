<template>
  <div class="quick-note-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <!-- 弹窗标题："速记" -->
      <h3 class="panel-title">
        <IconWrapper
          name="quickNote"
          :size="16"
          class="panel-title__icon"
        />
        {{ i18n.title }}
      </h3>
      <div class="header-actions">
        <!-- 位置选择器（标签："显示位置"，选项："居中/顶部/底部/左侧/右侧"） -->
        <SiSelect
          :model-value="position"
          :options="positionOptions"
          size="small"
          class="position-select"
          @update:model-value="(val) => handlePositionChange(val as QuickNotePosition)"
        />
        <button
          class="close-btn"
          @click="props.onClose?.()"
        >
          <IconWrapper
            name="close"
            :size="14"
          />
        </button>
      </div>
    </div>

    <!-- 新增速记区 -->
    <div class="add-area">
      <!-- 输入框占位："输入速记内容，Ctrl+Enter 快速添加" -->
      <textarea
        v-model="draft"
        class="add-textarea"
        :placeholder="i18n.addPlaceholder"
        rows="3"
        @keydown.ctrl.enter.prevent="handleAdd"
      />
      <!-- 按钮："添加" -->
      <SiButton
        size="small"
        :disabled="!draft.trim()"
        @click="handleAdd"
      >
        <IconWrapper
          name="plus"
          :size="12"
        />
        {{ i18n.add }}
      </SiButton>
    </div>

    <!-- 待完成/已完成 Tab 切换栏 -->
    <div class="filter-tabs">
      <!-- Tab："待完成"（含计数） -->
      <button
        class="filter-tab"
        :class="{ 'filter-tab--active': filter === 'pending' }"
        @click="filter = 'pending'"
      >
        {{ i18n.pending }}
        <span class="filter-tab__count">{{ pendingCount }}</span>
      </button>
      <!-- Tab："已完成"（含计数） -->
      <button
        class="filter-tab"
        :class="{ 'filter-tab--active': filter === 'done' }"
        @click="filter = 'done'"
      >
        {{ i18n.done }}
        <span class="filter-tab__count">{{ doneCount }}</span>
      </button>
    </div>

    <!-- 速记条目列表 -->
    <div class="note-list">
      <!-- 空态提示："暂无待完成速记" / "暂无已完成速记" -->
      <div
        v-if="filteredNotes.length === 0"
        class="note-list__empty"
      >
        {{ filter === "pending" ? i18n.emptyPending : i18n.emptyDone }}
      </div>
      <NoteItem
        v-for="note in filteredNotes"
        :key="note.id"
        :note="note"
        :i18n="i18n"
        @toggle-done="toggleDone(note.id)"
        @update="(content: string) => update(note.id, content)"
        @remove="handleRemove(note.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记 — 弹窗主面板
 * 自包含数据流：onMounted 从 manager.storage 加载条目，CRUD 经 useQuickNotes 直达存储；
 * 位置变更直接调 manager.setPosition，父层（Manager）不维护任何表单中间状态
 */
import type { Plugin } from "siyuan"
import type { SelectOption } from "@/components/Select.vue"
import type { QuickNoteManager } from "./index"
import type { QuickNotePosition } from "./types"
import { computed, onMounted, ref } from "vue"
import SiButton from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import SiSelect from "@/components/Select.vue"
import NoteItem from "./components/NoteItem.vue"
import { useQuickNotes } from "./composables/useQuickNotes"
import { QUICK_NOTE_POSITIONS } from "./types"

const props = defineProps<{
  plugin: Plugin
  i18n: Record<string, string>
  manager: QuickNoteManager
  onClose?: () => void
}>()

const {
  filter,
  filteredNotes,
  pendingCount,
  doneCount,
  load,
  add,
  update,
  toggleDone,
  remove,
} = useQuickNotes(props.manager.storage)

// 新增输入草稿（persistent Modal 下关闭再打开不丢失）
const draft = ref("")

// 位置选择器（选中值初始化自 Manager 缓存）
const position = ref<QuickNotePosition>(props.manager.getPosition())

// 位置键 → i18n 显示键（positionCenter / positionTop / ...）
const positionOptions = computed<SelectOption[]>(() =>
  QUICK_NOTE_POSITIONS.map((p) => ({
    value: p,
    label: props.i18n[`position${p.charAt(0).toUpperCase()}${p.slice(1)}`],
  })),
)

const handleAdd = async () => {
  if (!draft.value.trim()) return
  await add(draft.value)
  draft.value = ""
}

const handlePositionChange = (pos: QuickNotePosition) => {
  position.value = pos
  props.manager.setPosition(pos)
}

const handleRemove = (id: string) => {
  // 删除确认："确定删除这条速记吗？"
  if (!window.confirm(props.i18n.deleteConfirm)) return
  remove(id)
}

onMounted(() => {
  load()
  position.value = props.manager.getPosition()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
