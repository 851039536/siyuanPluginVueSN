<template>
  <div class="gp-stash-wrap">
    <div class="gp-stash-header">
      <span class="gp-stash-label">STASH</span>
      <span
        class="gp-stash-help"
        title="暂存：把当前未提交的修改临时保存起来，方便切换到其他分支工作。之后可以随时'恢复'回来继续编辑，就像把工作进度先放进抽屉里一样。"
      >
        <Icon
          icon="mdi:help-circle-outline"
          height="14"
        />
      </span>
      <template v-if="isInputVisible">
        <input
          ref="inputEl"
          v-model="localMsg"
          class="gp-stash-msg-input"
          placeholder="暂存描述（可选）"
          @keyup.enter="confirm"
        />
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="AI 生成描述"
          :disabled="genDescLoading"
          @click="$emit('genStashDesc')"
        >
          <Icon
            v-if="genDescLoading"
            icon="mdi:loading"
            class="gp-spin"
            height="14"
          />
          <Icon
            v-else
            icon="mdi:auto-fix"
            height="14"
          />
        </button>
        <button
          class="vp-btn vp-btn--primary vp-btn--sm"
          :disabled="loading"
          @click="confirm"
        >
          <Icon
            icon="mdi:check"
            height="14"
          />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="cancel"
        >
          <Icon
            icon="mdi:close"
            height="14"
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
          height="13"
        />
        <Icon
          v-else
          icon="mdi:archive-outline"
          height="13"
        />
        {{ i18n.stashSave || '暂存变更' }}
      </button>
    </div>
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
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="恢复并删除 (pop)"
          :disabled="loading"
          @click="$emit('stashPop', e.index)"
        >{{ i18n.stashRestore || '恢复' }}</button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="应用但不删除 (apply)"
          :disabled="loading"
          @click="$emit('stashApply', e.index)"
        >{{ i18n.stashApply || '应用' }}</button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="删除 (drop)"
          :disabled="loading"
          @click="$emit('stashDrop', e.index)"
        >{{ i18n.stashDrop || '删除' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StashEntry } from "../types"
import { Icon } from "@iconify/vue"
import { nextTick, ref, watch } from "vue"

const props = defineProps<{
  entries: StashEntry[] | undefined
  loading: boolean
  hasChanges: boolean
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
const inputEl = ref<HTMLInputElement | null>(null)

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
watch(() => props.generatedMsg, (v) => {
  if (v) localMsg.value = v
})
</script>

<style lang="scss">
@use "../styles/index.scss";
</style>
