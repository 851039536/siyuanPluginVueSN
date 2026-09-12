<!-- 组件预览 — 主面板：搜索 + 组件导航 + 分区快照（真实组件渲染 + 代码复制） -->
<template>
  <div class="cp-panel">
    <!-- 头部工具栏 -->
    <div class="cp-header">
      <!-- 面板标题（浮动窗口内经 isFloating 隐藏，避免与页签标题重复） -->
      <div
        v-if="!isFloating"
        class="cp-header__brand"
      >
        <span class="cp-header__title">{{ i18n.title }}</span>
        <span class="cp-header__subtitle">{{ i18n.subtitle }}</span>
      </div>
      <div class="cp-header__actions">
        <!-- 组件尺寸档位切换（XS / S / M / L，作用于所有支持 size 的组件示例） -->
        <!-- 分段互斥组：选中走填充主色，未选中走幽灵文本 + :aria-pressed（项目既有范式） -->
        <div
          class="cp-size"
          role="group"
          :aria-label="i18n.sizeLabel"
        >
          <Button
            v-for="option in COMPONENT_SIZES"
            :key="option.value"
            class="cp-size__btn"
            size="xsmall"
            :variant="size === option.value ? 'primary' : 'ghost'"
            :text="size !== option.value"
            :aria-pressed="size === option.value"
            :title="i18n[option.labelKey]"
            @click="setSize(option.value)"
          >
            {{ option.short }}
          </Button>
        </div>
        <!-- 搜索占位文案："搜索组件…" -->
        <Input
          v-model="query"
          :placeholder="i18n.searchPlaceholder"
          prefix-icon="magnify"
          clearable
          size="xsmall"
          class="cp-header__search"
        />
        <!-- 在独立窗口打开（浮动窗口内隐藏；关闭浮动窗口自动移回主窗口） -->
        <Button
          v-if="!isFloating"
          variant="ghost"
          size="xsmall"
          icon="dockWindow"
          :title="i18n.openFloatingWindow"
          @click="handleToggleFloating"
        />
      </div>
    </div>

    <!-- 主体：导航 + 内容 -->
    <div class="cp-body">
      <NavSidebar
        :groups="filteredGroups"
        :active-id="activeId"
        :i18n="i18n"
        @select="handleSelect"
      />
      <div
        ref="contentRef"
        class="cp-content"
        @scroll.passive="handleContentScroll"
      >
        <!-- 逐个组件分区（空态提示："没有匹配的组件"） -->
        <PreviewSection
          v-for="group in filteredGroups"
          :key="group.id"
          :group="group"
          :i18n="i18n"
          :size="size"
        />
        <div
          v-if="filteredGroups.length === 0"
          class="cp-content__empty"
        >
          {{ i18n.noMatch }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { getFrontend } from "siyuan"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import NavSidebar from "./components/NavSidebar.vue"
import PreviewSection from "./components/PreviewSection.vue"
import { usePreviewSize } from "./composables/usePreviewSize"
import { PREVIEW_GROUPS } from "./previewData"
import { COMPONENT_SIZES } from "./types"
import type { I18n } from "./types"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()

// 组件尺寸档位：启动加载偏好 + 切换持久化
const { size, loadSize, setSize } = usePreviewSize(props.plugin)
onMounted(() => {
  void loadSize()
})

/** 当前是否运行在独立浮动窗口中（getFrontend()：desktop=主窗口 / desktop-window=新窗口） */
const isFloating = computed(() => {
  try {
    return getFrontend() === "desktop-window"
  } catch {
    return false
  }
})

// 搜索过滤
const query = ref("")
const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return PREVIEW_GROUPS
  return PREVIEW_GROUPS.filter((group) => {
    const name = group.name.toLowerCase()
    const summary = group.summary.toLowerCase()
    return name.includes(q) || summary.includes(q)
  })
})

// 锚点导航
const contentRef = ref<HTMLElement | null>(null)
const activeId = ref(PREVIEW_GROUPS[0]?.id || "")
/** 点击导航时置位，避免平滑滚动过程中的 scroll 事件把高亮抢回旧分区 */
let suppressScrollSync = false
let suppressTimer: number | null = null

const handleSelect = (id: string) => {
  activeId.value = id
  const section = contentRef.value?.querySelector<HTMLElement>(`#cp-group-${id}`)
  if (!section) return
  suppressScrollSync = true
  if (suppressTimer !== null) {
    window.clearTimeout(suppressTimer)
  }
  suppressTimer = window.setTimeout(() => {
    suppressScrollSync = false
  }, 600)
  section.scrollIntoView({ behavior: "smooth", block: "start" })
}

/** 内容区滚动时同步导航高亮：取首个越过视口顶部的分区 */
const handleContentScroll = () => {
  if (suppressScrollSync) return
  const container = contentRef.value
  if (!container) return
  const containerTop = container.getBoundingClientRect().top
  let current = filteredGroups.value[0]?.id || ""
  for (const group of filteredGroups.value) {
    const section = container.querySelector<HTMLElement>(`#cp-group-${group.id}`)
    if (!section) continue
    if (section.getBoundingClientRect().top - containerTop <= 40) {
      current = group.id
    } else {
      break
    }
  }
  activeId.value = current
}

// 搜索过滤后若当前高亮分区已被过滤掉，重置为第一个可见分区
watch(filteredGroups, (groups) => {
  if (!groups.some((group) => group.id === activeId.value)) {
    activeId.value = groups[0]?.id || ""
  }
})

// 浮动窗口切换（经 plugin 上自挂载的 PreviewManager 调度）
const handleToggleFloating = () => {
  const manager = (props.plugin as any).__componentPreview as
    | { openFloating: () => void }
    | undefined
  if (!manager) return
  void manager.openFloating()
}
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
