<template>
  <div class="unit-converter">
    <div class="converter-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="converter-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.name }}
      </div>
    </div>

    <div class="converter-content">
      <component
        :is="currentComponent"
        :key="activeTab"
        v-bind="currentProps"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import BaseUnitConverter from "./components/BaseUnitConverter.vue"
import ASCIIConverter from "./components/ASCIIConverter.vue"
import BaseConverter from "./components/BaseConverter.vue"
import {
  AREA_UNITS,
  DATA_UNITS,
  LENGTH_UNITS,
  MASS_UNITS,
  POWER_UNITS,
  SPEED_UNITS,
  TIME_UNITS,
  VOLUME_UNITS,
} from "./utils/units"

interface Props {
  plugin: Plugin
  i18n: Record<string, string>
}

defineProps<Props>()

const activeTab = ref("length")

// 配置驱动的标签定义，合并单位数据与组件映射
const tabs = [
  {
    key: "length", name: "长度", component: BaseUnitConverter,
    units: LENGTH_UNITS, defaultFrom: "meter", defaultTo: "centimeter",
  },
  {
    key: "area", name: "面积", component: BaseUnitConverter,
    units: AREA_UNITS, defaultFrom: "squareMeter", defaultTo: "squareCentimeter",
  },
  {
    key: "volume", name: "体积", component: BaseUnitConverter,
    units: VOLUME_UNITS, defaultFrom: "cubicMeter", defaultTo: "liter",
  },
  {
    key: "mass", name: "质量", component: BaseUnitConverter,
    units: MASS_UNITS, defaultFrom: "kilogram", defaultTo: "gram",
  },
  {
    key: "power", name: "功率", component: BaseUnitConverter,
    units: POWER_UNITS, defaultFrom: "watt", defaultTo: "kilowatt",
  },
  {
    key: "time", name: "时间", component: BaseUnitConverter,
    units: TIME_UNITS, defaultFrom: "second", defaultTo: "minute",
  },
  {
    key: "speed", name: "速度", component: BaseUnitConverter,
    units: SPEED_UNITS, defaultFrom: "meterPerSecond", defaultTo: "kilometerPerHour",
  },
  {
    key: "data", name: "数据", component: BaseUnitConverter,
    units: DATA_UNITS, defaultFrom: "byte", defaultTo: "kilobyte",
  },
  { key: "base", name: "进制", component: BaseConverter },
  { key: "ascii", name: "ASCII", component: ASCIIConverter },
]

const currentTab = computed(() => tabs.find((t) => t.key === activeTab.value)!)
const currentComponent = computed(() => currentTab.value.component)
const currentProps = computed(() => {
  const { component, key, name, ...rest } = currentTab.value
  return rest
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
