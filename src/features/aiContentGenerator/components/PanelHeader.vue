<template>
  <div class="panel-header">
    <div class="header-title">
      <span>{{ title }}</span>
    </div>
    <div class="header-actions">
      <!-- 设置按钮 -->
      <Button variant="ghost" size="small" @click="$emit('toggle-settings')" :title="'对话设置'">
        <svg width="18" height="16" viewBox="0 0 24 24">
          <use xlink:href="#iconSettings"></use>
        </svg>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";

interface Props {
	title?: string;
}

withDefaults(defineProps<Props>(), {
	title: "信息生成",
});

defineEmits<{
	(e: "toggle-settings"): void;
}>();
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
