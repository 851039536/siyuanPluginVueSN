# Switch 组件

开关组件，用于切换开/关状态。

## 基础用法

### v-model 绑定

```vue
<template>
  <Switch v-model="enabled" />
  <p>当前状态: {{ enabled ? '开' : '关' }}</p>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Switch from '@/components/Switch.vue'

const enabled = ref(false)
</script>
```

### 带标签

```vue
<template>
  <Switch
    v-model="enabled"
    label="启用通知"
  />
</template>
```

### 标签在左侧

```vue
<template>
  <Switch
    v-model="enabled"
    label="夜间模式"
    label-before
  />
</template>
```

## 尺寸

支持 3 种尺寸：`small`、`medium`（默认）、`large`

```vue
<template>
  <Switch
    v-model="enabled"
    size="small"
  />
  <Switch
    v-model="enabled"
    size="medium"
  />
  <Switch
    v-model="enabled"
    size="large"
  />
</template>
```

## 禁用状态

```vue
<template>
  <Switch
    v-model="enabled"
    disabled
  />
  <Switch
    v-model="enabled"
    :disabled="true"
    label="禁用状态"
  />
</template>
```

## 加载状态

```vue
<template>
  <Switch
    v-model="enabled"
    :loading="loading"
    label="加载中..."
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Switch from '@/components/Switch.vue'

const loading = ref(false)
const enabled = ref(false)

const handleChange = async (value: boolean) => {
  loading.value = true
  // 模拟异步操作
  await new Promise((resolve) => setTimeout(resolve, 2000))
  loading.value = false
  console.log('切换到:', value)
}
</script>
```

## 自定义颜色

```vue
<template>
  <Switch
    v-model="enabled"
    active-color="#10b981"
    inactive-color="#ef4444"
  />
</template>
```

## 组合示例

### 设置面板

```vue
<template>
  <div class="settings-panel">
    <div class="setting-item">
      <Switch
        v-model="settings.notifications"
        label="启用通知"
      />
      <p class="setting-desc">
        接收推送通知
      </p>
    </div>

    <div class="setting-item">
      <Switch
        v-model="settings.emailAlerts"
        label="邮件提醒"
      />
      <p class="setting-desc">
        发送邮件通知
      </p>
    </div>

    <div class="setting-item">
      <Switch
        v-model="settings.autoUpdate"
        label="自动更新"
      />
      <p class="setting-desc">
        自动检查更新
      </p>
    </div>

    <div class="setting-item">
      <Switch
        v-model="settings.darkMode"
        label="深色模式"
        label-before
      />
      <p class="setting-desc">
        切换深色主题
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Switch from '@/components/Switch.vue'

const settings = ref({
  notifications: true,
  emailAlerts: false,
  autoUpdate: true,
  darkMode: false,
})
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--b3-theme-secondary, #999);
  margin: 0;
}
</style>
```

### 权限开关

```vue
<template>
  <div class="permissions">
    <div class="permission-item">
      <Label>读取权限</Label>
      <Switch
        v-model="permissions.read"
        size="small"
      />
    </div>

    <div class="permission-item">
      <Label>写入权限</Label>
      <Switch
        v-model="permissions.write"
        size="small"
      />
    </div>

    <div class="permission-item">
      <Label>删除权限</Label>
      <Switch
        v-model="permissions.delete"
        size="small"
      />
    </div>

    <div class="permission-item">
      <Label>管理员</Label>
      <Switch
        v-model="permissions.admin"
        size="small"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Label from '@/components/Label.vue'
import Switch from '@/components/Switch.vue'

const permissions = ref({
  read: true,
  write: true,
  delete: false,
  admin: false,
})
</script>

<style scoped>
.permissions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.permission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--b3-theme-surface-lighter, #f5f5f5);
}
</style>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `boolean` | `false` | 是否选中 |
| `label` | `string` | - | 标签文本 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 开关尺寸 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `activeColor` | `string` | - | 选中时的颜色 |
| `inactiveColor` | `string` | - | 未选中时的颜色 |
| `labelBefore` | `boolean` | `false` | 是否显示标签在左侧 |

## Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(value: boolean)` | 值变化时触发 |
| `change` | `(value: boolean)` | 状态改变时触发 |

## Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 自定义标签内容（覆盖 label） |

## 无障碍支持

- 使用 `role="switch"` 属性
- 使用 `aria-checked` 表示开关状态
- 使用 `aria-disabled` 表示禁用状态
- 支持键盘操作（Enter 键切换）
- Focus 时显示可见焦点环
