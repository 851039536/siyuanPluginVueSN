<!-- 面板容器：仅作结构承载，面板本体见 TabPanel -->
<template>
  <div class="si-tabpanels">
    <slot />
  </div>
</template>

<script setup lang="ts">
// 引入组件库默认主题（自包含迁移，详见 kit/README.md）
import "./kit/theme"
</script>

<style scoped lang="scss">
@use './styles/TabPanels.scss';
</style>
