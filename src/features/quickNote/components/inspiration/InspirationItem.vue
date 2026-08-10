<template>
  <div class="qn-insp-item">
    <!-- 展示态 -->
    <template v-if="!editing">
      <div class="qn-insp-item__tags">
        <!-- 标签徽章 -->
        <span
          v-for="tag in item.tags"
          :key="tag"
          class="qn-insp-item__tag"
          @click="emit('filterTag', tag)"
        >#{{ tag }}</span>
      </div>
      <div class="qn-insp-item__content">{{ item.content }}</div>
      <!-- 元信息 + 操作 -->
      <div class="qn-insp-item__footer">
        <!-- 创建时间 -->
        <span class="qn-insp-item__meta">{{ i18n.createdAt }} {{ formatTime(item.createdAt) }}</span>
        <div class="qn-insp-item__actions">
          <!-- 编辑按钮 -->
          <button
            class="qn-icon-btn"
            :title="i18n.edit"
            @click="startEdit"
          >
            <IconWrapper
              name="edit"
              :size="12"
            />
          </button>
          <!-- 删除按钮 -->
          <button
            class="qn-icon-btn qn-icon-btn--danger"
            :title="i18n.delete"
            @click="emit('remove')"
          >
            <IconWrapper
              name="delete"
              :size="12"
            />
          </button>
        </div>
      </div>
    </template>

    <!-- 编辑态 -->
    <template v-else>
      <div class="qn-insp-item__edit">
        <textarea
          ref="textareaRef"
          v-model="editDraft"
          class="qn-insp-item__textarea"
          rows="2"
          :placeholder="i18n.inspContentPlaceholder"
          @keydown.ctrl.enter.prevent="confirmEdit"
          @keydown.esc="cancelEdit"
        />
        <!-- 标签输入 -->
        <input
          v-model="editTags"
          class="vp-input qn-insp-item__tag-input"
          :placeholder="i18n.tagsPlaceholder"
        />
        <div class="qn-insp-item__edit-actions">
          <!-- AI 润色按钮 -->
          <button
            class="qn-icon-btn"
            :disabled="!editDraft.trim() || polishing"
            :title="i18n.polish"
            @click="handlePolishEdit"
          >
            <IconWrapper
              name="sparkles"
              :size="12"
            />
          </button>
          <!-- 保存按钮 -->
          <button
            class="qn-icon-btn"
            :disabled="!editDraft.trim()"
            :title="i18n.save"
            @click="confirmEdit"
          >
            <IconWrapper
              name="check"
              :size="12"
            />
          </button>
          <!-- 取消按钮 -->
          <button
            class="qn-icon-btn"
            :title="i18n.cancel"
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
 * 速记功能 — 灵感单条目组件
 * 展示标签与内容；编辑态持有 plugin 自行完成 AI 润色并回填编辑框，
 * 勾选/更新/删除仅 emit 事件（存储由父 composable 统一处理）
 */
import type { Plugin } from "siyuan"
import type { InspirationItem } from "../../types"
import { nextTick, ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useAiPolish } from "../../composables/useAiPolish"
import { polishText } from "../../utils"

const props = defineProps<{
  item: InspirationItem
  plugin: Plugin
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  update: [content: string, tags: string]
  remove: []
  filterTag: [tag: string]
}>()

const editing = ref(false)
const editDraft = ref("")
const editTags = ref("")
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// AI 润色：编辑态本地实例，润色结果流式回填 editDraft（保存仍由用户触发）
const { polishing, polish } = useAiPolish(props.plugin)

// AI 润色编辑内容：缓存原稿 → 清空后流式回填 → 失败恢复原稿并提示（复用共享辅助函数）
const handlePolishEdit = async () => {
  if (polishing.value) return
  if (!editDraft.value.trim()) return
  await polishText(polish, editDraft, editDraft.value, props.i18n)
}

const startEdit = async () => {
  editDraft.value = props.item.content
  editTags.value = props.item.tags.join("、")
  editing.value = true
  await nextTick()
  textareaRef.value?.focus()
}

const confirmEdit = () => {
  if (!editDraft.value.trim()) return
  emit("update", editDraft.value, editTags.value)
  editing.value = false
}

const cancelEdit = () => {
  editing.value = false
}

/** 时间戳 → 本地化短时间文案 */
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
@use "../../styles/InspirationItem.scss";
@use "../../styles/index.scss";
</style>
