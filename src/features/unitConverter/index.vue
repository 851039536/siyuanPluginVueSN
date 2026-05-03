<template>
  <div class="unit-converter">
    <div class="converter-header">
      <h3>{{ i18n?.unitConverterTitle || '单位转换' }}</h3>
    </div>
    
    <div class="converter-tabs">
      <Button
        v-for="tab in tabs" 
        :key="tab.key"
        :variant="activeTab === tab.key ? 'primary' : 'ghost'"
        size="small"
        @click="activeTab = tab.key"
      >
        {{ tab.name }}
      </Button>
    </div>

    <div class="converter-content">
      <component :is="currentComponent" :key="activeTab" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import Button from "@/components/Button.vue";
import LengthConverter from "./components/LengthConverter.vue";
import AreaConverter from "./components/AreaConverter.vue";
import VolumeConverter from "./components/VolumeConverter.vue";
import MassConverter from "./components/MassConverter.vue";
import PowerConverter from "./components/PowerConverter.vue";
import TimeConverter from "./components/TimeConverter.vue";
import SpeedConverter from "./components/SpeedConverter.vue";
import DataConverter from "./components/DataConverter.vue";
import BaseConverter from "./components/BaseConverter.vue";
import ASCIIConverter from "./components/ASCIIConverter.vue";

interface I18n {
  unitConverterTitle?: string;
}

interface Props {
  i18n?: I18n;
  plugin?: any;
}

defineProps<Props>();

const activeTab = ref("length");

const tabs = [
  { key: "length", name: "长度" },
  { key: "area", name: "面积" },
  { key: "volume", name: "体积" },
  { key: "mass", name: "质量" },
  { key: "power", name: "功率" },
  { key: "time", name: "时间" },
  { key: "speed", name: "速度" },
  { key: "data", name: "数据" },
  { key: "base", name: "进制" },
  { key: "ascii", name: "ASCII" },
];

const componentMap: Record<string, any> = {
  length: LengthConverter,
  area: AreaConverter,
  volume: VolumeConverter,
  mass: MassConverter,
  power: PowerConverter,
  time: TimeConverter,
  speed: SpeedConverter,
  data: DataConverter,
  base: BaseConverter,
  ascii: ASCIIConverter,
};

const currentComponent = computed(() => componentMap[activeTab.value]);
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
