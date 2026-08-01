<!-- Git Stash 储藏管理区 -->
<template>
  <div class="gp-stash-wrap">
    <!-- 暂存操作头部：帮助图标 + 描述输入态/暂存按钮态切换 -->
    <div class="gp-stash-header">
      <!-- 悬停提示："暂存：把当前未提交的修改临时保存起来……" -->
      <span
        class="gp-stash-help"
        :title="i18n.stashHelp"
      >
        <Icon
          icon="mdi:help-circle-outline"
          height="12"
        />
      </span>
      <template v-if="isInputVisible">
        <!-- 占位符："暂存描述（可选）" -->
        <Input
          ref="inputEl"
          v-model="localMsg"
          size="xsmall"
          :placeholder="i18n.stashMsgPlaceholder"
          class="gp-stash-input"
          @keydown.enter="confirm"
        />
        <!-- 悬停提示："AI 生成描述" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.stashGenDesc"
          :disabled="genDescLoading"
          @click="$emit('genStashDesc')"
        >
          <Icon
            v-if="genDescLoading"
            icon="mdi:loading"
            class="gp-spin"
            height="12"
          />
          <Icon
            v-else
            icon="mdi:auto-fix"
            height="12"
          />
        </button>
        <button
          class="vp-btn vp-btn--primary vp-btn--sm"
          :disabled="loading"
          @click="confirm"
        >
          <Icon
            icon="mdi:check"
            height="12"
          />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="cancel"
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
        :disabled="!hasChanges || loading"
        @click="showInput"
      >
        <Icon
          v-if="loading"
          icon="mdi:loading"
          class="gp-spin"
          height="12"
        />
        <Icon
          v-else
          icon="mdi:archive-outline"
          height="12"
        />
        <!-- 按钮文案："暂存变更" -->
        {{ i18n.stashSave }}
      </button>
    </div>
    <!-- 储藏条目列表 -->
    <div
      v-if="entries?.length"
      class="gp-stash-list"
    >
      <div
        v-for="e in entries"
        :key="e.index"
        class="gp-stash-row"
      >
        <span class="gp-stash-index">stash@{{ '{' + e.index + '}' }}</span>
        <span
          class="gp-stash-msg"
          :title="e.message"
        >{{ e.message }}</span>
        <!-- 悬停提示："恢复并删除 (pop)"，按钮文案："恢复" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.stashPopHint"
          :disabled="loading"
          @click="$emit('stashPop', e.index)"
        >{{ i18n.stashRestore }}</button>
        <!-- 悬停提示："应用但不删除 (apply)"，按钮文案："应用" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.stashApplyHint"
          :disabled="loading"
          @click="$emit('stashApply', e.index)"
        >{{ i18n.stashApply }}</button>
        <!-- 悬停提示："删除 (drop)"，按钮文案："删除" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.stashDropHint"
          :disabled="loading"
          @click="$emit('stashDrop', e.index)"
        >{{ i18n.stashDrop }}</button>
      </div>
    </div>
    <!-- 待暂存的变更预览（stash 含未跟踪文件，故展示工作区全部变更） -->
    <div
      v-if="tree?.files?.length"
      class="gp-stash-pending"
    >
      <!-- 区块标题："待暂存的变更" -->
      <div class="gp-stash-pending-title">{{ i18n.stashPendingChanges }}</div>
      <div class="gp-stash-pending-list">
        <div
          v-for="f in tree.files"
          :key="`${f.staged ? 's' : 'u'}::${f.path}`"
          class="gp-stash-pending-row"
        >
          <!-- 状态标记（着色与 CHANGES 页签一致，复用 .wt-file-status） -->
          <span
            class="wt-file-status"
            :class="`wt-s-${f.status}`"
            :title="fileStatusTitle(f)"
          >
            <IconWrapper
              v-if="isIconFileStatus(f)"
              :name="fileStatusIconKey(f)"
              :size="12"
            />
            <template v-else>
              {{ fileStatusIcon(f) }}
            </template>
          </span>
          <span
            class="gp-stash-pending-path"
            :title="f.path"
          >{{ f.path }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StashEntry, WorkingTreeInfo } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, nextTick, ref, toRef } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { fileStatusIcon, fileStatusIconKey, fileStatusTitle, isIconFileStatus } from "../../utils"
import { useGeneratedMsgSync } from "../../composables/useGeneratedMsgSync"

const props = defineProps<{
  entries: StashEntry[] | undefined
  loading: boolean
  tree: WorkingTreeInfo | undefined
  genDescLoading: boolean
  generatedMsg: string
  i18n: Record<string, any>
}>()

const emit = defineEmits<{
  stashConfirm: [msg: string]
  genStashDesc: []
  stashPop: [index: number]
  stashApply: [index: number]
  stashDrop: [index: number]
}>()

const isInputVisible = ref(false)
const localMsg = ref("")
const inputEl = ref<InstanceType<typeof Input>>()

/** 工作区是否有可暂存的变更（控制"暂存变更"按钮可用性） */
const hasChanges = computed(() => !!props.tree?.hasChanges)

function showInput() {
  isInputVisible.value = true
  localMsg.value = ""
  nextTick(() => { inputEl.value?.focus() })
}

function cancel() {
  isInputVisible.value = false
  localMsg.value = ""
}

function confirm() {
  const msg = localMsg.value.trim()
  const ts = new Date().toLocaleString()
  emit("stashConfirm", msg ? `${ts} - ${msg}` : ts)
  isInputVisible.value = false
  localMsg.value = ""
}

// 当父组件通过 genStashDesc 生成描述后，自动填入输入框
useGeneratedMsgSync(toRef(props, "generatedMsg"), localMsg)
</script>

<style lang="scss">
@use "../../styles/index.scss";
</style>
