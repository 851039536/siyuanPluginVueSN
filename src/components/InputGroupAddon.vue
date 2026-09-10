<!-- 输入框组合器附加项：承载前缀/后缀文本或图标，档位外观由 InputGroup 的 --ig-addon-* 变量继承驱动（也可单独使用） -->
<template>
  <div class="si-input-group-addon">
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use './styles/InputGroupAddon.scss';
</style>
