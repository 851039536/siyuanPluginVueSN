<!-- 纯 CSS 动画加载指示器（飞船 + 长光带），自带定位容器，供各功能加载态复用 -->
<template>
  <div
    class="loader-root"
    role="status"
    aria-label="加载中"
  >
    <div class="loader">
      <span class="thruster">
        <span class="thruster-ray"></span>
        <span class="thruster-ray"></span>
        <span class="thruster-ray"></span>
        <span class="thruster-ray"></span>
      </span>
      <div class="base">
        <span></span>
        <div class="face"></div>
      </div>
    </div>
    <div
      class="longfazers"
      aria-hidden="true"
    >
      <span></span><span></span><span></span><span></span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './styles/Loader.scss';
</style>
