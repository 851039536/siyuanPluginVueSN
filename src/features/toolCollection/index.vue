<template>
  <Transition name="slide-up">
    <div
      v-if="visibleRef"
      class="tool-collection-overlay"
      @click.self="close"
    >
      <div
        class="tool-collection-panel"
        :style="panelStyle"
      >
        <!-- 头部 -->
        <div class="tool-collection-header">
          <span class="header-title">{{ i18n.toolCollection || "工具合集" }}</span>
          <div class="header-resize">
            <button
              class="resize-btn"
              title="变窄"
              @click="adjustWidth(-80)"
            >
              <Icon
                icon="mdi:chevron-left"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelWidth }}px</span>
            <button
              class="resize-btn"
              title="变宽"
              @click="adjustWidth(80)"
            >
              <Icon
                icon="mdi:chevron-right"
                :size="12"
              />
            </button>
            <button
              class="resize-btn"
              title="变矮"
              @click="adjustHeight(-10)"
            >
              <Icon
                icon="mdi:chevron-down"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelHeight }}vh</span>
            <button
              class="resize-btn"
              title="变高"
              @click="adjustHeight(10)"
            >
              <Icon
                icon="mdi:chevron-up"
                :size="12"
              />
            </button>
          </div>
          <button
            class="header-close"
            @click="close"
          >
            <Icon
              icon="mdi:close"
              :size="14"
            />
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
          <UnitConverterTool
            v-if="currentTool === 'unitConverter'"
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
import type { ToolMeta } from "./types"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import { PluginStorage } from "@/utils/pluginStorage"
import Base64ImageTool from "./tools/base64Image/index.vue"
import UnitConverterTool from "./tools/unitConverter/index.vue"

interface Props {
  plugin: Plugin
  visible: Ref<boolean>
}

const props = defineProps<Props>()

const i18n = (props.plugin.i18n as Record<string, string>) || {}

// 本地 visible 同步（用于 Transition 动画）
const visibleRef = ref(false)

watch(
  () => props.visible.value,
  (val) => {
    visibleRef.value = val
  },
  { immediate: true },
)

const close = () => {
  props.visible.value = false
}

// ==================== 面板尺寸（持久化存储） ====================
const DEFAULT_WIDTH = 1060
const DEFAULT_HEIGHT = 60 // vh

const panelWidth = ref(DEFAULT_WIDTH)
const panelHeight = ref(DEFAULT_HEIGHT)

const storage = new PluginStorage(props.plugin)

const panelStyle = computed(() => {
  // height 固定，内部内容通过 overflow-y: auto 滚动；maxHeight 硬封顶防止溢出视口
  return {
    maxWidth: `${panelWidth.value}px`,
    height: `${panelHeight.value}vh`,
    maxHeight: `calc(88vh - 36px)`,
  }
})

onMounted(async () => {
  const w = await storage.load<number>("toolCollection-width")
  if (w && w >= 500 && w <= 1200) panelWidth.value = w
  const h = await storage.load<number>("toolCollection-height")
  if (h && h >= 30 && h <= 85) panelHeight.value = h
})

const adjustWidth = async (delta: number) => {
  panelWidth.value = Math.max(500, Math.min(1200, panelWidth.value + delta))
  await storage.save("toolCollection-width", panelWidth.value)
}

const adjustHeight = async (delta: number) => {
  panelHeight.value = Math.max(30, Math.min(85, panelHeight.value + delta))
  await storage.save("toolCollection-height", panelHeight.value)
}

// ==================== 工具注册表 ====================
const tools = computed<ToolMeta[]>(() => [
  {
    id: "base64Image",
    label: i18n.base64Image || "Base64图片转换",
    icon: "mdi:code-brackets",
  },
  {
    id: "unitConverter",
    label: i18n.unitConverter || "单位转换",
    icon: "mdi:swap-horizontal",
  },
])

const currentTool = ref("base64Image")
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
