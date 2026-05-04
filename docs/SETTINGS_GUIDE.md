# 插件设置功能开发指南

本文档说明如何在插件中添加新的可配置功能模块。

---

## 📋 目录

- [核心文件说明](#核心文件说明)
- [添加新功能的步骤](#添加新功能的步骤)
- [完整示例](#完整示例)
- [注意事项](#注意事项)

---

## 核心文件说明

### 1. `src/config/settings.ts`
配置管理核心模块，定义配置接口和数据持久化方法。

### 2. `src/components/SettingPanel.vue`
设置面板UI组件，用户通过此界面开关功能。

### 3. `src/index.ts`
插件主入口，根据配置动态注册功能模块。

### 4. `src/i18n/*.json`
国际化文本配置文件（中英文）。

---

## 添加新功能的步骤

### 步骤 1: 修改配置接口

**文件: `src/config/settings.ts`**

```typescript
export interface PluginSettings {
  enablePageLock: boolean
  enableWordCount: boolean
  enableTableOfContents: boolean
  enableYourNewFeature: boolean // 👈 添加新功能的配置项
}

export const DEFAULT_SETTINGS: PluginSettings = {
  enablePageLock: true,
  enableWordCount: true,
  enableTableOfContents: true,
  enableYourNewFeature: true, // 👈 设置默认值（true=默认启用）
}
```

---

### 步骤 2: 更新设置面板UI

**文件: `src/components/SettingPanel.vue`**

在 `<template>` 的 `settings-content` 区域添加新的开关项:

```vue
<div class="setting-item b3-label">
  <div class="fn__flex">
    <span class="fn__flex-1">
      {{ i18n.enableYourNewFeature }}
    </span>
    <span class="fn__space"></span>
    <input
      type="checkbox"
      class="b3-switch fn__flex-center"
      v-model="localSettings.enableYourNewFeature"
    />
  </div>

  <div class="b3-label__text">{{ i18n.enableYourNewFeatureDesc }}</div>
</div>
```

---

### 步骤 3: 添加国际化文本

**文件: `src/i18n/zh_CN.json`**

```json
{
  "enableYourNewFeature": "启用新功能",
  "enableYourNewFeatureDesc": "新功能的描述说明"
}
```

**文件: `src/i18n/en_US.json`**

```json
{
  "enableYourNewFeature": "Enable New Feature",
  "enableYourNewFeatureDesc": "Description of your new feature"
}
```

---

### 步骤 4: 在主入口中注册功能

**文件: `src/index.ts`**

在 `registerFeatures()` 方法中添加条件注册:

```typescript
private registerFeatures() {
  // ... 现有功能 ...

  if (this.settings.enableYourNewFeature) {
    console.log('注册新功能')
    registerYourNewFeature(this)  // 调用功能注册函数
  }
}
```

---

### 步骤 5: 实现功能模块

**文件: `src/features/yourNewFeature/index.ts`**

```typescript
import { Plugin } from 'siyuan'

export function registerYourNewFeature(plugin: Plugin) {
  // 实现你的功能逻辑
  console.log('新功能已注册')

  // 例如: 添加菜单、监听事件等
  plugin.eventBus.on('some-event', () => {
    // 处理事件
  })
}
```

**文件: `src/features/index.ts`**

导出新功能:

```typescript
export { registerYourNewFeature } from './yourNewFeature'
```

---

## 完整示例

假设我们要添加一个"自动保存"功能:

### 1. 修改 `settings.ts`

```typescript
export interface PluginSettings {
  enablePageLock: boolean
  enableWordCount: boolean
  enableTableOfContents: boolean
  enableAutoSave: boolean // 新增
}

export const DEFAULT_SETTINGS: PluginSettings = {
  enablePageLock: true,
  enableWordCount: true,
  enableTableOfContents: true,
  enableAutoSave: false, // 默认关闭
}
```

### 2. 修改 `SettingPanel.vue`

```vue
<div class="setting-item b3-label">
  <div class="fn__flex">
    <span class="fn__flex-1">
      {{ i18n.enableAutoSave }}
    </span>
    <span class="fn__space"></span>
    <input
      type="checkbox"
      class="b3-switch fn__flex-center"
      v-model="localSettings.enableAutoSave"
    />
  </div>

  <div class="b3-label__text">{{ i18n.enableAutoSaveDesc }}</div>
</div>
```

### 3. 修改 `zh_CN.json` 和 `en_US.json`

```json
// zh_CN.json
{
  "enableAutoSave": "启用自动保存",
  "enableAutoSaveDesc": "编辑时自动保存文档，无需手动保存"
}

// en_US.json
{
  "enableAutoSave": "Enable Auto Save",
  "enableAutoSaveDesc": "Automatically save documents while editing"
}
```

### 4. 修改 `index.ts`

```typescript
import { registerAutoSave } from '@/features'

private registerFeatures() {
  if (this.settings.enableWordCount) {
    registerWordCountMenu(this)
  }
  if (this.settings.enablePageLock) {
    registerPageLock(this)
  }
  if (this.settings.enableTableOfContents) {
    registerTableOfContents(this)
  }
  if (this.settings.enableAutoSave) {
    console.log('注册自动保存功能')
    registerAutoSave(this)
  }
}
```

### 5. 创建功能模块

```typescript
// src/features/autoSave/index.ts
import { Plugin } from 'siyuan'

export function registerAutoSave(plugin: Plugin) {
  let autoSaveTimer: NodeJS.Timeout | null = null

  plugin.eventBus.on('input-protyle', () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }

    autoSaveTimer = setTimeout(() => {
      console.log('自动保存...')
      // 执行保存逻辑
    }, 3000)
  })
}

// src/features/index.ts
export { registerAutoSave } from './autoSave'
```

---

## 注意事项

### ✅ 命名规范

- 配置项命名: `enableXxx`（驼峰命名）
- 国际化键: `enableXxx`、`enableXxxDesc`
- 功能模块目录: `features/xxxFeature`
- 注册函数: `registerXxxFeature`

### ✅ 默认值设置

- 新功能建议默认为 `false`（关闭），避免影响现有用户
- 核心功能可以默认为 `true`（启用）

### ✅ 配置生效机制

- 配置修改后需要**重启插件**或**重启思源**才能生效
- 保存配置时会提示用户重启

### ✅ 功能模块化

- 每个功能独立放在 `features/` 目录下
- 通过 `features/index.ts` 统一导出
- 便于维护和禁用

### ✅ 国际化支持

- 所有用户可见文本必须支持中英文
- 文本键名保持一致
- 提供清晰的功能描述

### ✅ 条件注册

- 通过 `if (this.settings.enableXxx)` 控制功能注册
- 未启用的功能不会加载，节省资源

---

## 快速检查清单

添加新功能时，请确认以下项目:

- [ ] `settings.ts` 中添加了配置接口
- [ ] `settings.ts` 中设置了默认值
- [ ] `SettingPanel.vue` 中添加了UI开关
- [ ] `zh_CN.json` 中添加了中文文本
- [ ] `en_US.json` 中添加了英文文本
- [ ] `index.ts` 中添加了条件注册逻辑
- [ ] 创建了功能模块文件
- [ ] `features/index.ts` 中导出了新功能
- [ ] 测试功能启用/禁用是否正常

---

## 技术支持

如有疑问，请参考现有功能的实现:

- 页面锁定: `features/pageLock/`
- 字数统计: `features/wordCount/`
- 目录插件: `features/tableOfContents/`

---

**更新时间**: 2025-11-26
**文档版本**: v1.0
