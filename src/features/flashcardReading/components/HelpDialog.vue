<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('close')">
    <div class="dialog help-dialog" @click.stop>
      <div class="dialog-header">
        <h4>{{ i18n.usageGuide || '使用说明' }}</h4>
        <Button variant="ghost" size="small" icon="close" @click="$emit('close')" />
      </div>
      <div class="dialog-body help-body">
        <div class="help-section">
          <h5>{{ i18n.helpOverview || '功能概述' }}</h5>
          <p>{{ i18n.helpOverviewDesc || '闪卡式单词阅读工具，支持分类管理、发音播放和练习统计。' }}</p>
        </div>
        <div class="help-section">
          <h5>{{ i18n.helpCardManagement || '卡片管理' }}</h5>
          <ul>
            <li>{{ i18n.helpAddCard || '添加卡片：点击右上角 + 按钮，输入标题、内容和类别' }}</li>
            <li>{{ i18n.helpEditCard || '编辑卡片：点击卡片上的编辑按钮' }}</li>
            <li>{{ i18n.helpDeleteCard || '删除卡片：点击卡片上的删除按钮' }}</li>
            <li>{{ i18n.helpCardCategory || '类别管理：支持预设类别和自定义类别' }}</li>
          </ul>
        </div>
        <div class="help-section">
          <h5>{{ i18n.helpViewModes || '视图模式' }}</h5>
          <ul>
            <li>{{ i18n.helpListView || '列表视图：双列网格显示所有卡片，支持分页' }}</li>
            <li>{{ i18n.helpSingleView || '单卡视图：大卡片显示，支持上下翻页和随机切换' }}</li>
            <li>{{ i18n.helpStatisticsView || '统计视图：展示练习数据和排行榜' }}</li>
          </ul>
        </div>
        <div class="help-section">
          <h5>{{ i18n.helpPractice || '练习功能' }}</h5>
          <ul>
            <li>{{ i18n.helpPronunciation || '发音播放：点击播放按钮使用 Web Speech API 播放发音' }}</li>
            <li>{{ i18n.helpAutoPlay || '自动播放：单卡模式下切换卡片时自动播放发音' }}</li>
            <li>{{ i18n.helpPracticeCount || '练习统计：每次播放后自动记录练习次数' }}</li>
          </ul>
        </div>
        <div class="help-section">
          <h5>{{ i18n.helpSearch || '搜索和筛选' }}</h5>
          <ul>
            <li>{{ i18n.helpCategoryFilter || '类别筛选：下拉选择特定类别查看' }}</li>
            <li>{{ i18n.helpSearchKeyword || '关键词搜索：搜索标题和内容' }}</li>
          </ul>
        </div>
      </div>
      <div class="dialog-footer">
        <Button variant="primary" @click="$emit('close')">
          {{ i18n.close || '关闭' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import type { I18n } from "../types";

defineProps<{
	visible: boolean;
	i18n: I18n;
}>();

defineEmits<{
	close: [];
}>();
</script>
