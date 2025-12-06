# 图标系统使用示例

本文档提供了在项目中使用图标系统的各种示例。

## 目录

1. [基础使用](#基础使用)
2. [在功能模块中使用](#在功能模块中使用)
3. [添加新图标](#添加新图标)
4. [高级用法](#高级用法)

---

## 基础使用

### 示例 1: 简单图标

```vue
<template>
  <div class="my-component">
    <IconWrapper name="settings" />
    <span>设置</span>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
</script>
```

### 示例 2: 自定义大小

```vue
<template>
  <div class="toolbar">
    <!-- 小图标 -->
    <IconWrapper name="close" :size="16" />
    
    <!-- 中等图标 -->
    <IconWrapper name="settings" :size="20" />
    
    <!-- 大图标 -->
    <IconWrapper name="menu" :size="24" />
  </div>
</template>
```

### 示例 3: 自定义颜色

```vue
<template>
  <div class="status-icons">
    <!-- 成功状态 -->
    <IconWrapper name="success" color="#10b981" />
    
    <!-- 错误状态 -->
    <IconWrapper name="error" color="#ef4444" />
    
    <!-- 警告状态 -->
    <IconWrapper name="warning" color="#f59e0b" />
    
    <!-- 使用 CSS 变量 -->
    <IconWrapper name="info" color="var(--b3-theme-primary)" />
  </div>
</template>
```

---

## 在功能模块中使用

### 示例 4: 按钮图标

```vue
<template>
  <button class="action-button" @click="handleClick">
    <IconWrapper name="save" :size="16" />
    <span>保存</span>
  </button>
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'

const handleClick = () => {
  console.log('保存操作')
}
</script>

<style scoped>
.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--b3-theme-primary);
  color: white;
  cursor: pointer;
}
</style>
```

### 示例 5: 列表项图标

```vue
<template>
  <div class="feature-list">
    <div 
      v-for="item in items" 
      :key="item.id" 
      class="list-item"
    >
      <IconWrapper :name="item.icon" :size="20" />
      <span>{{ item.title }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
import type { IconKey } from '@/config/icons'

interface ListItem {
  id: string
  icon: IconKey
  title: string
}

const items: ListItem[] = [
  { id: '1', icon: 'tableOfContents', title: '目录索引' },
  { id: '2', icon: 'imageCompressor', title: '图片压缩' },
  { id: '3', icon: 'qrCode', title: '二维码生成' }
]
</script>

<style scoped>
.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.list-item:hover {
  background: var(--b3-theme-surface);
}
</style>
```

### 示例 6: 标签页图标

```vue
<template>
  <div class="tabs">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab"
      :class="{ active: activeTab === tab.id }"
      @click="activeTab = tab.id"
    >
      <IconWrapper :name="tab.icon" :size="18" />
      <span>{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import type { IconKey } from '@/config/icons'

interface Tab {
  id: string
  icon: IconKey
  label: string
}

const tabs: Tab[] = [
  { id: 'general', icon: 'settings', label: '常规' },
  { id: 'features', icon: 'menu', label: '功能' },
  { id: 'help', icon: 'help', label: '帮助' }
]

const activeTab = ref('general')
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  color: var(--b3-theme-primary);
  border-bottom: 2px solid var(--b3-theme-primary);
}
</style>
```

---

## 添加新图标

### 示例 7: 添加功能图标

**步骤 1**: 在 `src/config/icons.ts` 中添加配置

```typescript
export const FEATURE_ICONS = {
  // ... 现有配置
  
  // 新增：笔记模板功能
  noteTemplate: {
    icon: 'mdi:file-document-edit',
    color: '#8b5cf6'
  },
  
  // 新增：数据导出功能
  dataExport: {
    icon: 'mdi:database-export',
    color: '#06b6d4'
  }
}
```

**步骤 2**: 在组件中使用

```vue
<template>
  <div class="new-features">
    <div class="feature-item">
      <IconWrapper name="noteTemplate" :size="24" />
      <span>笔记模板</span>
    </div>
    
    <div class="feature-item">
      <IconWrapper name="dataExport" :size="24" />
      <span>数据导出</span>
    </div>
  </div>
</template>
```

### 示例 8: 添加通用图标

```typescript
export const COMMON_ICONS = {
  // ... 现有配置
  
  // 新增：复制图标
  copy: {
    icon: 'mdi:content-copy'
  },
  
  // 新增：下载图标
  download: {
    icon: 'mdi:download',
    color: '#10b981'
  },
  
  // 新增：上传图标
  upload: {
    icon: 'mdi:upload',
    color: '#3b82f6'
  }
}
```

---

## 高级用法

### 示例 9: 动态图标

```vue
<template>
  <button @click="toggleLock">
    <IconWrapper 
      :name="isLocked ? 'pageLock' : 'close'" 
      :size="20" 
    />
    <span>{{ isLocked ? '已锁定' : '未锁定' }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'

const isLocked = ref(false)

const toggleLock = () => {
  isLocked.value = !isLocked.value
}
</script>
```

### 示例 10: 图标动画

```vue
<template>
  <button class="refresh-button" @click="handleRefresh">
    <IconWrapper 
      name="refresh" 
      :size="20" 
      :class="{ spinning: isRefreshing }"
    />
    <span>刷新</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'

const isRefreshing = ref(false)

const handleRefresh = async () => {
  isRefreshing.value = true
  
  try {
    // 执行刷新操作
    await new Promise(resolve => setTimeout(resolve, 2000))
  } finally {
    isRefreshing.value = false
  }
}
</script>

<style scoped>
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
```

### 示例 11: 图标徽章

```vue
<template>
  <div class="icon-with-badge">
    <IconWrapper name="settings" :size="24" />
    <span v-if="notificationCount > 0" class="badge">
      {{ notificationCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'

const notificationCount = ref(5)
</script>

<style scoped>
.icon-with-badge {
  position: relative;
  display: inline-block;
}

.badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
```

### 示例 12: 图标工具提示

```vue
<template>
  <div 
    class="icon-with-tooltip"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <IconWrapper name="help" :size="20" />
    <div v-if="showTooltip" class="tooltip">
      这是一个帮助提示
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'

const showTooltip = ref(false)
</script>

<style scoped>
.icon-with-tooltip {
  position: relative;
  display: inline-block;
  cursor: help;
}

.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 12px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
}
</style>
```

---

## 图标搜索技巧

### 在 Iconify 中搜索图标

访问 https://icon-sets.iconify.design/ 并搜索：

1. **按功能搜索**
   - 文件相关: `file`, `document`, `folder`
   - 编辑相关: `edit`, `pencil`, `write`
   - 导航相关: `arrow`, `chevron`, `menu`

2. **按风格筛选**
   - Material Design: `mdi:`
   - Carbon: `carbon:`
   - Lucide: `lucide:`

3. **常用图标推荐**
   ```typescript
   // 文件操作
   'mdi:file-document'      // 文档
   'mdi:folder'             // 文件夹
   'mdi:file-image'         // 图片
   
   // 编辑操作
   'mdi:pencil'             // 编辑
   'mdi:content-save'       // 保存
   'mdi:delete'             // 删除
   
   // 导航
   'mdi:menu'               // 菜单
   'mdi:arrow-left'         // 返回
   'mdi:home'               // 首页
   
   // 状态
   'mdi:check-circle'       // 成功
   'mdi:alert-circle'       // 错误
   'mdi:information'        // 信息
   ```

---

## 最佳实践总结

1. **保持一致性**: 同一类功能使用相同风格的图标
2. **语义化命名**: 使用清晰的图标键名
3. **合理尺寸**: 根据使用场景选择合适的图标大小
4. **颜色规范**: 优先使用主题变量，保持视觉统一
5. **类型安全**: 充分利用 TypeScript 的类型检查
6. **性能优化**: Iconify 会自动按需加载，无需担心性能问题

---

## 常见问题

**Q: 如何更换图标集？**

A: 只需修改 `icon` 字段的前缀：
```typescript
// 从 Material Design
icon: 'mdi:home'

// 改为 Carbon
icon: 'carbon:home'
```

**Q: 图标加载慢怎么办？**

A: 可以预加载常用图标集：
```typescript
import { addCollection } from '@iconify/vue'
import mdiIcons from '@iconify-json/mdi/icons.json'

addCollection(mdiIcons)
```

**Q: 如何自定义图标？**

A: 可以使用 SVG 图标或创建自定义图标集，参考 Iconify 文档。

---

## 更多资源

- [Iconify 官方文档](https://iconify.design/)
- [图标配置系统文档](./src/config/icons.README.md)
- [超级面板开发文档](./src/features/superPanel/README.md)
