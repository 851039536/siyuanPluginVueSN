<!-- 单个面板：与同 value 的 Tab 配对；默认保留 DOM 仅隐藏，lazy 开启后未激活面板不渲染 -->
<template>
  <div
    v-if="context.lazy ? active : true"
    v-show="context.lazy ? true : active"
    class="si-tabpanel"
    role="tabpanel"
    :id="id"
    :aria-labelledby="labelledBy"
    :tabindex="context.tabindex"
    :data-active="active ? 'true' : 'false'"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type {
  TabsValue,
} from "./tabs/types"
import {
  computed,
} from "vue"
import {
  tabId,
  tabPanelId,
  useTabsContext,
} from "./tabs/context"
import "./kit/theme"

interface Props {
  /** 面板值：与同值的 `Tab` 配对 */
  value: TabsValue
}

const props = defineProps<Props>()

const context = useTabsContext("TabPanel")

/** 激活判定：与 Tab 一致用严格相等 */
const active = computed(() => context.value === props.value)

const id = computed(() => tabPanelId(context.id, props.value))
const labelledBy = computed(() => tabId(context.id, props.value))
</script>

<style scoped lang="scss">
@use './styles/TabPanel.scss';
</style>
