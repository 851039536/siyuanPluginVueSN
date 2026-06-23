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
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import ToolItem from "./components/ToolItem.vue"
import { getToolsForPlatform } from "./tools/registry"
import { useMobileDetection } from "./composables/useMobileDetection"

const props = defineProps<{
  plugin?: any
}>()

const { isMobile } = useMobileDetection()

const isExpanded = ref(false)

const tools = computed(() =>
  getToolsForPlatform(props.plugin as Plugin, isMobile.value),
)

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
