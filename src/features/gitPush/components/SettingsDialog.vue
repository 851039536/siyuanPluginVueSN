<!-- gitPush 设置弹窗 -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 300px;"
    >
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">{{ i18n.settings || '设置' }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div class="gp-set-row">
          <label class="gp-set-label">{{ i18n.gitConcurrency || 'Git 并发数' }}</label>
          <div class="gp-set-input-row">
            <Input
              :model-value="localConcurrency"
              type="number"
              size="xsmall"
              style="width: 70px;"
              @update:model-value="localConcurrency = Number($event) || 1"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              @click="$emit('save', localConcurrency); $emit('close')"
            >
              {{ i18n.save || '保存' }}
            </button>
          </div>
        </div>
        <div class="gp-set-hint">
          {{ i18n.concurrencyHint || '同时执行的 git 子进程数上限（1~10）' }}
        </div>
        <div class="gp-set-row" style="margin-top: 12px;">
          <label class="gp-set-label">{{ i18n.pushBranchModeLabel || '推送分支模式' }}</label>
          <div class="gp-set-radio-group">
            <label class="gp-set-radio">
              <input
                v-model="localBranchMode"
                type="radio"
                value="all"
                @change="$emit('saveBranchMode', 'all')"
              />
              <span>{{ i18n.pushBranchAllOpt || '全部分支 (--all)' }}</span>
            </label>
            <label class="gp-set-radio">
              <input
                v-model="localBranchMode"
                type="radio"
                value="head"
                @change="$emit('saveBranchMode', 'head')"
              />
              <span>{{ i18n.pushBranchHeadOpt || '仅当前分支 (HEAD)' }}</span>
            </label>
          </div>
        </div>
        <div class="gp-set-hint">
          {{ i18n.pushBranchHint || '“仅当前分支”模式更快，避免推送无变更的其他分支' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import Input from "@/components/Input.vue"
import { useDialogKeyboard } from "../composables/useDialogKeyboard"

const props = defineProps<{
  i18n: Record<string, any>
  concurrency: number
  pushBranchMode: "all" | "head"
}>()

const emit = defineEmits<{
  close: []
  save: [value: number]
  saveBranchMode: [mode: "all" | "head"]
}>()

const localConcurrency = ref(props.concurrency)
const localBranchMode = ref<"all" | "head">(props.pushBranchMode)
const { rootRef } = useDialogKeyboard()
</script>
