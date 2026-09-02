<!-- Git Tag 标签管理面板 -->
<template>
  <div class="gp-tag-panel">
    <div class="gp-tag-header">
      <!-- 刷新按钮提示：“刷新标签” -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm gp-tag-refresh-btn"
        :disabled="loading"
        :title="i18n.refreshTags"
        @click="$emit('refresh')"
      >
        <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" height="12" :class="{ 'gp-spin': loading }" />
      </button>
      <template v-if="addingTag">
        <!-- Tag 名称输入：占位符“Tag 名称（如 v1.2.0）” -->
        <Input
          v-model="newTagName"
          size="xsmall"
          :placeholder="i18n.tagNamePlaceholder"
          @keydown.enter="handleCreate()"
          @keydown.escape="addingTag = false"
        />
        <!-- Tag 注解输入：占位符“注解（可选）” -->
        <Input
          v-model="newTagMsg"
          size="xsmall"
          :placeholder="i18n.tagMsgPlaceholder"
          @keydown.enter="handleCreate()"
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
        <span>{{ i18n.createTag }}</span>
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
        >{{ t.date.slice(0, 10) }}</span>
        <!-- 推送按钮：文案/提示"推送"，推送中显示旋转图标；多远程时展开远程选择 -->
        <template v-if="pushingTag === t.name">
          <!-- 指定远程：只推该远程 -->
          <button
            v-for="r in remotes"
            :key="r"
            class="vp-btn vp-btn--ghost vp-btn--sm gp-tag-push-btn"
            :title="`${i18n.push}: ${r}`"
            @click="handlePushRemote(t.name, r)"
          >
            {{ r }}
          </button>
          <!-- 全部远程：推所有已配置远程 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-tag-push-btn"
            :title="i18n.pushAllRemotes"
            @click="handlePushRemote(t.name)"
          >
            {{ i18n.pushAllRemotes }}
          </button>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.cancel"
            @click="pushingTag = null"
          >
            <Icon
              icon="mdi:close"
              height="12"
            />
          </button>
        </template>
        <button
          v-else
          class="vp-btn vp-btn--ghost vp-btn--sm gp-tag-push-btn"
          :title="i18n.push"
          :disabled="pushLoaded === t.name"
          @click="handlePushClick(t.name)"
        >
          <Icon
            v-if="pushLoaded === t.name"
            icon="mdi:loading"
            class="gp-spin"
            height="12"
          />
          <template v-else>
            {{ i18n.push }}
          </template>
        </button>
        <!-- 删除按钮提示：“删除”（展开远程选择时隐藏，避免行内拥挤） -->
        <button
          v-if="pushingTag !== t.name"
          class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
          :title="i18n.delete"
          :disabled="loading"
          @click="emit('delete', t.name)"
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
      <span>{{ i18n.noTags }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TagInfo } from "../../types"
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import Input from "@/components/Input.vue"

const props = defineProps<{
  tags: TagInfo[]
  loading?: boolean
  pushLoaded?: string
  /** 已配置远程名列表；多于 1 个时推送按钮展开远程选择 */
  remotes?: string[]
  i18n: Record<string, any>
}>()

const emit = defineEmits<{
  create: [name: string, message?: string]
  push: [tag: string, remote?: string]
  delete: [tag: string]
  refresh: []
}>()

const addingTag = ref(false)
const newTagName = ref("")
const newTagMsg = ref("")
/** 当前展开远程选择的 tag 行（null = 未展开） */
const pushingTag = ref<string | null>(null)

function startAdd() {
  addingTag.value = true
  newTagName.value = ""
  newTagMsg.value = ""
}

function handleCreate() {
  const name = newTagName.value.trim()
  if (!name) return
  emit("create", name, newTagMsg.value.trim() || undefined)
  addingTag.value = false
}

/** 点击推送：单远程直接推送，多远程展开远程选择 */
function handlePushClick(tag: string) {
  if (props.remotes && props.remotes.length > 1) {
    pushingTag.value = tag
    return
  }
  emit("push", tag)
}

/** 选择远程后推送（remote 为空 = 全部远程）并收起选择 */
function handlePushRemote(tag: string, remote?: string) {
  emit("push", tag, remote)
  pushingTag.value = null
}
</script>
