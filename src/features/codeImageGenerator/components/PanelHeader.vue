<template>
  <div class="panel-header">
    <div class="panel-title">
      <IconWrapper name="codeImageGenerator" :size="20" class="panel-icon" />
      <span>{{ title }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue";

interface Props {
	title: string;
}

defineProps<Props>();
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
