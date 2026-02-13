<template>
  <div class="plagiarism-result-panel">
    <div class="result-header">
      <div class="section-title-wrapper">
        <svg width="16" height="16"><use xlink:href="#iconSearch"></use></svg>
        <span>{{ 'AI查重结果' }}</span>
        <Button
          :class="['btn-collapse', { 'collapsed': collapsed }]"
          @click="$emit('toggle-collapse')"
          :title="collapsed ? '展开结果' : '折叠结果'"
          variant="ghost"
          size="small"
        >
          <svg width="14" height="14" class="collapse-icon">
            <use :xlink:href="collapsed ? '#iconRight' : '#iconDown'"></use>
          </svg>
        </Button>
      </div>
      <Button @click="$emit('close')" variant="ghost" size="small">
        <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
      </Button>
    </div>
    <div class="result-content" :class="{ 'collapsed': collapsed }">
      <div class="plagiarism-summary">
        <div class="summary-item" :class="riskLevelClass">
          <span class="summary-label">{{ '风险等级' }}:</span>
          <span class="summary-value">{{ riskLevelText }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">{{ '相似度' }}:</span>
          <span class="summary-value">{{ plagiarismResult.similarityRate }}%</span>
        </div>
      </div>
      <div class="plagiarism-details">
        <div class="detail-text markdown-preview selectable-content" v-html="renderedHtml"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from '@/components/Button.vue';

interface PlagiarismResult {
  riskLevel: string;
  similarityRate: number;
  details: string;
}

const props = defineProps<{
  plagiarismResult: PlagiarismResult;
  collapsed: boolean;
  renderedHtml: string;
}>();

defineEmits<{
  'toggle-collapse': [];
  'close': [];
}>();

const riskLevelClass = computed(() => {
  const level = props.plagiarismResult.riskLevel;
  return level === 'low' ? 'low-risk' : level === 'medium' ? 'medium-risk' : 'high-risk';
});

const riskLevelText = computed(() => {
  const level = props.plagiarismResult.riskLevel;
  const riskLevelMap: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险'
  };
  return riskLevelMap[level] || level;
});
</script>

<style scoped lang="scss">
@use "../index.scss";
</style>
