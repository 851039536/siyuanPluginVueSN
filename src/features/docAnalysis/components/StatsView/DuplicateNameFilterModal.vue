<!-- 重名文档名称排除弹窗 - 每行一个名称，保存后应用排除过滤 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="dup-manage-overlay"
      @click.self="$emit('close')"
    >
      <div
        class="dup-manage-panel"
        tabindex="-1"
        @keydown.esc="$emit('close')"
      >
        <div class="dup-manage-header">
          <span class="dup-manage-title">
            <Icon icon="mdi:filter-remove-outline" />
            排除重名文档
          </span>
          <button
            class="close-btn"
            @click="$emit('close')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="dup-manage-body">
          <p class="dup-manage-hint">每行一个文档名称，包含该名称的文档将被排除（不区分大小写）</p>
          <textarea
            v-model="text"
            class="dup-manage-textarea"
            rows="8"
            placeholder="输入要排除的名称，每行一个..."
          />
        </div>
        <div class="dup-manage-footer">
          <button
            class="dup-manage-cancel"
            @click="$emit('close')"
          >
            取消
          </button>
          <button
            class="dup-manage-save"
            @click="save"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import { Icon } from "@iconify/vue"

interface Props {
  visible: boolean
  names: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "save", names: string[]): void
}>()

const text = ref("")

// 打开时用当前排除列表初始化文本（仅初始化，编辑过程不回写 props）
watch(() => props.visible, (v) => {
  if (v) text.value = props.names.join("\n")
})

function save() {
  const names = [...new Set(
    text.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  )]
  emit("save", names)
  emit("close")
}
</script>

<style lang="scss" scoped>
@use "../../styles/DuplicateNameFilterModal.scss";
@use "../../styles/index.scss";
</style>
