<template>
  <div
    class="gp-mask"
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
          <Icon icon="mdi:close" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div class="gp-set-row">
          <label class="gp-set-label">Git 并发数</label>
          <div class="gp-set-input-row">
            <input
              v-model.number="localConcurrency"
              type="number"
              class="gp-input"
              min="1"
              max="10"
              style="width: 50px; text-align: center;"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              @click="$emit('save', localConcurrency); $emit('close')"
            >
              保存
            </button>
          </div>
        </div>
        <div class="gp-set-hint">
          同时执行的 git 子进程数上限（1~10）
        </div>
        <div class="gp-set-row" style="margin-top: 12px;">
          <label class="gp-set-label">推送分支模式</label>
          <div class="gp-set-radio-group">
            <label class="gp-set-radio">
              <input
                v-model="localBranchMode"
                type="radio"
                value="all"
                @change="$emit('saveBranchMode', 'all')"
              />
              <span>全部分支 (--all)</span>
            </label>
            <label class="gp-set-radio">
              <input
                v-model="localBranchMode"
                type="radio"
                value="head"
                @change="$emit('saveBranchMode', 'head')"
              />
              <span>仅当前分支 (HEAD)</span>
            </label>
          </div>
        </div>
        <div class="gp-set-hint">
          "仅当前分支"模式更快，避免推送无变更的其他分支
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref } from "vue"

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
</script>
