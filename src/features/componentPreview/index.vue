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
          :active="sectionActive[group.id] ?? false"
          :placeholder-height="sectionHeights[group.id] ?? 0"
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
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
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
  // 首帧先按几何位置挂载可视区附近的分区（IO 首次回调是异步的，否则打开面板会先白屏）
  mountSectionsInViewport()
  setupObserver()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  if (scrollFrame !== null) {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = null
  }
  for (const timer of unmountTimers.values()) {
    window.clearTimeout(timer)
  }
  unmountTimers.clear()
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

// ==================== 分区懒挂载 + 远区卸载 ====================
// 全部分区一次性实例化会产生 ~290 个真实组件实例（含 Chart / Sidebar / Splitter 等重组件），
// 内存与首帧开销都很大。这里只把「预挂载区」内的分区实例化，滚远后卸载（保留分区外壳与高度占位）。

/** 预挂载余量（px）：可视区上下各提前 800px 实例化，滚动到位时已就绪 */
const PRELOAD_MARGIN = 800
/** 离开预挂载区后的延迟卸载时间（ms）：快速滚动时避免反复挂载 / 卸载抖动 */
const UNMOUNT_DELAY = 400

/** 分区是否已实例化示例卡片 */
const sectionActive = reactive<Record<string, boolean>>({})
/** 分区网格实测高度（卸载时记录，用于撑住占位、避免滚动跳动） */
const sectionHeights = reactive<Record<string, number>>({})
/** 延迟卸载定时器（按分区 id） */
const unmountTimers = new Map<string, number>()
let observer: IntersectionObserver | null = null

const clearUnmountTimer = (id: string) => {
  const timer = unmountTimers.get(id)
  if (timer !== undefined) {
    window.clearTimeout(timer)
    unmountTimers.delete(id)
  }
}

const getSectionGrid = (id: string): HTMLElement | null =>
  contentRef.value?.querySelector<HTMLElement>(`#cp-group-${id} .cp-section__grid`) ?? null

/** 立即挂载（导航跳转 / 搜索命中 / IO 进入预挂载区时调用） */
const forceMount = (id: string) => {
  clearUnmountTimer(id)
  sectionActive[id] = true
}

/** 延迟卸载：先记下网格实测高度，再收起示例（避免滚动位置跳动） */
const scheduleUnmount = (id: string) => {
  clearUnmountTimer(id)
  unmountTimers.set(id, window.setTimeout(() => {
    unmountTimers.delete(id)
    const grid = getSectionGrid(id)
    if (grid) {
      sectionHeights[id] = grid.offsetHeight
    }
    sectionActive[id] = false
  }, UNMOUNT_DELAY))
}

/** 按当前过滤结果重建观察目标（过滤后 DOM 变化，旧的观察目标已不存在） */
const observeSections = () => {
  if (!observer) return
  observer.disconnect()
  for (const group of filteredGroups.value) {
    const el = contentRef.value?.querySelector<HTMLElement>(`#cp-group-${group.id}`)
    if (el) {
      observer.observe(el)
    }
  }
}

const setupObserver = () => {
  const container = contentRef.value
  if (!container || typeof IntersectionObserver === "undefined") return
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset.cpGroup
      if (!id) continue
      if (entry.isIntersecting) {
        forceMount(id)
      } else {
        scheduleUnmount(id)
      }
    }
  }, {
    root: container,
    rootMargin: `${PRELOAD_MARGIN}px 0px`,
  })
  observeSections()
}

/**
 * 分区相对内容区顶部的偏移（首帧挂载与滚动高亮共用）。
 * 容器顶边只读一次、由调用方传入，避免循环里反复触发 layout。
 */
const resolveSectionOffset = (
  container: HTMLElement,
  containerTop: number,
  id: string,
): { top: number; bottom: number } | null => {
  const el = container.querySelector<HTMLElement>(`#cp-group-${id}`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return {
    top: rect.top - containerTop,
    bottom: rect.bottom - containerTop,
  }
}

/** 首帧同步挂载：IO 回调是异步的，先按几何位置把可视区附近的分区挂上 */
const mountSectionsInViewport = () => {
  const container = contentRef.value
  if (!container) return
  const containerTop = container.getBoundingClientRect().top
  const limit = container.clientHeight + PRELOAD_MARGIN
  for (const group of filteredGroups.value) {
    const offset = resolveSectionOffset(container, containerTop, group.id)
    if (!offset) continue
    if (offset.top <= limit && offset.bottom >= -PRELOAD_MARGIN) {
      sectionActive[group.id] = true
    }
  }
}

/** 点击导航时置位，避免平滑滚动过程中的 scroll 事件把高亮抢回旧分区 */
let suppressScrollSync = false
let suppressTimer: number | null = null
/** 挂起中的滚动同步帧（scroll 合并用） */
let scrollFrame: number | null = null

const handleSelect = (id: string) => {
  activeId.value = id
  // 目标分区可能是卸载状态（占位高度已撑住位置）⇒ 先挂载再滚动
  forceMount(id)
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

/** 取首个越过内容区顶部的分区并同步导航高亮（几何读取与首帧挂载共用 helper） */
const syncActiveFromScroll = () => {
  const container = contentRef.value
  if (!container) return
  const containerTop = container.getBoundingClientRect().top
  let current = filteredGroups.value[0]?.id || ""
  for (const group of filteredGroups.value) {
    const offset = resolveSectionOffset(container, containerTop, group.id)
    if (!offset) continue
    if (offset.top <= 40) {
      current = group.id
    } else {
      break
    }
  }
  // 只在真正变化时写入，避免同一分区内的滚动反复触发导航重渲染
  if (current !== activeId.value) {
    activeId.value = current
  }
}

/** 滚动事件：按动画帧合并，一帧最多计算一次（scroll 触发频率远高于渲染帧） */
const handleContentScroll = () => {
  if (suppressScrollSync || scrollFrame !== null) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null
    syncActiveFromScroll()
  })
}

// 搜索过滤后若当前高亮分区已被过滤掉，重置为第一个可见分区
watch(filteredGroups, async (groups) => {
  if (!groups.some((group) => group.id === activeId.value)) {
    activeId.value = groups[0]?.id || ""
  }
  // 搜索命中的分区需立即可见（命中数量少，直接全部挂载）
  if (query.value.trim()) {
    groups.forEach((group) => forceMount(group.id))
  }
  await nextTick()
  observeSections()
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
