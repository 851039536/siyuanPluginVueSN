# 通用设置功能

## 功能概述

通用设置功能为思源笔记插件提供了模块化的通用配置功能，当前包括字体设置，未来可轻松扩展外观设置、行为设置等模块。

## 架构设计

### 🏗️ 模块化架构
- **模块管理器**：`ModuleManager` 类负责管理所有设置模块
- **独立组件**：每个设置模块都是独立的 Vue 组件
- **可扩展性**：通过配置轻松添加新的设置模块
- **统一接口**：所有模块遵循统一的接口规范

### 📱 紧凑UI设计
- **选项卡式界面**：节省空间，便于模块切换
- **响应式布局**：适配不同屏幕尺寸
- **可折叠预览**：预览区域可展开/收起
- **优化宽度**：侧边栏宽度从380px减少到320px

## 主要模块

### 1. 字体设置模块
- **组件位置**：`components/FontSettings.vue`
- **功能特性**：
  - 字体族设置（自定义输入 + 预设选择）
  - 字体大小（8-72px，滑块 + 数字输入）
  - 字体粗细（预设值 + 具体数值）
  - 行高调节（1.0-3.0，滑块 + 数字输入）
  - 可折叠预览区域
  - 独立的保存/重置按钮

### 2. 外观设置模块（示例）
- **组件位置**：`modules/AppearanceSettings.vue`
- **功能特性**：
  - 主题模式选择（自动/浅色/深色）
  - 界面缩放设置（80%-150%）
  - 侧边栏显示控制
- **状态**：示例模块，可供参考和扩展

### 3. 模块管理器
- **位置**：`modules/ModuleManager.ts`
- **功能特性**：
  - 模块注册与管理
  - 启用/禁用控制
  - 动态加载支持
  - 模块排序

## 文件结构

```
src/features/generalSettings/
├── index.ts                         # 通用设置主逻辑
├── GeneralSettingsPanel.vue          # 主界面容器（选项卡）
├── README.md                         # 本文档
├── components/
│   └── FontSettings.vue              # 字体设置组件
└── modules/
    ├── ModuleManager.ts              # 模块管理器
    └── AppearanceSettings.vue        # 外观设置示例
```

## 核心接口

### SettingsModule 接口
```typescript
interface SettingsModule {
  id: string;           // 模块唯一标识
  name: string;         // 显示名称
  icon?: string;        // 图标（可选）
  description?: string; // 描述（可选）
  component: any;       // Vue 组件
  order?: number;       // 排序权重
  enabled?: boolean;    // 是否启用
}
```

### 模块数据格式
```typescript
// 字体设置
interface FontSettings {
  fontFamily: string;   // 字体族
  fontSize: number;     // 字体大小
  fontWeight: string;   // 字体粗细
  lineHeight: number;   // 行高
}

// 外观设置（示例）
interface AppearanceSettings {
  themeMode: 'auto' | 'light' | 'dark';
  interfaceScale: number;
  showSidebar: boolean;
}
```

## 扩展指南

### 📝 添加新模块

1. **创建模块组件**：
```typescript
// modules/NewModule.vue
<template>
  <div class="new-module">
    <!-- 模块UI内容 -->
  </div>
</template>

<script setup lang="ts">
interface Props {
  i18n?: any
}

interface Emits {
  (e: 'change', settings: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleSettingChange(newSettings: any) {
  emit('change', newSettings)
}
</script>
```

2. **注册模块**：
```typescript
// 在 GeneralSettingsPanel.vue 中
import NewModule from './modules/NewModule.vue'

const modules = ref([
  // 现有模块...
  {
    id: 'new-module',
    name: '新模块',
    icon: '🆕',
    component: NewModule,
    order: 4
  }
])
```

3. **添加处理逻辑**：
```typescript
// 在 index.ts 中
private handleSettingsChange(settings: any) {
  if (settings.moduleId === 'new-module') {
    // 处理新模块的设置变化
    this.applyNewModuleSettings(settings.settings);
  }
}
```

## 使用方法

1. **启用功能**：在插件设置中开启"启用通用设置功能"
2. **打开设置**：点击右侧边栏的设置图标
3. **选择模块**：点击选项卡切换不同设置模块
4. **调整设置**：在各模块中调整对应设置
5. **保存设置**：每个模块都有独立的保存/重置按钮
6. **实时生效**：大部分设置会立即应用到界面

## 技术特性

### 🎨 UI/UX 特性
- **模块化选项卡**：清晰的模块区分
- **紧凑布局**：最大化空间利用
- **响应式设计**：适配移动端和桌面端
- **主题适配**：跟随思源笔记主题变化
- **平滑动画**：选项卡切换和交互反馈

### ⚡ 性能优化
- **按需加载**：只加载当前激活的模块
- **轻量组件**：每个模块都是独立的轻量组件
- **本地存储**：设置数据保存在 localStorage
- **事件驱动**：模块间通过事件通信

### 🔧 开发体验
- **类型安全**：完整的 TypeScript 类型定义
- **组件复用**：可复用的UI组件和工具函数
- **易于扩展**：标准化的模块开发流程
- **调试友好**：清晰的日志和错误处理

## 配置接口

### PluginSettings 扩展
```typescript
interface PluginSettings {
  // ... 其他配置
  enableGeneralSettings: boolean;  // 是否启用通用设置功能
}
```

## 数据持久化

### 存储键名规范
- 字体设置：`general-font-settings`
- 外观设置：`appearance-settings`
- 其他模块：`{module-id}-settings`

### 数据格式
```typescript
// localStorage 中的数据格式
{
  "general-font-settings": {
    "fontFamily": "Microsoft YaHei",
    "fontSize": 14,
    "fontWeight": "normal",
    "lineHeight": 1.6
  },
  "appearance-settings": {
    "themeMode": "auto",
    "interfaceScale": 100,
    "showSidebar": true
  }
}
```

## 样式应用范围

当前字体设置应用在以下思源笔记元素：
- `.protyle-content` - 编辑器内容区域
- `.protyle-wysiwyg` - 富文本编辑器
- `.b3-typography` - 阅读模式内容
- `.render-node` - 渲染节点
- `[data-node-id]` - 文档节点
- `.protyle-title` - 文档标题
- `.card-item__text` - 卡片文本

## 注意事项

1. **模块命名**：新模块的 `id` 应该是唯一的，建议使用 kebab-case
2. **存储容量**：注意 localStorage 的存储容量限制（通常5-10MB）
3. **浏览器兼容**：确保使用的 API 在目标浏览器中兼容
4. **性能考虑**：避免在模块中进行重量级计算或频繁的DOM操作
5. **错误处理**：在模块中添加适当的错误处理和用户反馈

## 未来规划

- [ ] 添加更多设置模块（快捷键、编辑器行为等）
- [ ] 支持设置导入/导出功能
- [ ] 添加设置预设功能
- [ ] 支持模块间的联动配置
- [ ] 添加设置历史记录功能