<!-- 文档分析功能 - 设置弹窗名称排除分区（重名文档名称排除） -->
<template>
  <section class="settings-section">
    <p class="settings-hint">每行一个文档名称，包含该名称的文档将从重名统计中排除（不区分大小写）</p>
    <textarea
      :value="text"
      class="settings-textarea"
      rows="3"
      placeholder="输入要排除的名称，每行一个..."
      @input="handleInput"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

/** 排除名称（v-model:names，编辑即时转换回写副本） */
const names = defineModel<string[]>("names", { required: true })

/** 文本形式（每行一个名称），打开/首次挂载时初始化，编辑时即时转换回写副本 */
const text = ref("")

watch(() => props.visible, (v) => {
  if (v) text.value = names.value.join("\n")
}, { immediate: true })

function handleInput(e: Event) {
  text.value = (e.target as HTMLTextAreaElement).value
  names.value = [...new Set(
    text.value.split("\n").map((s) => s.trim()).filter(Boolean),
  )]
}
</script>

<style lang="scss" scoped>
@use "../../styles/SettingsPanel.scss";
</style>
