<!-- 输入框组合器附加项：承载前缀/后缀文本或图标，档位外观由 InputGroup 的 --ig-addon-* 变量继承驱动（也可单独使用） -->
<template>
  <div class="si-input-group-addon">
    <slot />
  </div>
</template>

<script setup lang="ts">
// 引入组件库默认主题（自包含迁移，详见 kit/README.md）
import "./kit/theme"
</script>

<style scoped lang="scss">
@use './styles/InputGroupAddon.scss';
</style>
