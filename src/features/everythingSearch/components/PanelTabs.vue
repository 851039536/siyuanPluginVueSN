<!-- 面板 Tab 切换栏：文件搜索 / 缓存清理（共享 Tabs 五件套，仅承载切换语义） -->
<template>
  <Tabs
    :value="modelValue"
    size="xsmall"
    @update:value="(v) => emit('update:modelValue', v as PanelTab)"
  >
    <TabList :aria-label="ariaLabel">
      <Tab
        v-for="tab in tabs"
        :key="tab.key"
        :value="tab.key"
      >
        <IconWrapper
          :name="tab.icon"
          :size="12"
        />
        {{ tab.label }}
      </Tab>
    </TabList>
  </Tabs>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import Tab from "@/components/Tab.vue"
import TabList from "@/components/TabList.vue"
import Tabs from "@/components/Tabs.vue"
import IconWrapper from "@/components/IconWrapper.vue"

/** 面板 Tab 标识（与 index.vue 的 activeTab 取值一致） */
export type PanelTab = "search" | "cache"

/** 单个 Tab 的渲染项 */
export interface PanelTabItem {
  key: PanelTab
  label: string
  icon: IconKey
}

interface Props {
  /** 当前激活 Tab（受控） */
  modelValue: PanelTab
  /** Tab 列表（label 由父层从 i18n 取，随语言切変即时更新） */
  tabs: PanelTabItem[]
  /** 标签栏的无障碍名称（通常传功能标题） */
  ariaLabel?: string
}

interface Emits {
  (e: "update:modelValue", value: PanelTab): void
}

withDefaults(defineProps<Props>(), {
  ariaLabel: "",
})

const emit = defineEmits<Emits>()
</script>
