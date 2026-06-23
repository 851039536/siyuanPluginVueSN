<template>
  <div
    ref="wrapperRef"
    class="floating-box-wrapper"
    :class="{ collapsed: !isExpanded }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      class="floating-box-trigger"
      :class="{ expanded: isExpanded }"
      @click="isMobile && toggleExpanded()"
    >
      <Icon
        icon="mdi:apps"
        class="trigger-icon"
        width="16"
        height="16"
      />
    </div>

    <Transition name="toolbar">
      <div
        v-if="isExpanded"
        class="floating-toolbar"
      >
        <ToolItem
          v-for="tool in tools"
          :key="tool.id"
          :tool="tool"
          :plugin="plugin"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { FloatingTool } from "./types"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import ToolItem from "./components/ToolItem.vue"
import {
  createFlashcardReadingTool,
  createPasswordVaultTool,
  createPromptsTool,
  createRefreshTool,
  createSuperPanelTool,
  createTextDiffTool,
} from "./tools"

const props = defineProps<{
  plugin?: any
}>()

const isExpanded = ref(false)
const isMobile = ref(false)

const MOBILE_BREAKPOINT = 768
let resizeTimer: ReturnType<typeof setTimeout> | null = null

const tools = computed<FloatingTool[]>(() => {
  const baseTools: FloatingTool[] = [
    createSuperPanelTool(props.plugin),
    createRefreshTool(props.plugin),
  ]

  if (isMobile.value) {
    return [
      ...baseTools,
      createPasswordVaultTool(props.plugin),
      createFlashcardReadingTool(props.plugin),
    ]
  }

  const desktopTools: FloatingTool[] = [
    ...baseTools,
    createTextDiffTool(props.plugin),
  ]

  if (props.plugin?.settings?.enableSkills !== false) {
    desktopTools.push(createPromptsTool(props.plugin))
  }

  return desktopTools
})

const checkMobile = () => {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
}

const debouncedCheckMobile = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkMobile, 150)
}

onMounted(() => {
  checkMobile()
  window.addEventListener("resize", debouncedCheckMobile)
})

onUnmounted(() => {
  window.removeEventListener("resize", debouncedCheckMobile)
  if (resizeTimer) clearTimeout(resizeTimer)
})

const handleMouseEnter = () => {
  if (!isMobile.value) isExpanded.value = true
}

const handleMouseLeave = () => {
  if (!isMobile.value) isExpanded.value = false
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<style scoped lang="scss">
@use './styles/index.scss';
</style>
