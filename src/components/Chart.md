# Chart 组件

图表组件，基于 Canvas API 实现，支持多种图表类型，无需额外依赖。

## 基础用法

### 柱状图

```vue
<template>
  <Chart
    type="bar"
    :data="data"
  />
</template>

<script setup lang="ts">
import Chart from '@/components/Chart.vue'

const data = [
  {
    label: '一月',
    value: 120,
  },
  {
    label: '二月',
    value: 200,
  },
  {
    label: '三月',
    value: 150,
  },
  {
    label: '四月',
    value: 80,
  },
  {
    label: '五月',
    value: 70,
  },
  {
    label: '六月',
    value: 110,
  },
]
</script>
```

### 折线图

```vue
<template>
  <Chart
    type="line"
    :data="data"
  />
</template>
```

### 饼图

```vue
<template>
  <Chart
    type="pie"
    :data="pieData"
  />
</template>

<script setup lang="ts">
const pieData = [
  {
    label: '产品A',
    value: 300,
  },
  {
    label: '产品B',
    value: 200,
  },
  {
    label: '产品C',
    value: 100,
  },
]
</script>
```

### 环形图

```vue
<template>
  <Chart
    type="doughnut"
    :data="pieData"
  />
</template>
```

### 面积图

```vue
<template>
  <Chart
    type="area"
    :data="data"
  />
</template>
```

## 尺寸

支持 4 种尺寸：`small`、`medium`（默认）、`large`、`full`

```vue
<template>
  <Chart
    type="bar"
    :data="data"
    size="small"
  />
  <Chart
    type="bar"
    :data="data"
    size="medium"
  />
  <Chart
    type="bar"
    :data="data"
    size="large"
  />
  <Chart
    type="bar"
    :data="data"
    size="full"
  />
</template>
```

## 自定义尺寸

```vue
<template>
  <!-- 自定义宽度和高度 -->
  <Chart
    :data="data"
    :width="500"
    :height="300"
  />

  <!-- 响应式宽度 -->
  <Chart
    :data="data"
    width="100%"
    :height="250"
  />
</template>
```

## 图表选项

```vue
<template>
  <Chart
    :data="data"
    :options="chartOptions"
  />
</template>

<script setup lang="ts">
const chartOptions = {
  showLegend: true, // 显示图例
  showGrid: true, // 显示网格线
  showLabels: true, // 显示数值标签
  showTooltip: true, // 显示工具提示
  animationDuration: 500, // 动画持续时间
  minY: 0, // Y轴最小值
  maxY: 300, // Y轴最大值
  colors: ['#3b82f6', '#10b981', '#f59e0b'], // 自定义颜色
}
</script>
```

## 自定义颜色

```vue
<template>
  <Chart
    type="pie"
    :data="customData"
  />
</template>

<script setup lang="ts">
const customData = [
  {
    label: '成功',
    value: 300,
    color: '#10b981',
  },
  {
    label: '警告',
    value: 200,
    color: '#f59e0b',
  },
  {
    label: '危险',
    value: 100,
    color: '#ef4444',
  },
]
</script>
```

## 加载状态

```vue
<template>
  <Chart
    :data="data"
    :loading="loading"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

const loading = ref(true)
const data = ref([])

// 模拟数据加载
setTimeout(() => {
  data.value = [
    {
      label: 'A',
      value: 100,
    },
    {
      label: 'B',
      value: 200,
    },
  ]
  loading.value = false
}, 2000)
</script>
```

## 空状态

```vue
<template>
  <!-- 使用默认空状态文本 -->
  <Chart
    :data="[]"
    emptyText="暂无统计数据"
  />

  <!-- 自定义空状态内容 -->
  <Chart :data="[]">
    <template #empty>
      <div class="custom-empty">
        <IconWrapper
          name="iconFile"
          :size="48"
        />
        <p>暂无数据</p>
      </div>
    </template>
  </Chart>
</template>
```

## 主题

支持亮色和暗色主题

```vue
<template>
  <!-- 亮色主题 -->
  <Chart
    :data="data"
    theme="light"
  />

  <!-- 暗色主题 -->
  <Chart
    :data="data"
    theme="dark"
  />
</template>
```

## 组合示例

### 数据统计面板

