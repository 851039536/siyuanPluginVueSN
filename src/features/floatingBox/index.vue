<template>
  <div
    class="floating-box-wrapper"
    :class="{ collapsed: !isExpanded }"
    ref="wrapperRef"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      class="floating-box-trigger"
      :class="{ expanded: isExpanded }"
      @click="isMobile && toggleExpanded()"
    >
      <svg class="trigger-icon" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
      </svg>
    </div>

    <Transition name="toolbar">
      <div v-if="isExpanded" class="floating-toolbar">
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
import { ref, onMounted, onUnmounted, computed } from "vue";
import ToolItem from "./components/ToolItem.vue";
import {
	createSuperPanelTool,
	createRefreshTool,
	skillsTool,
	createTextDiffTool,
	createPasswordVaultTool,
	createFlashcardReadingTool,
} from "./tools";
import type { FloatingTool } from "./types";

const props = defineProps<{
	plugin?: any;
}>();

const isExpanded = ref(false);
const isMobile = ref(false);

const MOBILE_BREAKPOINT = 768;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

const tools = computed<FloatingTool[]>(() => {
	const baseTools: FloatingTool[] = [
		createSuperPanelTool(props.plugin),
		createRefreshTool(props.plugin),
	];

	if (isMobile.value) {
		return [
			...baseTools,
			createPasswordVaultTool(props.plugin),
			createFlashcardReadingTool(props.plugin),
		];
	}

	const desktopTools: FloatingTool[] = [
		...baseTools,
		createTextDiffTool(props.plugin),
	];

	if (props.plugin?.settings?.enableSkills !== false) {
		desktopTools.push(skillsTool(props.plugin));
	}

	return desktopTools;
});

const checkMobile = () => {
	isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
};

const debouncedCheckMobile = () => {
	if (resizeTimer) clearTimeout(resizeTimer);
	resizeTimer = setTimeout(checkMobile, 150);
};

onMounted(() => {
	checkMobile();
	window.addEventListener("resize", debouncedCheckMobile);
});

onUnmounted(() => {
	window.removeEventListener("resize", debouncedCheckMobile);
	if (resizeTimer) clearTimeout(resizeTimer);
});

const handleMouseEnter = () => {
	if (!isMobile.value) isExpanded.value = true;
};

const handleMouseLeave = () => {
	if (!isMobile.value) isExpanded.value = false;
};

const toggleExpanded = () => {
	isExpanded.value = !isExpanded.value;
};
</script>

<style scoped lang="scss">
@use './styles/index.scss';
</style>
