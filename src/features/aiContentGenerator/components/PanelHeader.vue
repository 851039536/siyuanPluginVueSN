<template>
  <div class="panel-header">
    <div class="header-mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: activeMode === 'generator' }"
        @click="$emit('update:activeMode', 'generator')"
      >
        <svg
          width="14"
          height="14"
        ><use xlink:href="#iconSparkles" /></svg>
        <span>{{ generatorTitle }}</span>
      </button>
      <button
        class="mode-tab"
        :class="{ active: activeMode === 'automation' }"
        @click="$emit('update:activeMode', 'automation')"
      >
        <svg
          width="14"
          height="14"
        ><use xlink:href="#iconRefresh" /></svg>
        <span>{{ automationTitle }}</span>
      </button>
    </div>
    <div class="header-actions">
      <!-- 设置按钮（仅在生成器模式显示） -->
      <Button
        v-if="activeMode === 'generator'"
        variant="ghost"
        size="small"
        title="对话设置"
        @click="$emit('toggle-settings')"
      >
        <svg
          width="18"
          height="16"
        >
          <use xlink:href="#iconSettings"></use>
        </svg>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

interface Props {
  title?: string
  activeMode: "generator" | "automation"
  generatorTitle?: string
  automationTitle?: string
}

withDefaults(defineProps<Props>(), {
  title: "信息生成",
  generatorTitle: "生成器",
  automationTitle: "自动化",
})

defineEmits<{
  (e: "toggle-settings"): void
  (e: "update:activeMode", mode: "generator" | "automation"): void
}>()
</script>

<style scoped lang="scss">
// ============ 模式切换 Tab ============
.header-mode-tabs {
  display: flex;
  gap: 1px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 5px;
  padding: 2px;
}

.mode-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  svg {
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }

  &:hover {
    color: var(--b3-theme-on-background);
    svg { opacity: 0.8; }
  }

  &.active {
    color: var(--b3-theme-primary);
    background: var(--b3-theme-background);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);

    svg {
      color: var(--b3-theme-primary);
      opacity: 1;
    }
  }
}

</style>
