<!-- gitPush 项目卡片多面板 Tab 切换条（CHANGES/LOG/STASH/TAG + 计数徽标，v-model 双向绑定） -->
<template>
  <!-- 多面板 Tab 切换（工作区 / 提交日志 / Stash / Tag），面板经具名插槽下发 -->
  <!-- lazy：未激活面板不挂载（等价拆分前的 v-if），保持「切走即卸载」的既有行为与开销 -->
  <Tabs
    class="gp-stash-tag-tabs"
    :value="modelValue"
    size="xsmall"
    lazy
    @update:value="handleChange"
  >
    <TabList>
      <!-- 单个 Tab（下划线选中态、键盘导航与 aria 语义由共享组件承担） -->
      <Tab
        v-for="tab in TABS"
        :key="tab.id"
        :value="tab.id"
      >
        {{ i18n[tab.labelKey] }}
        <!-- 计数徽标（数量为 0 时不显示） -->
        <span
          v-if="counts[tab.countKey] > 0"
          class="gp-stash-tag-tab-count"
        >{{ counts[tab.countKey] }}</span>
      </Tab>
    </TabList>
    <TabPanels>
      <!-- 面板内容由父层经具名插槽下发（插槽名与 CardTabId 同值域） -->
      <TabPanel
        v-for="tab in TABS"
        :key="tab.id"
        :value="tab.id"
      >
        <slot :name="tab.id" />
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Tabs from "@/components/Tabs.vue"
import TabList from "@/components/TabList.vue"
import Tab from "@/components/Tab.vue"
import TabPanels from "@/components/TabPanels.vue"
import TabPanel from "@/components/TabPanel.vue"

/** 卡片面板 Tab ID（与编排层 stashTagTab 状态同值域，同时作为面板插槽名） */
export type CardTabId = "worktree" | "log" | "stash" | "tag"

/** Tab 元数据表（labelKey 指向 i18n 键，countKey 指向 props 对应计数字段） */
const TABS: { id: CardTabId, labelKey: string, countKey: keyof CardCounts }[] = [
  { id: "worktree", labelKey: "cardTabChanges", countKey: "changesCount" },
  { id: "log", labelKey: "cardTabLog", countKey: "logCount" },
  { id: "stash", labelKey: "cardTabStash", countKey: "stashCount" },
  { id: "tag", labelKey: "cardTabTag", countKey: "tagCount" },
]

interface CardCounts {
  changesCount: number
  logCount: number
  stashCount: number
  tagCount: number
}

const props = defineProps<{
  modelValue: CardTabId
  /** 面板文案（与卡片其他区块同源传入） */
  i18n: Record<string, any>
} & CardCounts>()

const emit = defineEmits<{
  "update:modelValue": [value: CardTabId]
}>()

/** 计数聚合映射（模板按 countKey 取数） */
const counts = computed<CardCounts>(() => ({
  changesCount: props.changesCount,
  logCount: props.logCount,
  stashCount: props.stashCount,
  tagCount: props.tagCount,
}))

/** Tab 切换：Tabs 只对外派发 string | number（TabsValue 类型在组件私有目录内，不跨层引用） */
function handleChange(value: string | number) {
  emit("update:modelValue", value as CardTabId)
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardTabs.scss";
</style>
