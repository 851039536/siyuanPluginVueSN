<template>
  <Transition name="slide-up">
    <div
      v-if="visible.value"
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
            <!-- 按钮提示："变窄" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.narrower"
              :disabled="panelWidth <= 500"
              @click="adjustDimension('width', -80, 500, 1600)"
            >
              <Icon
                icon="mdi:chevron-left"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelWidth }}</span>
            <!-- 按钮提示："变宽" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.wider"
              :disabled="panelWidth >= 1600"
              @click="adjustDimension('width', 80, 500, 1600)"
            >
              <Icon
                icon="mdi:chevron-right"
                :size="12"
              />
            </button>
            <span class="resize-divider" />
            <!-- 按钮提示："变矮" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.shorter"
              :disabled="panelHeight <= 30"
              @click="adjustDimension('height', -10, 30, 100)"
            >
              <Icon
                icon="mdi:chevron-down"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelHeight }}</span>
            <!-- 按钮提示："变高" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.taller"
              :disabled="panelHeight >= 100"
              @click="adjustDimension('height', 10, 30, 100)"
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
          <!-- 按钮提示："上一个工具 (←)" -->
          <button
            class="tab-nav-btn tab-nav-left"
            :title="i18n.toolCollectionPanel.prevTool"
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
          <!-- 按钮提示："下一个工具 (→)" -->
          <button
            class="tab-nav-btn tab-nav-right"
            :title="i18n.toolCollectionPanel.nextTool"
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
/**
 * 工具合集 - 底部面板主组件
 * Tab 切换多个实用小工具，支持键盘导航与面板尺寸持久化
 */
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
import { TypedStorage } from "@/utils/typedStorage"
import Base64ImageTool from "./tools/base64Image/index.vue"
import UnitConverterTool from "./tools/unitConverter/index.vue"
import WordQueryTool from "./tools/wordQuery/index.vue"

/** 面板 i18n 键的最小类型声明 */
interface PanelI18n {
  toolCollection: string
  base64Image: string
  unitConverter: string
  wordQuery: { title: string }
  toolCollectionPanel: {
    narrower: string
    wider: string
    shorter: string
    taller: string
    prevTool: string
    nextTool: string
  }
}

interface Props {
  plugin: Plugin
  visible: Ref<boolean>
}

const props = defineProps<Props>()

const i18n = props.plugin.i18n as unknown as PanelI18n

// 当前激活的 Tab 按钮 ref（打开时聚焦于此，兼顾键盘上下文与无障碍）
const activeTabRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.visible.value,
  (val) => {
    if (val) {
      // 打开后将焦点移到激活的 Tab 按钮，使键盘监听立即生效
      nextTick(() => activeTabRef.value?.focus())
    }
  },
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
const widthSlot = new TypedStorage<number>(storage, "toolCollection-width", DEFAULT_WIDTH)
const heightSlot = new TypedStorage<number>(storage, "toolCollection-height", DEFAULT_HEIGHT)

const panelStyle = computed(() => {
  // height 固定，内部内容通过 overflow-y: auto 滚动；maxHeight 硬封顶防止溢出视口
  return {
    maxWidth: `${panelWidth.value}px`,
    height: `${panelHeight.value}vh`,
    maxHeight: `calc(88vh - 36px)`,
  }
})

onMounted(async () => {
  // 键盘监听注册必须在任何 await 之前，确保 onBeforeUnmount 的 removeEventListener 必然晚于注册
  window.addEventListener("keydown", handleKeydown)

  // 并行加载持久化尺寸，loadOrDefault 内置字符串数字归一化
  const [w, h] = await Promise.all([widthSlot.loadOrDefault(), heightSlot.loadOrDefault()])
  // 仅在值未被用户调整过（仍为默认值）时应用，避免异步加载覆盖用户操作
  if (w >= 500 && w <= 1600 && panelWidth.value === DEFAULT_WIDTH) panelWidth.value = w
  if (h >= 30 && h <= 100 && panelHeight.value === DEFAULT_HEIGHT) panelHeight.value = h
})

const adjustDimension = async (
  key: "width" | "height",
  delta: number,
  min: number,
  max: number
) => {
  const target = key === "width" ? panelWidth : panelHeight
  target.value = Math.max(min, Math.min(max, target.value + delta))
  const slot = key === "width" ? widthSlot : heightSlot
  await slot.save(target.value)
}

// ==================== 工具注册表 ====================
const tools: ToolMeta[] = [
  {
    id: "wordQuery",
    label: i18n.wordQuery.title,
    icon: "mdi:book",
  },
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
]

const currentTool = ref("wordQuery")

// ==================== Tab 循环切换 ====================
const currentIndex = computed(() =>
  tools.findIndex((t) => t.id === currentTool.value)
)

const prevTool = () => {
  const idx = currentIndex.value
  const prev = idx <= 0 ? tools.length - 1 : idx - 1
  currentTool.value = tools[prev].id
}

const nextTool = () => {
  const idx = currentIndex.value
  const next = idx >= tools.length - 1 ? 0 : idx + 1
  currentTool.value = tools[next].id
}

// ==================== 键盘交互（Escape 关闭 / 左右切换 Tab） ====================
const handleKeydown = (e: KeyboardEvent) => {
  if (!props.visible.value) return
  const target = e.target as HTMLElement
  const tagName = target.tagName
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable) return

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
