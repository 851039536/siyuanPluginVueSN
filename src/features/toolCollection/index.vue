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
          <span class="header-title">{{ i18n.toolCollection }}</span>
          <div class="header-resize">
            <button
              class="resize-btn"
              title="变窄"
              :disabled="panelWidth <= 500"
              @click="adjustDimension('width', -80, 500, 1200)"
            >
              <Icon
                icon="mdi:chevron-left"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelWidth }}</span>
            <button
              class="resize-btn"
              title="变宽"
              :disabled="panelWidth >= 1200"
              @click="adjustDimension('width', 80, 500, 1200)"
            >
              <Icon
                icon="mdi:chevron-right"
                :size="12"
              />
            </button>
            <span class="resize-divider" />
            <button
              class="resize-btn"
              title="变矮"
              :disabled="panelHeight <= 30"
              @click="adjustDimension('height', -10, 30, 85)"
            >
              <Icon
                icon="mdi:chevron-down"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelHeight }}</span>
            <button
              class="resize-btn"
              title="变高"
              :disabled="panelHeight >= 85"
              @click="adjustDimension('height', 10, 30, 85)"
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

        <!-- Tab 标签栏（左右箭头 + 可滚动 Tab 条） -->
        <div class="tool-collection-tab-bar">
          <button
            class="tab-nav-btn tab-nav-left"
            title="上一个工具 (←)"
            @click="prevTool"
          >
            <Icon
              icon="mdi:arrow-left"
              :size="12"
            />
          </button>
          <div class="tool-collection-tabs">
            <button
              v-for="tool in tools"
              :key="tool.id"
              class="tab-btn"
              :class="{ active: currentTool === tool.id }"
              :ref="(el) => { if (currentTool === tool.id) activeTabRef = el as HTMLButtonElement | null }"
              @click="currentTool = tool.id"
            >
              <Icon
                :icon="tool.icon"
                :size="14"
              />
              {{ tool.label }}
            </button>
          </div>
          <button
            class="tab-nav-btn tab-nav-right"
            title="下一个工具 (→)"
            @click="nextTool"
          >
            <Icon
              icon="mdi:arrow-right"
              :size="12"
            />
          </button>
          <span class="tab-keyhint">← →</span>
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
          <WordQueryTool
            v-if="currentTool === 'wordQuery'"
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
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import { PluginStorage } from "@/utils/pluginStorage"
import Base64ImageTool from "./tools/base64Image/index.vue"
import UnitConverterTool from "./tools/unitConverter/index.vue"
import WordQueryTool from "./tools/wordQuery/index.vue"

interface Props {
  plugin: Plugin
  visible: Ref<boolean>
}

const props = defineProps<Props>()

const i18n = (props.plugin.i18n as Record<string, any>) || {}

// 本地 visible 同步（用于 Transition 动画）
const visibleRef = ref(false)

// 当前激活的 Tab 按钮 ref（打开时聚焦于此，兼顾键盘上下文与无障碍）
const activeTabRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.visible.value,
  (val) => {
    visibleRef.value = val
    if (val) {
      // 打开后将焦点移到激活的 Tab 按钮，使键盘监听立即生效
      nextTick(() => activeTabRef.value?.focus())
    }
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
  // 仅在值未被用户调整过（仍为默认值）时应用持久化尺寸，避免异步加载覆盖用户操作
  const w = await storage.load<number>("toolCollection-width")
  if (w && w >= 500 && w <= 1200 && panelWidth.value === DEFAULT_WIDTH) panelWidth.value = w
  const h = await storage.load<number>("toolCollection-height")
  if (h && h >= 30 && h <= 85 && panelHeight.value === DEFAULT_HEIGHT) panelHeight.value = h
  window.addEventListener("keydown", handleKeydown)
})

const adjustDimension = async (
  key: "width" | "height",
  delta: number,
  min: number,
  max: number
) => {
  const target = key === "width" ? panelWidth : panelHeight
  target.value = Math.max(min, Math.min(max, target.value + delta))
  await storage.save(`toolCollection-${key}`, target.value)
}

// ==================== 工具注册表 ====================
const tools = computed<ToolMeta[]>(() => [
  {
    id: "base64Image",
    label: i18n.base64Image,
    icon: "mdi:code-brackets",
  },
  {
    id: "unitConverter",
    label: i18n.unitConverter,
    icon: "mdi:swap-horizontal",
  },
  {
    id: "wordQuery",
    label: i18n.wordQuery?.title,
    icon: "mdi:book",
  },
])

const currentTool = ref("base64Image")

// ==================== Tab 循环切换 ====================
const currentIndex = computed(() =>
  tools.value.findIndex((t) => t.id === currentTool.value)
)

const prevTool = () => {
  const list = tools.value
  const idx = currentIndex.value
  const prev = idx <= 0 ? list.length - 1 : idx - 1
  currentTool.value = list[prev].id
}

const nextTool = () => {
  const list = tools.value
  const idx = currentIndex.value
  const next = idx >= list.length - 1 ? 0 : idx + 1
  currentTool.value = list[next].id
}

// ==================== 键盘交互（Escape 关闭 / 左右切换 Tab） ====================
const handleKeydown = (e: KeyboardEvent) => {
  // 读取同步源 props.visible，避免 watch 异步刷新 visibleRef 导致首键丢失
  if (!props.visible.value) return
  const target = e.target as HTMLElement
  const tagName = target.tagName
  if (tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable) return

  if (e.key === "Escape") {
    e.preventDefault()
    close()
  } else if (e.key === "ArrowLeft") {
    e.preventDefault()
    prevTool()
  } else if (e.key === "ArrowRight") {
    e.preventDefault()
    nextTool()
  }
}

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown)
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
