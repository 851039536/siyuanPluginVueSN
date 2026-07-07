<!-- Git Tag 标签管理面板 -->
<template>
  <div class="gp-tag-panel">
    <div class="gp-tag-header">
      <span class="gp-tag-label">TAG</span>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm gp-tag-refresh-btn"
        :disabled="loading"
        title="刷新标签"
        @click="$emit('refresh')"
      >
        <Icon icon="mdi:refresh" height="12" :class="{ 'gp-spin': loading }" />
      </button>
      <template v-if="addingTag">
        <Input
          v-model="newTagName"
          size="xsmall"
          placeholder="Tag 名称（如 v1.2.0）"
          @keydown="$event.key === 'Enter' && handleCreate()"
          @keydown.escape="addingTag = false"
        />
        <Input
          v-model="newTagMsg"
          size="xsmall"
          placeholder="注解（可选）"
          @keydown="$event.key === 'Enter' && handleCreate()"
        />
        <button
          class="vp-btn vp-btn--primary vp-btn--sm"
          :disabled="!newTagName.trim() || loading"
          @click="handleCreate"
        >
          <Icon
            icon="mdi:check"
            height="12"
          />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="addingTag = false"
        >
          <Icon
            icon="mdi:close"
            height="12"
          />
        </button>
      </template>
      <button
        v-else
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :disabled="loading"
        @click="startAdd"
      >
        <Icon
          icon="mdi:tag-plus-outline"
          height="12"
        />
        <span>{{ i18n.createTag || '打 Tag' }}</span>
      </button>
    </div>
    <div
      v-if="tags.length"
      class="gp-tag-list"
    >
      <div
        v-for="t in tags"
        :key="t.name"
        class="gp-tag-row"
      >
        <span
          class="gp-tag-name"
          :title="t.message"
        >{{ t.name }}</span>
        <span
          v-if="t.message"
          class="gp-tag-msg"
        >{{ t.message }}</span>
        <span
          v-if="t.date"
          class="gp-tag-date"
        >{{ t.date?.slice(0, 10) }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-tag-push-btn"
          title="推送"
          :disabled="pushLoaded === t.name"
          @click="emit('push', { tag: t.name })"
        >
          <Icon
            v-if="pushLoaded === t.name"
            icon="mdi:loading"
            class="gp-spin"
            height="12"
          />
          <template v-else>推送</template>
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
          title="删除"
          :disabled="loading"
          @click="emit('delete', { tag: t.name })"
        >
          <Icon
            icon="mdi:delete-outline"
            height="12"
          />
        </button>
      </div>
    </div>
    <div
      v-else-if="!loading"
      class="gp-tag-empty"
    >
      <Icon
        icon="mdi:tag-off-outline"
        height="12"
      />
      <span>{{ i18n.noTags || '暂无 Tag' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TagInfo } from "../types"
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import Input from "@/components/Input.vue"

const props = defineProps<{
  tags: TagInfo[]
  loading?: boolean
  pushLoaded?: string
  remotes: { key: string, icon: string }[]
  i18n: Record<string, any>
}>()

const emit = defineEmits<{
  create: [payload: { name: string, message?: string }]
  push: [payload: { tag: string }]
  delete: [payload: { tag: string }]
  refresh: []
}>()

const addingTag = ref(false)
const newTagName = ref("")
const newTagMsg = ref("")

function startAdd() {
  addingTag.value = true
  newTagName.value = ""
  newTagMsg.value = ""
}

function handleCreate() {
  const name = newTagName.value.trim()
  if (!name) return
  emit("create", {
    name,
    message: newTagMsg.value.trim() || undefined,
  })
  addingTag.value = false
}
</script>
