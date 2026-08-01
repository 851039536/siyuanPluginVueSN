<!-- gitPush 设置弹窗：Git 并发数 + 推送分支模式 -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @keydown.enter="saveAndClose"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-dialog--settings">
      <!-- 弹窗头部 -->
      <div class="gp-dialog-header">
        <!-- 弹窗标题："设置" -->
        <span class="gp-dialog-title">{{ i18n.settings }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <!-- 并发数设置行 -->
        <div class="gp-set-row">
          <!-- 设置项标签："Git 并发数" -->
          <label class="gp-set-label">{{ i18n.gitConcurrency }}</label>
          <div class="gp-set-input-row">
            <Input
              :model-value="localConcurrency"
              type="number"
              size="xsmall"
              class="gp-set-concurrency-input"
              @update:model-value="localConcurrency = clampGitConcurrency(Number($event))"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              @click="saveAndClose"
            >
              <!-- 按钮文案："保存" -->
              {{ i18n.save }}
            </button>
          </div>
        </div>
        <!-- 提示文案："同时执行的 git 子进程数上限（1~10）" -->
        <div class="gp-set-hint">
          {{ i18n.concurrencyHint }}
        </div>
        <!-- 推送分支模式设置行 -->
        <div class="gp-set-row gp-set-row--spaced">
          <!-- 设置项标签："推送分支模式" -->
          <label class="gp-set-label">{{ i18n.pushBranchModeLabel }}</label>
          <div class="gp-set-radio-group">
            <label class="gp-set-radio">
              <input
                v-model="localBranchMode"
                type="radio"
                value="all"
              />
              <!-- 选项文案："全部分支 (--all)" -->
              <span>{{ i18n.pushBranchAllOpt }}</span>
            </label>
            <label class="gp-set-radio">
              <input
                v-model="localBranchMode"
                type="radio"
                value="head"
              />
              <!-- 选项文案："仅当前分支 (HEAD)" -->
              <span>{{ i18n.pushBranchHeadOpt }}</span>
            </label>
          </div>
        </div>
        <!-- 提示文案："仅当前分支模式更快，避免推送无变更的其他分支" -->
        <div class="gp-set-hint">
          {{ i18n.pushBranchHint }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref, watch } from "vue"
import Input from "@/components/Input.vue"
import { clampGitConcurrency } from "../../types"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"

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

const localConcurrency = ref(clampGitConcurrency(props.concurrency))
const localBranchMode = ref<"all" | "head">(props.pushBranchMode)
const { rootRef } = useDialogKeyboard()

// 分支模式即时保存（radio 切换立即持久化，无需保存按钮）
watch(localBranchMode, (mode) => emit("saveBranchMode", mode))

/** 保存并发数并关闭弹窗（保存按钮 / Enter 键共用） */
function saveAndClose() {
  emit("save", localConcurrency.value)
  emit("close")
}
</script>
