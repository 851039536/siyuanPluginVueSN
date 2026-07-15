<!-- 空状态引导：三步操作说明 -->
<template>
  <div class="empty-state">
    <svg
      width="48"
      height="48"
      class="empty-icon"
    >
      <use xlink:href="#iconSparkles"></use>
    </svg>
    <p class="empty-title">
      AI 内容编辑助手
    </p>
    <div class="empty-steps">
      <div class="empty-step">
        <span class="step-num">1</span>
        <span>点击下方「选择文档」或「选择块」</span>
      </div>
      <div class="empty-step">
        <span class="step-num">2</span>
        <span>选择 AI 快捷操作或输入自定义指令</span>
      </div>
      <div class="empty-step">
        <span class="step-num">3</span>
        <span>预览结果后应用到文档</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/ContentAreaEmpty.scss" as *;
@use "../styles/index.scss" as *;
</style>
