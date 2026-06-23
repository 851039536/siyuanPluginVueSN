<template>
  <Transition name="slide-up">
    <div
      v-if="visibleRef"
      class="tool-collection-overlay"
      @click.self="close"
    >
      <div class="tool-collection-panel">
        <!-- 头部 -->
        <div class="tool-collection-header">
          <span class="header-title">{{ i18n.toolCollection || "工具合集" }}</span>
          <button
            class="header-close"
            @click="close"
          >
            <Icon icon="mdi:close" :size="14" />
          </button>
        </div>

        <!-- Tab 标签栏 -->
        <div class="tool-collection-tabs">
          <button
            v-for="tool in tools"
            :key="tool.id"
            class="tab-btn"
            :class="{ active: currentTool === tool.id }"
            @click="currentTool = tool.id"
          >
            {{ tool.label }}
          </button>
        </div>

        <!-- 工具内容区 -->
        <div class="tool-collection-content">
          <Base64ImageTool
            v-if="currentTool === 'base64Image'"
            :plugin="plugin"
            :i18n="plugin.i18n"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import { computed, ref, watch } from "vue"
import Icon from "@/components/IconWrapper.vue"
import Base64ImageTool from "./tools/base64Image/index.vue"

interface Props {
  plugin: Plugin
  visible: Ref<boolean>
}

const props = defineProps<Props>()

const i18n = (props.plugin.i18n as Record<string, string>) || {}

// 本地 visible 同步（用于 Transition 动画）
const visibleRef = ref(false)

watch(
  () => (props.visible as Ref<boolean>).value,
  (val) => {
    visibleRef.value = val
  },
  { immediate: true },
)

const close = () => {
  ;(props.visible as Ref<boolean>).value = false
}

// ==================== 工具注册表 ====================
interface ToolMeta {
  id: string
  label: string
  icon: string
}

const tools = computed<ToolMeta[]>(() => [
  {
    id: "base64Image",
    label: i18n.base64Image || "Base64图片转换",
    icon: "mdi:code-brackets",
  },
])

const currentTool = ref("base64Image")
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