```vue
<template>
  <div class="dashboard">
    <Card
      title="销售趋势"
      subtitle="本周销售额"
    >
      <Chart
        type="line"
        :data="salesData"
        :options="chartOptions"
        size="full"
      />
    </Card>

    <Card
      title="分类占比"
      subtitle="产品销售分布"
    >
      <Chart
        type="doughnut"
        :data="categoryData"
        :options="chartOptions"
        size="full"
      />
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/Card.vue'
import Chart from '@/components/Chart.vue'

const salesData = ref([
  {
    label: '周一',
    value: 120,
  },
  {
    label: '周二',
    value: 200,
  },
  {
    label: '周三',
    value: 150,
  },
  {
    label: '周四',
    value: 80,
  },
  {
    label: '周五',
    value: 70,
  },
  {
    label: '周六',
    value: 110,
  },
  {
    label: '周日',
    value: 130,
  },
])

const categoryData = ref([
  {
    label: '电子产品',
    value: 450,
  },
  {
    label: '服装',
    value: 320,
  },
  {
    label: '食品',
    value: 280,
  },
  {
    label: '家居',
    value: 200,
  },
])

const chartOptions = {
  showGrid: true,
  showLabels: true,
  colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
}
</script>

<style scoped>
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}
</style>
```

### 实时数据更新

```vue
<template>
  <Chart
    type="bar"
    :data="data"
    size="large"
  />
</template>

<script setup lang="ts">
import {
  onMounted,
  ref,
} from 'vue'
import Chart from '@/components/Chart.vue'

const data = ref([
  {
    label: 'A',
    value: 100,
  },
  {
    label: 'B',
    value: 200,
  },
  {
    label: 'C',
    value: 150,
  },
])

// 模拟实时数据更新
onMounted(() => {
  setInterval(() => {
    data.value = data.value.map((item) => ({
      ...item,
      value: Math.floor(Math.random() * 300) + 50,
    }))
  }, 3000)
})
</script>
```

### 多图表对比

```vue
<template>
  <div class="comparison">
    <Chart
      type="bar"
      :data="currentYear"
      title="今年"
      :options="{ showLabels: true }"
    />
    <Chart
      type="bar"
      :data="lastYear"
      title="去年"
      :options="{ showLabels: true }"
    />
  </div>
</template>

<script setup lang="ts">
import Chart from '@/components/Chart.vue'

const currentYear = [
  {
    label: 'Q1',
    value: 450,
  },
  {
    label: 'Q2',
    value: 520,
  },
  {
    label: 'Q3',
    value: 480,
  },
  {
    label: 'Q4',
    value: 600,
  },
]

const lastYear = [
  {
    label: 'Q1',
    value: 380,
  },
  {
    label: 'Q2',
    value: 420,
  },
  {
    label: 'Q3',
    value: 400,
  },
  {
    label: 'Q4',
    value: 500,
  },
]
</script>

<style scoped>
.comparison {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
</style>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'line' \| 'bar' \| 'pie' \| 'doughnut' \| 'area'` | `'bar'` | 图表类型 |
| `data` | `ChartData[]` | **必填** | 图表数据 |
| `size` | `'small' \| 'medium' \| 'large' \| 'full'` | `'medium'` | 图表尺寸 |
| `title` | `string` | - | 图表标题 |
| `width` | `number \| string` | - | 宽度 |
| `height` | `number` | - | 高度 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `emptyText` | `string` | `'暂无数据'` | 空状态文本 |
| `options` | `ChartOptions` | `{}` | 图表选项 |
| `theme` | `'light' \| 'dark'` | `'light'` | 主题 |

## ChartData 类型

```typescript
interface ChartData {
  label: string // 数据标签
  value: number // 数据值
  color?: string // 自定义颜色（可选）
}
```

## ChartOptions 类型

```typescript
interface ChartOptions {
  showLegend?: boolean // 是否显示图例
  showGrid?: boolean // 是否显示网格线
  showLabels?: boolean // 是否显示数值标签
  showTooltip?: boolean // 是否显示工具提示
  animationDuration?: number // 动画持续时间（毫秒）
  minY?: number // Y轴最小值
  maxY?: number // Y轴最大值
  colors?: string[] // 颜色列表
}
```

## Slots

| 插槽名 | 说明 |
|--------|------|
| `empty` | 自定义空状态内容 |

## 特性

- **零依赖** - 基于 Canvas API 实现，无需额外图表库
- **响应式** - 自动适配容器尺寸变化
- **高清屏支持** - 自动处理设备像素比（DPR）
- **主题适配** - 支持亮色/暗色主题
- **类型安全** - 完整的 TypeScript 类型定义
