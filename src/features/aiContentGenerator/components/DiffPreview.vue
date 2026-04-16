<template>
  <div class="diff-preview">
    <div class="diff-toolbar">
      <div class="diff-toolbar-left">
        <span class="diff-toolbar-title">Diff 对比</span>
        <span class="diff-stats">
          <span class="stat-added">+{{ addCount }}</span>
          <span class="stat-removed">-{{ removeCount }}</span>
        </span>
      </div>
      <div class="diff-toolbar-right">
        <div class="diff-mode-toggle">
          <button
            :class="['mode-btn', { active: diffMode === 'unified' }]"
            @click="diffMode = 'unified'"
            title="合并视图"
          >
            合并
          </button>
          <button
            :class="['mode-btn', { active: diffMode === 'split' }]"
            @click="diffMode = 'split'"
            title="分栏视图"
          >
            分栏
          </button>
        </div>
      </div>
    </div>
    <div class="diff-viewer-wrapper">
      <Diff
        class="diff-viewer"
        :mode="diffMode"
        theme="light"
        language="plaintext"
        :prev="originalContent"
        :current="newContent"
        :folding="false"
        :virtual-scroll="false"
        :render-added="true"
        :render-removed="true"
        :hide-line-numbers="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Diff } from "vue-diff";
import "vue-diff/dist/index.css";
import DiffMatchPatch from "diff-match-patch";

interface Props {
  originalContent: string;
  newContent: string;
}

const props = defineProps<Props>();

const diffMode = ref<"split" | "unified">("unified");

const dmp = new DiffMatchPatch();

const diffStats = computed(() => {
  const diffs = dmp.diff_main(props.originalContent, props.newContent);
  let addCount = 0;
  let removeCount = 0;
  for (const [op, text] of diffs) {
    if (op === 1) addCount += text.length;
    if (op === -1) removeCount += text.length;
  }
  return { addCount, removeCount };
});

const addCount = computed(() => diffStats.value.addCount);
const removeCount = computed(() => diffStats.value.removeCount);
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
