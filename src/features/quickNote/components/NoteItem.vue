<template>
  <div
    class="note-item"
    :class="{ 'note-item--done': note.done }"
  >
    <!-- 展示态 -->
    <template v-if="!editing">
      <!-- 完成勾选框（悬浮提示："标记完成" / "标记待完成"） -->
      <button
        class="note-item__check"
        :title="note.done ? i18n.markPending : i18n.markDone"
        @click="emit('toggleDone')"
      >
        <IconWrapper
          :name="note.done ? 'check' : 'circleOutline'"
          :size="14"
        />
      </button>

      <div class="note-item__body">
        <!-- 多行内容 -->
        <div class="note-item__content">{{ note.content }}</div>
        <!-- 元信息："创建于 xxxx" -->
        <div class="note-item__meta">
          {{ i18n.createdAt }} {{ formatTime(note.createdAt) }}
        </div>
      </div>

      <div class="note-item__actions">
        <!-- 编辑按钮 -->
        <button
          class="note-item__action-btn"
          @click="startEdit"
        >
          <IconWrapper
            name="edit"
            :size="12"
          />
        </button>
        <!-- 删除按钮 -->
        <button
          class="note-item__action-btn note-item__action-btn--danger"
          @click="emit('remove')"
        >
          <IconWrapper
            name="delete"
            :size="12"
          />
        </button>
      </div>
    </template>

    <!-- 编辑态 -->
    <template v-else>
      <div class="note-item__edit">
        <textarea
          ref="editTextareaRef"
          v-model="editDraft"
          class="note-item__edit-textarea"
          rows="3"
          @keydown.ctrl.enter.prevent="confirmEdit"
          @keydown.esc="cancelEdit"
        />
        <div class="note-item__edit-actions">
          <!-- 按钮："保存"（common i18n 由父层透传） -->
          <button
            class="note-item__action-btn"
            :disabled="!editDraft.trim()"
            @click="confirmEdit"
          >
            <IconWrapper
              name="check"
              :size="12"
            />
          </button>
          <!-- 按钮："取消" -->
          <button
            class="note-item__action-btn"
            @click="cancelEdit"
          >
            <IconWrapper
              name="close"
              :size="12"
            />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记 — 单条目组件
 * 纯展示组件：勾选/编辑/删除仅 emit 事件，存储由父组件的 composable 统一处理
 */
import type { QuickNoteItem } from "../types"
import { nextTick, ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  note: QuickNoteItem
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  toggleDone: []
  update: [content: string]
  remove: []
}>()

const editing = ref(false)
const editDraft = ref("")
const editTextareaRef = ref<HTMLTextAreaElement | null>(null)

const startEdit = async () => {
  editDraft.value = props.note.content
  editing.value = true
  await nextTick()
  editTextareaRef.value?.focus()
}

const confirmEdit = () => {
  if (!editDraft.value.trim()) return
  emit("update", editDraft.value)
  editing.value = false
}

const cancelEdit = () => {
  editing.value = false
}

/** 时间戳 → 本地化短时间文案（元信息展示） */
const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
</script>

<style scoped lang="scss">
@use "../styles/NoteItem.scss";
@use "../styles/index.scss";
</style>
