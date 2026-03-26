<template>
  <div class="unit-converter">
    <div class="converter-header">
      <h3>{{ i18n.unitConverterTitle || '单位转换' }}</h3>
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
      <!-- 长度转换 -->
      <LengthConverter 
        v-if="activeTab === 'length'" 
      />
      
      <!-- 面积转换 -->
      <AreaConverter 
        v-if="activeTab === 'area'" 
      />
      
      <!-- 体积转换 -->
      <VolumeConverter 
        v-if="activeTab === 'volume'" 
      />
      
      <!-- 质量转换 -->
      <MassConverter 
        v-if="activeTab === 'mass'" 
      />
      
      <!-- 功率转换 -->
      <PowerConverter 
        v-if="activeTab === 'power'" 
      />
      
      <!-- 时间转换 -->
      <TimeConverter 
        v-if="activeTab === 'time'" 
      />
      
      <!-- 速度转换 -->
      <SpeedConverter 
        v-if="activeTab === 'speed'" 
      />
      
      <!-- 数据存储转换 -->
      <DataConverter 
        v-if="activeTab === 'data'" 
      />
      
      <!-- 进制转换 -->
      <BaseConverter 
        v-if="activeTab === 'base'" 
      />
      
      <!-- ASCII转换 -->
      <ASCIIConverter 
        v-if="activeTab === 'ascii'" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/Button.vue'
import LengthConverter from './converters/LengthConverter.vue'
import AreaConverter from './converters/AreaConverter.vue'
import VolumeConverter from './converters/VolumeConverter.vue'
import MassConverter from './converters/MassConverter.vue'
import PowerConverter from './converters/PowerConverter.vue'
import TimeConverter from './converters/TimeConverter.vue'
import SpeedConverter from './converters/SpeedConverter.vue'
import DataConverter from './converters/DataConverter.vue'
import BaseConverter from './converters/BaseConverter.vue'
import ASCIIConverter from './converters/ASCIIConverter.vue'

interface I18n {
  unitConverterTitle?: string
}

interface Props {
  i18n?: I18n
}

defineProps<Props>()

const activeTab = ref('length')

const tabs = [
  { key: 'length', name: '长度' },
  { key: 'area', name: '面积' },
  { key: 'volume', name: '体积' },
  { key: 'mass', name: '质量' },
  { key: 'power', name: '功率' },
  { key: 'time', name: '时间' },
  { key: 'speed', name: '速度' },
  { key: 'data', name: '数据' },
  { key: 'base', name: '进制' },
  { key: 'ascii', name: 'ASCII' }
]
</script>

<style lang="scss" scoped>
.unit-converter {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  padding: 16px;
  box-sizing: border-box;

  .converter-header {
    margin-bottom: 16px;
    
    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    }
  }

  .converter-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--b3-border-color);
    padding-bottom: 8px;
  }

  .converter-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
}
</style>